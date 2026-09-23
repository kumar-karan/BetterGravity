// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addToolbarButton, resetToolbarButtons } from "../src/world/ui/button.js";

const source = readFileSync("community/plugins/tasks/index.js", "utf8");

let cleanup: (() => void)[];
let saved: Record<string, unknown>;
let write: ReturnType<typeof vi.fn>;
let pluginInstance: any;

function setupDOM() {
  document.body.innerHTML = `
    <aside>
      <a data-testid="new-conversation-button" href="/">New chat</a>
    </aside>
    <div id="viewport">
      <main data-testid="conversation-view" class="flex flex-col h-full w-full">
        <div class="relative w-full flex-grow min-h-0 message-scroller">Messages</div>
        <div class="relative w-full px-4 pb-2 flex-shrink-0" data-testid="agent-input-box">
          <textarea placeholder="Ask anything..."></textarea>
          <button data-testid="send-button">Send</button>
        </div>
      </main>
    </div>
  `;
}

beforeEach(async () => {
  vi.useFakeTimers();
  cleanup = [];
  saved = {};
  write = vi.fn((key: string, value: unknown) => {
    saved[key] = value;
  });

  setupDOM();

  const context = {
    settings: {
      define: (schema: Record<string, { default?: unknown }>) =>
        Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, value.default])),
      onChange: () => () => undefined,
    },
    storage: {
      get: (key: string, fallback: unknown) =>
        Object.hasOwn(saved, key) ? saved[key] : fallback,
      set: write,
    },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ui: {
      button: addToolbarButton,
    },
    onDispose: (callback: () => void) => cleanup.push(callback),
  };

  pluginInstance = new Function(
    "plugin",
    "window",
    `
    ${source}
    return {
      openTasksView,
      closeTasksView,
      startPlanningChat,
      openAddTaskModal,
      loadTasks,
      saveTasks
    };
  `
  )(context, window);

  await Promise.resolve();
});

afterEach(() => {
  for (const callback of cleanup.reverse()) callback();
  resetToolbarButtons();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("BetterGravity Tasks Plugin", () => {
  it("registers a sidebar button for Tasks", () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-bettergravity-button="Tasks"]');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("Tasks");
  });

  it("opens the tasks view overlay and protects flexbox layout", () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-bettergravity-button="Tasks"]')!;
    const conversation = document.querySelector<HTMLElement>('[data-testid="conversation-view"]')!;

    btn.click();

    const tasksView = document.getElementById("bettergravity-tasks-view");
    expect(tasksView).not.toBeNull();
    expect(conversation.getAttribute("data-tasks-page-hidden")).toBe("");
    expect(conversation.inert).toBe(true);

    // Critical invariant: conversation view must NEVER have inline display: block
    expect(conversation.style.display).not.toBe("block");

    // Click to close
    btn.click();
    expect(document.getElementById("bettergravity-tasks-view")).toBeNull();
    expect(conversation.getAttribute("data-tasks-page-hidden")).toBeNull();
    expect(conversation.inert).toBe(false);
    expect(conversation.style.display).toBe("");
  });

  it("renders tasks and allows toggling checkboxes", () => {
    pluginInstance.openTasksView();

    const tasks = pluginInstance.loadTasks();
    expect(tasks.length).toBeGreaterThan(0);

    const checkboxes = document.querySelectorAll<HTMLInputElement>(".bettergravity-task-checkbox");
    expect(checkboxes.length).toBe(tasks.length);

    // Toggle first checkbox
    const firstCheckbox = checkboxes[0];
    const initialStatus = firstCheckbox.checked;
    firstCheckbox.checked = !initialStatus;
    firstCheckbox.dispatchEvent(new Event("change"));

    expect(write).toHaveBeenCalledWith("tasksList", expect.any(Array));
  });

  it("navigates and prefills composer when 'Plan with AI' is clicked", async () => {
    pluginInstance.openTasksView();

    const planBtn = document.querySelector<HTMLButtonElement>(".bettergravity-tasks-btn--sparkle")!;
    expect(planBtn).not.toBeNull();
    expect(planBtn.textContent).toContain("Plan with AI");

    let newChatClicked = false;
    document.querySelector<HTMLElement>('[data-testid="new-conversation-button"]')!.onclick = () => {
      newChatClicked = true;
    };

    planBtn.click();
    expect(newChatClicked).toBe(true);
    expect(document.getElementById("bettergravity-tasks-view")).toBeNull();

    await vi.advanceTimersByTimeAsync(300);

    const composer = document.querySelector<HTMLTextAreaElement>('[data-testid="agent-input-box"] textarea')!;
    expect(composer.value).toContain("[Task Companion:");
    expect(composer.value).toContain("Let's plan, review, and organize my tasks");
  });

  it("renders pet companion banner and triggers cheer on completion", () => {
    let cheered = false;
    window.addEventListener("bettergravity:pet-cheer", () => {
      cheered = true;
    });

    pluginInstance.openTasksView();

    const banner = document.querySelector(".bettergravity-tasks-pet-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("Rocky says:");

    const checkbox = document.querySelector<HTMLInputElement>(".bettergravity-task-checkbox")!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(cheered).toBe(true);
  });

  it("opens add task modal and adds a new task", () => {
    pluginInstance.openTasksView();

    const addBtn = document.querySelector<HTMLButtonElement>(".bettergravity-tasks-btn--primary")!;
    addBtn.click();

    const modal = document.querySelector<HTMLElement>(".bettergravity-tasks-modal");
    expect(modal).not.toBeNull();

    const titleInput = modal?.querySelector<HTMLInputElement>('input[type="text"]')!;
    titleInput.value = "New automated deliverable";

    const saveBtn = modal?.querySelector<HTMLButtonElement>(".bettergravity-tasks-modal__actions .bettergravity-tasks-btn--primary")!;
    saveBtn.click();

    expect(document.querySelector(".bettergravity-tasks-modal")).toBeNull();
    const tasks = pluginInstance.loadTasks();
    expect(tasks.some((t: any) => t.title === "New automated deliverable")).toBe(true);
  });
});
