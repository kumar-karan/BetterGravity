/* ===========================================================================
 * Flow Studio - BetterGravity Plugin
 * Option 4: Split Workstation Pro (Adaptive Main & Sidebar Layout)
 * Following native Antigravity theme & design tokens
 * =========================================================================== */

const FLOW_ICON = "M480-120q0-150-105-255t-255-105q150 0 255-105t105-255q0 150 105 255t255 105q-150 0-255 105t-105 255Z";

function describeStatus() {
  const history = plugin.storage.get("recentPrompts") || [];
  const model = settings?.model || "nano2";
  return `Model: ${model} | History: ${history.length} items`;
}

// Register sidebar button
const buttonHandle = plugin.ui.button({
  area: "sidebar",
  label: "Flow Studio",
  icon: " ",
  tooltip: "Google Flow Creative Studio",
  onClick: () => { if (page) closePage(); else openPage(); }
});
plugin.onDispose(() => buttonHandle.remove());

// Settings panel definition
const settings = plugin.settings.define({
  model: {
    type: "select",
    label: "Default model",
    default: "nano2",
    options: [
      { value: "nano2", label: "nano2 (Narwhal — Fast, 10 refs)" },
      { value: "nano-pro", label: "nano-pro (Gem Pix 2 — Balanced)" },
      { value: "image4", label: "image4 (Imagen 3.5 — Photoreal)" }
    ]
  },
  aspect: {
    type: "select",
    label: "Default aspect ratio",
    default: "1:1",
    options: [
      { value: "1:1", label: "1:1 Square" },
      { value: "9:16", label: "9:16 Phone Reel / Story" },
      { value: "16:9", label: "16:9 Cinema" },
      { value: "4:3", label: "4:3 Classic Photo" },
      { value: "3:4", label: "3:4 Portrait" }
    ]
  },
  status: {
    type: "note",
    label: "Status",
    read: () => describeStatus()
  }
});

// Storage init
if (!plugin.storage.get("recentPrompts")) {
  plugin.storage.set("recentPrompts", []);
}

// State variables
let page = null;
let pageRoot = null;
let pageViewport = null;
let pageViewportObserver = null;
let pageDisposed = false;
const hiddenChildren = new Map();

// App State
let currentModel = settings?.model || "nano2";
let currentAspect = settings?.aspect || "1:1";
let currentPrompt = "A sleek futuristic glowing neon prism cube icon floating on dark background, octane render 8k";
let currentPreviewImg = "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/neon_cube.jpg";

// Option 4 Model Cards Data
const models = [
  {
    id: "nano2",
    title: "Narwhal (nano2)",
    desc: "Fast generation (~12s) • 10 refs • Versatile"
  },
  {
    id: "nano-pro",
    title: "Gem Pix 2 (nano-pro)",
    desc: "Rich textures & micro-details • Balanced"
  },
  {
    id: "image4",
    title: "Imagen 3.5 (image4)",
    desc: "Photoreal flagship fidelity • Ultra detailed"
  }
];

// Aspect Ratios with Dimensions
const aspectRatios = [
  { id: "1:1", label: "1:1 Square", width: "230px", height: "230px" },
  { id: "9:16", label: "9:16 Reel", width: "160px", height: "284px" },
  { id: "16:9", label: "16:9 Cinema", width: "284px", height: "160px" },
  { id: "4:3", label: "4:3 Photo", width: "240px", height: "180px" },
  { id: "3:4", label: "3:4 Portrait", width: "180px", height: "240px" }
];

// Quick Styles
const stylePresets = [
  { label: "🎬 Cinematic", modifier: "cinematic 8k, anamorphic lens, dramatic lighting" },
  { label: "🏷️ Sticker", modifier: "die-cut 3d sticker, clean bold outline, glossy finish" },
  { label: "📸 Photoreal", modifier: "candid raw photography, 35mm lens, natural daylight" },
  { label: "🏺 3D Clay", modifier: "claymation style, soft matte clay texture" },
  { label: "👾 Cyberpunk", modifier: "cyberpunk neon lights, dark moody aesthetic" },
  { label: "🍙 Anime", modifier: "makoto shinkai aesthetic, vibrant anime lighting" }
];

// Curated Inspiration
const inspirationPrompts = [
  {
    prompt: "A cute chubby fat orange cat with round wire glasses and a small cozy green beret sitting at a miniature wooden desk reading an ancient spellbook, 3d render",
    model: "nano2",
    aspect: "1:1",
    img: "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/prof_chonks.png"
  },
  {
    prompt: "A sleek futuristic glowing neon prism cube floating on dark background, octane render 8k",
    model: "nano2",
    aspect: "1:1",
    img: "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/neon_cube.jpg"
  },
  {
    prompt: "6 full-body frames subtle breathing and blinking resting animation loop for cat companion, horizontal animation strip",
    model: "nano2",
    aspect: "16:9",
    img: "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/prof_chonks_idle.gif"
  },
  {
    prompt: "Cinematic macro shot of a bioluminescent glass frog with glowing constellations resting on a wet jungle leaf, 85mm f/1.4",
    model: "image4",
    aspect: "9:16",
    img: "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/neon_cube.jpg"
  }
];

// Default Gallery Creations
const defaultCreations = [
  {
    title: "Neon Prism Cube",
    prompt: "A sleek futuristic glowing neon prism cube icon floating on dark background, octane render 8k",
    model: "nano2",
    aspect: "1:1",
    img: "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/neon_cube.jpg"
  },
  {
    title: "Professor Chonks (Idle Loop)",
    prompt: "6 full-body frames subtle breathing and blinking resting animation loop, horizontal strip",
    model: "nano2",
    aspect: "16:9",
    img: "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/prof_chonks_idle.gif"
  },
  {
    title: "Professor Chonks (Base Mascot)",
    prompt: "A delightfully cute chubby round fat cat scholar sticker mascot wearing cute round glasses and a small cozy beret hat",
    model: "nano2",
    aspect: "1:1",
    img: "file:///Users/karankumar/Library/Application Support/BetterGravity/plugins/flow-studio/assets/prof_chonks.png"
  }
];

const VIEW = '[data-testid="conversation-view"]';

// Find the main chat/editor viewport (NOT sidebar)
function findViewport() {
  const conversation = document.querySelector(VIEW);
  if (conversation) {
    return conversation.parentElement === document.body ? conversation : conversation.parentElement;
  }
  const cascade = document.querySelector('[data-cascade-id]');
  if (cascade) {
    return cascade.parentElement === document.body ? cascade : cascade.parentElement;
  }
  const main = document.querySelector('.flex-1.flex.flex-col.min-w-0.h-full');
  if (main) {
    return main.querySelector('.flex-1.min-h-0') ?? main.children[1] ?? main;
  }
  return document.querySelector('main, [role="main"]') ?? document.body;
}

// Hide siblings when Flow Studio is open
function hideSiblings() {
  if (!pageViewport) return;
  for (const child of pageViewport.children) {
    if (child === page || hiddenChildren.has(child)) continue;
    hiddenChildren.set(child, {
      inert: child.inert === true,
      ariaHidden: child.getAttribute('aria-hidden')
    });
    child.setAttribute('data-flow-page-hidden', '');
    child.inert = true;
    child.setAttribute('aria-hidden', 'true');
  }
}

// Close Flow Studio page
function closePage() {
  pageViewportObserver?.disconnect();
  pageViewportObserver = null;
  page?.remove();
  page = null;
  pageRoot = null;
  for (const [child, previous] of hiddenChildren) {
    child.removeAttribute('data-flow-page-hidden');
    child.inert = previous.inert;
    if (child.getAttribute('aria-hidden') === 'true') {
      if (previous.ariaHidden === null) child.removeAttribute('aria-hidden');
      else child.setAttribute('aria-hidden', previous.ariaHidden);
    }
  }
  hiddenChildren.clear();
  pageViewport?.removeAttribute('data-flow-page-host');
  pageViewport?.removeAttribute('data-flow-page-positioned');
  pageViewport = null;
  document.body.classList.remove('bettergravity-flow-studio-open');
  buttonHandle.setActive(false);
}

// Open page & mount
function openPage() {
  if (pageDisposed) return;
  if (page?.isConnected) return;

  // If Pets library is open, close it cleanly
  const petView = document.getElementById('bettergravity-pets-view');
  if (petView) {
    const petBtn = document.querySelector('[data-bettergravity-button="Pets"]');
    if (petBtn) petBtn.click();
    else petView.remove();
  }

  // Close other custom views
  const skills = document.getElementById('gemini-skills-view');
  if (skills && skills.style.display !== 'none') document.getElementById('gemini-skills-button')?.click();

  for (const customView of document.querySelectorAll('[id$="-view"], [id$="-page"]')) {
    if (customView !== page && customView.id !== 'bettergravity-flow-studio-view' && customView.isConnected && customView.style.display !== 'none') {
      const btnId = customView.id.replace(/-view$|-page$/, '-button');
      const btn = document.getElementById(btnId);
      if (btn) btn.click();
      else customView.style.display = 'none';
    }
  }

  const viewport = findViewport();
  if (!viewport || viewport === document.body) return;
  closePage();
  window.BetterGravity?.panel?.close();
  pageViewport = viewport;
  pageViewport.setAttribute('data-flow-page-host', '');
  if (getComputedStyle(viewport).position === 'static') pageViewport.setAttribute('data-flow-page-positioned', '');
  page = el('section', 'bettergravity-flow-studio-page');
  page.id = 'bettergravity-flow-studio-view';
  page.setAttribute('role', 'region');
  page.setAttribute('aria-labelledby', 'bettergravity-flow-studio-title');
  pageRoot = el('div', 'bettergravity-flow-studio');
  page.append(pageRoot);
  pageViewport.append(page);
  hideSiblings();
  pageViewportObserver = new MutationObserver(hideSiblings);
  pageViewportObserver.observe(pageViewport, { childList: true });
  document.body.classList.add('bettergravity-flow-studio-open');
  buttonHandle.setActive(true);

  // Sync state defaults
  currentModel = settings?.model || "nano2";
  currentAspect = settings?.aspect || "1:1";

  renderPage();
  pageRoot.querySelector('h1')?.focus({ preventScroll: true });
}

// Pure DOM Element Factory
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Generate the ready-to-run gflow command
function getCommandString() {
  const p = currentPrompt.trim() ? currentPrompt.replace(/"/g, '\\"') : "A sleek glowing icon";
  return `/Users/karankumar/.local/bin/gflow image t2i --model ${currentModel} --aspect ${currentAspect} "${p}"`;
}

// Option 4: Split Workstation Pro Renderer
function renderPage() {
  if (!pageRoot) return;
  pageRoot.innerHTML = '';

  // 1. Header (Native Antigravity Header)
  const header = el('header', 'flow-studio__header');
  const title = el('h1', '', 'Flow Studio');
  title.id = 'bettergravity-flow-studio-title';
  title.tabIndex = -1;
  header.append(title, el('p', '', 'Generate images and visuals using Google Flow\'s latest models.'));
  pageRoot.append(header);

  // 2. Action Bar (Native Pill Buttons)
  const actions = el('div', 'flow-studio__actions');
  
  const copyBtn = el('button', 'flow-studio__button is-primary');
  const copySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  copySvg.setAttribute('viewBox', '0 -960 960 960');
  copySvg.setAttribute('fill', 'currentColor');
  const copyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  copyPath.setAttribute('d', 'M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z');
  copySvg.append(copyPath);
  const copySpan = el('span', '', 'Copy gflow Command');
  copyBtn.append(copySvg, copySpan);

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(getCommandString());
    copySpan.textContent = '✓ Copied to Clipboard!';
    setTimeout(() => { copySpan.textContent = 'Copy gflow Command'; }, 2000);

    if (currentPrompt.trim()) {
      const history = plugin.storage.get("recentPrompts") || [];
      const filtered = history.filter(h => h.prompt !== currentPrompt.trim());
      filtered.unshift({
        prompt: currentPrompt.trim(),
        model: currentModel,
        aspect: currentAspect,
        timestamp: new Date().toISOString()
      });
      if (filtered.length > 20) filtered.length = 20;
      plugin.storage.set("recentPrompts", filtered);
    }
  };

  const inspireBtn = el('button', 'flow-studio__button is-quiet', 'Inspiration 🎲');
  inspireBtn.onclick = () => {
    const item = inspirationPrompts[Math.floor(Math.random() * inspirationPrompts.length)];
    currentPrompt = item.prompt;
    currentModel = item.model;
    currentAspect = item.aspect;
    currentPreviewImg = item.img;
    renderPage();
  };

  const clearBtn = el('button', 'flow-studio__button is-quiet', 'Clear ✕');
  clearBtn.onclick = () => {
    currentPrompt = '';
    renderPage();
  };

  actions.append(copyBtn, inspireBtn, clearBtn);
  pageRoot.append(actions);

  // 3. Option 4: Split Workstation Pro Grid
  const workstation = el('div', 'flow-studio__workstation');

  // -------------------------------------------------------------
  // Left Column: Parameters, Model Engine Cards, Prompt Builder
  // -------------------------------------------------------------
  const controlsCol = el('div', 'flow-studio__controls-col');

  // Model Engine Cards (Option 4 signature cards)
  const modelSection = el('div', 'flow-studio__group');
  modelSection.append(el('div', 'flow-studio__group-title', 'Model Engine'));
  const modelCardsWrap = el('div', 'flow-studio__model-cards');

  models.forEach(m => {
    const isSelected = currentModel === m.id;
    const card = el('div', `flow-studio__model-card${isSelected ? ' is-selected' : ''}`);

    const infoWrap = el('div', 'flow-studio__model-info');
    const modelTitle = el('div', 'flow-studio__model-name', m.title);
    const modelDesc = el('div', 'flow-studio__model-desc', m.desc);
    infoWrap.append(modelTitle, modelDesc);

    const checkmark = el('div', 'flow-studio__model-check', isSelected ? '✓' : '');
    card.append(infoWrap, checkmark);

    card.onclick = () => {
      currentModel = m.id;
      badge.textContent = `${currentModel.toUpperCase()} • ${currentAspect}`;
      codeNode.textContent = getCommandString();
      modelCardsWrap.querySelectorAll('.flow-studio__model-card').forEach(c => {
        c.classList.remove('is-selected');
        c.querySelector('.flow-studio__model-check').textContent = '';
      });
      card.classList.add('is-selected');
      checkmark.textContent = '✓';
    };

    modelCardsWrap.append(card);
  });
  modelSection.append(modelCardsWrap);

  // Aspect Ratio Picker
  const aspectSection = el('div', 'flow-studio__group');
  aspectSection.append(el('div', 'flow-studio__group-title', 'Aspect Ratio'));
  const aspectPills = el('div', 'flow-studio__pills');

  aspectRatios.forEach(a => {
    const chip = el('button', `flow-studio__chip${currentAspect === a.id ? ' is-selected' : ''}`, a.label);
    chip.onclick = () => {
      currentAspect = a.id;
      frame.style.width = a.width;
      frame.style.height = a.height;
      badge.textContent = `${currentModel.toUpperCase()} • ${currentAspect}`;
      codeNode.textContent = getCommandString();
      aspectPills.querySelectorAll('.flow-studio__chip').forEach(c => c.classList.remove('is-selected'));
      chip.classList.add('is-selected');
    };
    aspectPills.append(chip);
  });
  aspectSection.append(aspectPills);

  // Quick Style Presets
  const styleSection = el('div', 'flow-studio__group');
  styleSection.append(el('div', 'flow-studio__group-title', 'Quick Styles'));
  const stylePills = el('div', 'flow-studio__pills');
  stylePresets.forEach(s => {
    const chip = el('button', 'flow-studio__chip', s.label);
    chip.onclick = () => {
      currentPrompt = currentPrompt.trim() ? `${currentPrompt.trim()}, ${s.modifier}` : s.modifier;
      textarea.value = currentPrompt;
      caption.textContent = `"${currentPrompt}"`;
      codeNode.textContent = getCommandString();
    };
    stylePills.append(chip);
  });
  styleSection.append(stylePills);

  // Prompt Textarea
  const promptSection = el('div', 'flow-studio__group');
  promptSection.append(el('div', 'flow-studio__group-title', 'Prompt'));
  const inputBox = el('div', 'flow-studio__input-box');
  const textarea = el('textarea', 'flow-studio__textarea');
  textarea.placeholder = 'Describe what you want to generate with Google Flow...';
  textarea.value = currentPrompt;
  textarea.oninput = (e) => {
    currentPrompt = e.target.value;
    caption.textContent = `"${currentPrompt || 'A sleek futuristic glowing icon...'}"`;
    codeNode.textContent = getCommandString();
  };
  inputBox.append(textarea);
  promptSection.append(inputBox);

  controlsCol.append(modelSection, aspectSection, styleSection, promptSection);

  // -------------------------------------------------------------
  // Right Column: Canvas Stage & Live Command Strip
  // -------------------------------------------------------------
  const canvasCol = el('div', 'flow-studio__canvas-col');

  const stageWrap = el('div', 'flow-studio__stage-wrap');
  const activeAspectObj = aspectRatios.find(a => a.id === currentAspect) || aspectRatios[0];
  const frame = el('div', 'flow-studio__frame');
  frame.style.width = activeAspectObj.width;
  frame.style.height = activeAspectObj.height;

  const img = el('img');
  img.src = currentPreviewImg;
  img.alt = 'Generation Preview';

  const badge = el('div', 'flow-studio__badge', `${currentModel.toUpperCase()} • ${currentAspect}`);
  frame.append(img, badge);

  const caption = el('div', 'flow-studio__caption', `"${currentPrompt || 'A sleek futuristic glowing icon...'}"`);
  stageWrap.append(frame, caption);
  canvasCol.append(stageWrap);

  // Live Monospace Command Strip with Instant Copy Button
  const commandStrip = el('div', 'flow-studio__command-strip');
  const codeNode = el('div', 'flow-studio__code', getCommandString());
  const miniCopy = el('button', 'flow-studio__button is-quiet', 'Copy');
  miniCopy.onclick = () => copyBtn.click();
  commandStrip.append(codeNode, miniCopy);
  canvasCol.append(commandStrip);

  workstation.append(controlsCol, canvasCol);
  pageRoot.append(workstation);

  // 4. Available Creations List (Matching Pets Library Row Treatments)
  const available = el('section', 'flow-studio__available');
  const list = el('div', 'flow-studio__list');
  const heading = el('h2', '', `Available creations (${defaultCreations.length})`);
  available.append(heading);

  defaultCreations.forEach(item => {
    const row = el('div', 'flow-studio__row');

    const thumb = el('div', 'flow-studio__thumbnail');
    const thumbImg = el('img');
    thumbImg.src = item.img;
    thumbImg.alt = item.title;
    thumb.append(thumbImg);

    const details = el('div', 'flow-studio__details');
    details.append(el('strong', '', item.title), el('span', '', `${item.model} • ${item.aspect} — ${item.prompt}`));

    const selectBtn = el('button', 'flow-studio__button', 'Reuse');
    selectBtn.onclick = (e) => {
      e.stopPropagation();
      currentPrompt = item.prompt;
      currentModel = item.model;
      currentAspect = item.aspect;
      currentPreviewImg = item.img;
      renderPage();
    };

    row.onclick = () => selectBtn.click();
    row.append(thumb, details, selectBtn);
    list.append(row);
  });

  available.append(list);
  pageRoot.append(available);
}

// Close on navigation
const leaveOnClick = event => {
  if (!page) return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest('#bettergravity-flow-studio-view, [data-bettergravity-button="Flow Studio"]')) return;
  if (target.closest('a[href*="/c/"], [role="navigation"] a, [role="navigation"] button:not([data-bettergravity-button="Flow Studio"]), [data-bettergravity-button="Pets"], [data-testid="history-button"], [data-testid="new-chat-button"]')) {
    closePage();
  }
};

document.addEventListener('click', leaveOnClick, true);
window.addEventListener('popstate', closePage);
window.addEventListener('hashchange', closePage);

plugin.onDispose(() => {
  document.removeEventListener('click', leaveOnClick, true);
  window.removeEventListener('popstate', closePage);
  window.removeEventListener('hashchange', closePage);
});

plugin.onDispose(() => {
  pageDisposed = true;
  closePage();
});
