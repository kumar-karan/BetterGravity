// BetterGravity Tasks & TODO Tracker Plugin
// Interactive Willow-styled task manager with real-time checklists and dedicated AI planning flow.

const VIEW_SELECTOR = '[data-testid="conversation-view"]';
const NEW_CHAT_SELECTOR = '[data-testid="new-conversation-button"]';
const COMPOSER_SELECTOR = '[data-testid="agent-input-box"] textarea, [data-testid="agent-input-box"] [contenteditable="true"]';

const CHECKLIST_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
</svg>`;

const SPARKLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zm6 11l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14zM6 14l.9 2.1L9 17l-2.1.9L6 20l-.9-2.1L3 17l2.1-.9L6 14z"/>
</svg>`;

const PLUS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
</svg>`;

const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
</svg>`;

let sidebarButton = null;
let tasksView = null;
let currentFilter = "all";
let hiddenSiblings = new Map();
let activeModal = null;

function loadTasks() {
  try {
    const raw = typeof window !== "undefined" && window.localStorage?.getItem("bettergravity:tasks");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  const stored = plugin.storage.get("tasksList", null);
  if (Array.isArray(stored) && stored.length > 0) {
    try {
      window.localStorage?.setItem("bettergravity:tasks", JSON.stringify(stored));
    } catch {}
    return stored;
  }

  // Default starter tasks for first launch
  const initial = [
    {
      id: "task-1",
      title: "Explore BetterGravity features and settings",
      description: "Check out the Willow UI redesign, theme studio, and pet companions.",
      status: "done",
      priority: "p2",
      category: "General",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    },
    {
      id: "task-2",
      title: "Plan current project milestones with the AI agent",
      description: "Click 'Plan with AI' to start a guided task breakdown conversation.",
      status: "todo",
      priority: "p1",
      category: "BetterGravity",
      createdAt: new Date().toISOString()
    }
  ];
  plugin.storage.set("tasksList", initial);
  try {
    window.localStorage?.setItem("bettergravity:tasks", JSON.stringify(initial));
  } catch {}
  return initial;
}

function saveTasks(tasks) {
  plugin.storage.set("tasksList", tasks);
  try {
    window.localStorage?.setItem("bettergravity:tasks", JSON.stringify(tasks));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("bettergravity:tasks-updated", { detail: tasks }));
  } catch {}
  renderTasksView();
}

function getViewport() {
  const conversation = document.querySelector(VIEW_SELECTOR);
  if (conversation) {
    return conversation.parentElement === document.body ? conversation : conversation.parentElement;
  }
  const main = document.querySelector(".flex-1.flex.flex-col.min-w-0.h-full");
  return main?.querySelector(".flex-1.min-h-0") ?? main?.children[1] ?? document.querySelector("main, [role='main']");
}

function openTasksView() {
  if (tasksView?.isConnected) return;
  const viewport = getViewport();
  if (!viewport) return;

  // Close any competing overlays (e.g. skills or pets)
  const skills = document.getElementById("gemini-skills-view");
  if (skills && skills.style.display !== "none") {
    document.getElementById("gemini-skills-button")?.click();
  }
  const pets = document.getElementById("bettergravity-pets-view");
  if (pets && pets.isConnected) {
    document.querySelector('[data-bettergravity-button="Pets"]')?.click();
  }

  hiddenSiblings.clear();
  viewport.setAttribute("data-tasks-page-host", "");
  if (getComputedStyle(viewport).position === "static") {
    viewport.setAttribute("data-tasks-page-positioned", "");
  }

  for (const child of Array.from(viewport.children)) {
    if (child === tasksView) continue;
    hiddenSiblings.set(child, {
      inert: child.inert === true,
      ariaHidden: child.getAttribute("aria-hidden"),
      display: child.style.display || ""
    });
    child.setAttribute("data-tasks-page-hidden", "");
    child.inert = true;
    child.setAttribute("aria-hidden", "true");
  }

  tasksView = document.createElement("section");
  tasksView.id = "bettergravity-tasks-view";
  tasksView.className = "bettergravity-tasks-page";
  viewport.appendChild(tasksView);

  sidebarButton?.setActive(true);
  sidebarButton?.element?.classList.add("bg-sidebar-secondary");
  renderTasksView();
}

function closeTasksView() {
  if (!tasksView) return;
  closeModal();
  tasksView.remove();
  tasksView = null;

  const viewport = getViewport();
  if (viewport) {
    viewport.removeAttribute("data-tasks-page-host");
    viewport.removeAttribute("data-tasks-page-positioned");
  }

  for (const [child, prev] of hiddenSiblings) {
    child.removeAttribute("data-tasks-page-hidden");
    child.inert = prev.inert;
    if (child.getAttribute("aria-hidden") === "true") {
      if (prev.ariaHidden === null) child.removeAttribute("aria-hidden");
      else child.setAttribute("aria-hidden", prev.ariaHidden);
    }
    // Respect AGENTS.md flexbox rule: never set inline display: block
    child.style.display = (prev.display === "" || prev.display === "none" || prev.display === "block") ? "" : prev.display;
  }
  hiddenSiblings.clear();

  sidebarButton?.setActive(false);
  sidebarButton?.element?.classList.remove("bg-sidebar-secondary");
}

function getActivePetName() {
  try {
    const petId = plugin.storage.get("selectedPet", "rocky");
    if (!petId) return "Pet";
    const clean = petId.replace(/^custom:/, "");
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  } catch {
    return "Pet";
  }
}

function startPlanningChat() {
  closeTasksView();
  const petName = getActivePetName();

  const newChatBtn = document.querySelector(NEW_CHAT_SELECTOR);
  if (newChatBtn) {
    newChatBtn.click();
  }

  // Allow router to mount new conversation
  setTimeout(() => {
    const composer = document.querySelector(COMPOSER_SELECTOR);
    if (composer) {
      const promptText = `[Task Companion: ${petName}] Hey ${petName}! Let's plan, review, and organize my tasks. Ask me clarifying questions about my deliverables, priorities, and deadlines, and update my BetterGravity task board!`;
      if ("value" in composer) {
        composer.value = promptText;
        composer.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        composer.textContent = promptText;
        composer.dispatchEvent(new Event("input", { bubbles: true }));
      }
      composer.focus();
    }
  }, 250);
}

function openAddTaskModal(existingTask = null) {
  closeModal();

  const backdrop = document.createElement("div");
  backdrop.className = "bettergravity-tasks-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "bettergravity-tasks-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const titleHeader = document.createElement("h2");
  titleHeader.textContent = existingTask ? "Edit Task" : "Add New Task";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Title";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "e.g., Review PR, Fix navigation bug...";
  titleInput.value = existingTask ? existingTask.title : "";
  titleLabel.appendChild(titleInput);

  const descLabel = document.createElement("label");
  descLabel.textContent = "Description (Optional)";
  const descInput = document.createElement("textarea");
  descInput.rows = 3;
  descInput.placeholder = "Additional notes, links, or context...";
  descInput.value = existingTask ? (existingTask.description || "") : "";
  descLabel.appendChild(descInput);

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "12px";

  const prioLabel = document.createElement("label");
  prioLabel.style.flex = "1";
  prioLabel.textContent = "Priority";
  const prioSelect = document.createElement("select");
  const priorities = [
    { val: "p0", label: "P0 · Urgent" },
    { val: "p1", label: "P1 · High" },
    { val: "p2", label: "P2 · Normal" },
    { val: "p3", label: "P3 · Low" }
  ];
  for (const p of priorities) {
    const opt = document.createElement("option");
    opt.value = p.val;
    opt.textContent = p.label;
    if (existingTask && existingTask.priority === p.val) opt.selected = true;
    else if (!existingTask && p.val === "p2") opt.selected = true;
    prioSelect.appendChild(opt);
  }
  prioLabel.appendChild(prioSelect);

  const catLabel = document.createElement("label");
  catLabel.style.flex = "1";
  catLabel.textContent = "Category";
  const catInput = document.createElement("input");
  catInput.type = "text";
  catInput.placeholder = "e.g., Work, BetterGravity";
  catInput.value = existingTask ? (existingTask.category || "General") : "General";
  catLabel.appendChild(catInput);

  row.append(prioLabel, catLabel);

  const actions = document.createElement("div");
  actions.className = "bettergravity-tasks-modal__actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "bettergravity-tasks-btn bettergravity-tasks-btn--secondary";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = closeModal;

  const saveBtn = document.createElement("button");
  saveBtn.className = "bettergravity-tasks-btn bettergravity-tasks-btn--primary";
  saveBtn.textContent = existingTask ? "Save Changes" : "Create Task";
  saveBtn.onclick = () => {
    const title = titleInput.value.trim();
    if (!title) return;

    const tasks = loadTasks();
    if (existingTask) {
      const idx = tasks.findIndex(t => t.id === existingTask.id);
      if (idx !== -1) {
        tasks[idx] = {
          ...tasks[idx],
          title,
          description: descInput.value.trim(),
          priority: prioSelect.value,
          category: catInput.value.trim() || "General",
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      tasks.unshift({
        id: "task-" + Math.random().toString(36).substring(2, 9),
        title,
        description: descInput.value.trim(),
        status: "todo",
        priority: prioSelect.value,
        category: catInput.value.trim() || "General",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    saveTasks(tasks);
    closeModal();
  };

  actions.append(cancelBtn, saveBtn);
  modal.append(titleHeader, titleLabel, descLabel, row, actions);
  backdrop.appendChild(modal);

  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };

  document.body.appendChild(backdrop);
  activeModal = backdrop;
  titleInput.focus();
}

function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

function renderTasksView() {
  if (!tasksView) return;
  tasksView.innerHTML = "";

  const container = document.createElement("div");
  container.className = "bettergravity-tasks-container";

  // 1. Header
  const header = document.createElement("div");
  header.className = "bettergravity-tasks-header";

  const titles = document.createElement("div");
  titles.className = "bettergravity-tasks-header__titles";
  const h1 = document.createElement("h1");
  h1.textContent = "Tasks & Priorities";
  const subtitle = document.createElement("p");
  subtitle.textContent = "Track your daily goals, sprint deliverables, and agent checklists.";
  titles.append(h1, subtitle);

  const actions = document.createElement("div");
  actions.className = "bettergravity-tasks-header__actions";

  const planBtn = document.createElement("button");
  planBtn.className = "bettergravity-tasks-btn bettergravity-tasks-btn--sparkle";
  planBtn.innerHTML = `${SPARKLE_ICON} Plan with AI`;
  planBtn.onclick = startPlanningChat;

  const addBtn = document.createElement("button");
  addBtn.className = "bettergravity-tasks-btn bettergravity-tasks-btn--primary";
  addBtn.innerHTML = `${PLUS_ICON} Add Task`;
  addBtn.onclick = () => openAddTaskModal();

  actions.append(planBtn, addBtn);
  header.append(titles, actions);
  container.appendChild(header);

  // 2. Tasks & Progress
  const tasks = loadTasks();
  const totalCount = tasks.length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // 3. Pet Companion Banner
  const petName = getActivePetName();
  const petBanner = document.createElement("div");
  petBanner.className = "bettergravity-tasks-pet-banner";
  let petSpeech = `Hey! I'm your task companion ${petName}. Ready to knock out some goals together?`;
  if (totalCount > 0 && doneCount === totalCount) {
    petSpeech = `Woohoo! All ${totalCount} tasks completed! You crushed it today! 🎉`;
  } else if (totalCount > 0) {
    petSpeech = `We've got ${totalCount - doneCount} active tasks left. Let's stay focused and finish strong!`;
  }
  petBanner.innerHTML = `
    <div class="bettergravity-tasks-pet-avatar">🐾</div>
    <div class="bettergravity-tasks-pet-bubble">
      <strong>${petName} says:</strong>
      <span>${petSpeech}</span>
    </div>
  `;
  container.appendChild(petBanner);

  if (totalCount > 0) {
    const progressCard = document.createElement("div");
    progressCard.className = "bettergravity-tasks-progress-card";

    const info = document.createElement("div");
    info.className = "bettergravity-tasks-progress-card__info";
    info.innerHTML = `<span><strong>${doneCount}</strong> of <strong>${totalCount}</strong> completed</span><span>${progressPct}% done</span>`;

    const bar = document.createElement("div");
    bar.className = "bettergravity-tasks-progress-card__bar";
    const fill = document.createElement("div");
    fill.className = "bettergravity-tasks-progress-card__fill";
    fill.style.width = `${progressPct}%`;
    bar.appendChild(fill);

    progressCard.append(info, bar);
    container.appendChild(progressCard);
  }

  // 3. Filter Pills
  const filters = document.createElement("div");
  filters.className = "bettergravity-tasks-filters";
  const filterOptions = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "done", label: "Done" },
    { key: "p0", label: "P0 Urgent" },
    { key: "p1", label: "P1 High" }
  ];

  for (const opt of filterOptions) {
    const pill = document.createElement("button");
    pill.className = `bettergravity-tasks-filter-pill ${currentFilter === opt.key ? "is-active" : ""}`;
    pill.textContent = opt.label;
    pill.onclick = () => {
      currentFilter = opt.key;
      renderTasksView();
    };
    filters.appendChild(pill);
  }
  container.appendChild(filters);

  // 4. Task List
  let filtered = tasks;
  if (currentFilter === "active") filtered = tasks.filter(t => t.status !== "done");
  else if (currentFilter === "done") filtered = tasks.filter(t => t.status === "done");
  else if (currentFilter === "p0") filtered = tasks.filter(t => t.priority === "p0");
  else if (currentFilter === "p1") filtered = tasks.filter(t => t.priority === "p1");

  const list = document.createElement("div");
  list.className = "bettergravity-tasks-list";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bettergravity-tasks-empty";
    empty.innerHTML = `${CHECKLIST_ICON}<p>No tasks found. Click "Add Task" or "Plan with AI" to get started.</p>`;
    list.appendChild(empty);
  } else {
    for (const task of filtered) {
      const card = document.createElement("div");
      card.className = `bettergravity-task-card ${task.status === "done" ? "is-done" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "bettergravity-task-checkbox";
      checkbox.checked = task.status === "done";
      checkbox.setAttribute("aria-label", `Mark ${task.title} as ${task.status === "done" ? "incomplete" : "complete"}`);
      checkbox.onchange = () => {
        task.status = checkbox.checked ? "done" : "todo";
        task.updatedAt = new Date().toISOString();
        if (task.status === "done") {
          task.completedAt = new Date().toISOString();
          window.dispatchEvent(new CustomEvent("bettergravity:pet-cheer", { detail: { action: "task-completed" } }));
        } else {
          delete task.completedAt;
        }
        saveTasks(tasks);
      };

      const body = document.createElement("div");
      body.className = "bettergravity-task-card__body";

      const titleRow = document.createElement("div");
      titleRow.className = "bettergravity-task-card__title-row";

      const title = document.createElement("span");
      title.className = "bettergravity-task-card__title";
      title.textContent = task.title;

      const priority = document.createElement("span");
      priority.className = `bettergravity-task-priority bettergravity-task-priority--${task.priority || "p2"}`;
      priority.textContent = (task.priority || "p2").toUpperCase();

      titleRow.append(title, priority);
      if (task.category) {
        const cat = document.createElement("span");
        cat.className = "bettergravity-task-category";
        cat.textContent = task.category;
        titleRow.appendChild(cat);
      }
      body.appendChild(titleRow);

      if (task.description) {
        const desc = document.createElement("div");
        desc.className = "bettergravity-task-card__desc";
        desc.textContent = task.description;
        body.appendChild(desc);
      }

      const actionsRow = document.createElement("div");
      actionsRow.className = "bettergravity-task-card__actions";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "bettergravity-task-action-btn bettergravity-task-action-btn--delete";
      deleteBtn.title = "Delete task";
      deleteBtn.innerHTML = TRASH_ICON;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        const nextTasks = tasks.filter(t => t.id !== task.id);
        saveTasks(nextTasks);
      };

      actionsRow.appendChild(deleteBtn);
      card.append(checkbox, body, actionsRow);

      card.ondblclick = () => openAddTaskModal(task);
      list.appendChild(card);
    }
  }

  container.appendChild(list);
  tasksView.appendChild(container);
}

// Global click handler to close tasks view on outside route change
function handleGlobalClick(e) {
  if (!tasksView) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target.closest("#bettergravity-tasks-view, [data-bettergravity-button='Tasks']")) return;
  if (target.closest(`${NEW_CHAT_SELECTOR}, [data-testid='history-button'], #gemini-skills-button, #gemini-scheduled-tasks-button, [data-bettergravity-button='Pets'], a[href*='/c/']`)) {
    closeTasksView();
  }
}

// Global keyboard handler (Escape closes modal or view)
function handleGlobalKeydown(e) {
  if (e.key === "Escape") {
    if (activeModal) {
      closeModal();
    } else if (tasksView) {
      closeTasksView();
    }
  }
}

// Register sidebar entry
sidebarButton = plugin.ui.button({
  area: "sidebar",
  label: "Tasks",
  icon: CHECKLIST_ICON,
  tooltip: "Tasks & Priorities",
  onClick: () => {
    if (tasksView) closeTasksView();
    else openTasksView();
  }
});

document.addEventListener("click", handleGlobalClick, true);
document.addEventListener("keydown", handleGlobalKeydown, true);

// Initialize tasks store on plugin startup so localStorage is populated immediately
loadTasks();

// Listen for updates from other surfaces (e.g. Pet HUD completing a task)
const handleTasksUpdated = () => {
  if (tasksView?.isConnected) {
    renderTasksView();
  }
};
window.addEventListener("bettergravity:tasks-updated", handleTasksUpdated);

plugin.onDispose(() => {
  closeTasksView();
  sidebarButton?.remove();
  document.removeEventListener("click", handleGlobalClick, true);
  document.removeEventListener("keydown", handleGlobalKeydown, true);
  window.removeEventListener("bettergravity:tasks-updated", handleTasksUpdated);
});
