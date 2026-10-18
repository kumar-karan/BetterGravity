/* ===========================================================================
 * Gemini Web UI & Argon Manager - BetterGravity Plugin
 * Embeds Gemini Web UI & connects Antigravity directly to gemini-4-argon
 * =========================================================================== */

const GEMINI_ICON = "M480-120q0-150-105-255t-255-105q150 0 255-105t105-255q0 150 105 255t255 105q-150 0-255 105t-105 255Z";

const settings = plugin.settings.define({
  apiKey: {
    type: "string",
    label: "CLI Proxy API Key",
    description: "Bearer key for CLI Proxy (default: 123456).",
    default: "123456",
    secret: true
  },
  baseUrl: {
    type: "string",
    label: "CLI Proxy Endpoint",
    description: "Loopback address of CLI Proxy serving Argon 4.",
    default: "http://127.0.0.1:8317",
    placeholder: "http://127.0.0.1:8317"
  },
  managerUrl: {
    type: "string",
    label: "Web UI Manager URL",
    description: "Address of the local Gemini Web UI daemon dashboard.",
    default: "http://127.0.0.1:8318",
    placeholder: "http://127.0.0.1:8318"
  },
  stream: {
    type: "boolean",
    label: "Stream replies",
    description: "Streams responses in real-time.",
    default: true
  },
  thoughts: {
    type: "boolean",
    label: "Show reasoning thinking",
    description: "Passes extended thinking and thoughts to Antigravity.",
    default: true
  },
  audit: {
    type: "boolean",
    label: "Keep request log",
    description: "Log outcome and size per request without sensitive content.",
    default: false
  }
});

// Configure Gemini translator so Antigravity chats connect directly to Argon
if (typeof plugin.gemini === "object" && plugin.gemini !== null) {
  plugin.gemini.configure({
    apiKey: String(settings.apiKey || "123456").trim(),
    baseUrl: String(settings.baseUrl || "http://127.0.0.1:8317").trim(),
    stream: settings.stream !== false,
    thoughts: settings.thoughts !== false,
    audit: settings.audit === true
  });
}

// Register sidebar button
const buttonHandle = plugin.ui.button({
  area: "sidebar",
  label: "Gemini UI",
  icon: " ",
  tooltip: "Gemini Web UI & Argon Manager",
  onClick: () => { if (page) closePage(); else openPage(); }
});

if (buttonHandle.element) {
  buttonHandle.element.id = "bettergravity-gemini-ui-button";
}
plugin.onDispose(() => buttonHandle.remove());

// Viewport state
let page = null;
let pageViewport = null;
let pageViewportObserver = null;
let pageDisposed = false;
let activeTab = "dashboard"; // "dashboard" or "web"
const hiddenChildren = new Map();

const VIEW = '[data-testid="conversation-view"]';

function findViewport() {
  const conversation = document.querySelector(VIEW);
  if (conversation && !conversation.closest('[role="navigation"], [aria-label="Sidebar"]')) {
    return conversation.parentElement === document.body ? conversation : conversation.parentElement;
  }
  const flexMain = document.querySelector('.flex-1.flex.flex-col.min-w-0.h-full');
  if (flexMain) {
    const vp = flexMain.querySelector('.flex-1.min-h-0') ?? flexMain.children[1];
    if (vp && !vp.closest('[role="navigation"], [aria-label="Sidebar"]')) return vp;
    return flexMain;
  }
  const roleMain = document.querySelector('main, [role="main"]');
  if (roleMain && !roleMain.closest('[role="navigation"], [aria-label="Sidebar"]')) return roleMain;
  return null;
}

function hideSiblings() {
  if (!pageViewport) return;
  for (const child of pageViewport.children) {
    if (child === page || hiddenChildren.has(child)) continue;
    hiddenChildren.set(child, {
      inert: child.inert === true,
      ariaHidden: child.getAttribute('aria-hidden')
    });
    child.setAttribute('data-gemini-ui-hidden', '');
    child.inert = true;
    child.setAttribute('aria-hidden', 'true');
  }
}

function closePage() {
  pageViewportObserver?.disconnect();
  pageViewportObserver = null;
  page?.remove();
  page = null;
  for (const [child, previous] of hiddenChildren) {
    child.removeAttribute('data-gemini-ui-hidden');
    child.inert = previous.inert;
    if (child.getAttribute('aria-hidden') === 'true') {
      if (previous.ariaHidden === null) child.removeAttribute('aria-hidden');
      else child.setAttribute('aria-hidden', previous.ariaHidden);
    }
  }
  hiddenChildren.clear();
  pageViewport?.removeAttribute('data-gemini-ui-host');
  pageViewport = null;
  buttonHandle.setActive(false);
  buttonHandle.element?.classList.remove('bg-sidebar-secondary');
}

function getThemeName() {
  return document.body.classList.contains('light-theme') ? 'light' : 'dark';
}

function renderContent() {
  const managerUrl = (settings?.managerUrl || "http://127.0.0.1:8318").replace(/\/+$/, "");

  page.innerHTML = `
    <header class="gemini-ui-header">
      <div class="gemini-ui-brand">
        <div class="gemini-ui-brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z"/>
          </svg>
        </div>
        <div>
          <h2 class="gemini-ui-title">Gemini Web UI &amp; Argon Manager</h2>
          <div class="gemini-ui-subtitle">Direct Argon 4 model orchestration and daemon dashboard</div>
        </div>
      </div>
      <div class="gemini-ui-header-actions">
        <div class="gemini-ui-tab-nav">
          <button class="gemini-ui-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}" id="gui-tab-dashboard">Dashboard</button>
          <button class="gemini-ui-tab-btn ${activeTab === 'web' ? 'active' : ''}" id="gui-tab-web">Live Web UI</button>
        </div>
        <button class="gemini-ui-btn-icon" id="gui-refresh-btn" title="Refresh Status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
        <button class="gemini-ui-btn-icon" id="gui-close-btn" title="Close View (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </header>

    <div class="gemini-ui-content">
      <!-- Native Dashboard -->
      <div class="gemini-ui-dashboard ${activeTab === 'dashboard' ? 'active' : ''}" id="gui-view-dashboard">
        <div class="gemini-ui-grid-2">
          <!-- Backend & Route Status -->
          <div class="gemini-ui-card">
            <div class="gemini-ui-card-header">
              <span class="gemini-ui-card-title">Backend &amp; Route Status</span>
              <span class="gemini-ui-badge gemini-ui-badge-info" id="gui-status-badge">Checking...</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">FastAPI Daemon (Port 8000)</span>
              <span class="gemini-ui-badge" id="gui-stat-fastapi">--</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">CLI Proxy Core (Port 8317)</span>
              <span class="gemini-ui-badge" id="gui-stat-cpa">--</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">Gemini Route (gemini-web)</span>
              <span class="gemini-ui-badge" id="gui-stat-route">--</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">Google Cookies (__Secure-1PSID)</span>
              <span class="gemini-ui-badge" id="gui-stat-cookies">--</span>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="gemini-ui-btn gemini-ui-btn-primary" id="gui-enable-btn" style="flex: 1;">Start &amp; Enable Route</button>
              <button class="gemini-ui-btn gemini-ui-btn-danger" id="gui-disable-btn" style="flex: 1;">Stop &amp; Disable</button>
            </div>
          </div>

          <!-- Keep-Alive Warmup Engine -->
          <div class="gemini-ui-card">
            <div class="gemini-ui-card-header">
              <span class="gemini-ui-card-title">Keep-Alive Warmup Engine</span>
              <span class="gemini-ui-badge gemini-ui-badge-success" id="gui-warmup-badge">Active</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">Warmup State</span>
              <span class="gemini-ui-val" id="gui-warmup-running">Running</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">Idle Seconds</span>
              <span class="gemini-ui-val" id="gui-warmup-idle">--</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">Total Warmup Pings</span>
              <span class="gemini-ui-val" id="gui-warmup-pings">--</span>
            </div>
            <div class="gemini-ui-row">
              <span class="gemini-ui-label">Last Ping Latency</span>
              <span class="gemini-ui-val" id="gui-warmup-latency">--</span>
            </div>
            <div style="margin-top: 10px;">
              <button class="gemini-ui-btn gemini-ui-btn-secondary" id="gui-ping-btn" style="width: 100%;">Ping Warmup Now</button>
            </div>
          </div>
        </div>

        <div class="gemini-ui-grid-2">
          <!-- Google Account Auth -->
          <div class="gemini-ui-card">
            <div class="gemini-ui-card-header">
              <span class="gemini-ui-card-title">Google Account Authentication</span>
            </div>
            <div>
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">1. One-Click Browser Login</div>
              <div style="font-size: 12px; color: var(--gemini-text-secondary, #8e918f); margin-bottom: 10px;">
                Launches Google Chrome with your profile to sign into Gemini Web and auto-extract session cookies.
              </div>
              <button class="gemini-ui-btn gemini-ui-btn-primary" id="gui-browser-login-btn">Launch Chrome Login</button>
              <div id="gui-login-status" style="margin-top: 6px; font-size: 12px; color: #60a5fa;"></div>
            </div>
            <div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 14px;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">2. Paste Cookies Directly</div>
              <div style="font-size: 12px; color: var(--gemini-text-secondary, #8e918f); margin-bottom: 8px;">
                Paste cookie string containing <code>__Secure-1PSID</code> and <code>__Secure-1PSIDTS</code>:
              </div>
              <textarea class="gemini-ui-textarea" id="gui-cookie-paste" rows="3" placeholder="Paste cookies here..."></textarea>
              <button class="gemini-ui-btn gemini-ui-btn-secondary" id="gui-cookie-save-btn" style="margin-top: 8px;">Save &amp; Reload Cookies</button>
            </div>
          </div>

          <!-- Argon Live Speed Benchmark -->
          <div class="gemini-ui-card">
            <div class="gemini-ui-card-header">
              <span class="gemini-ui-card-title">Argon Live Benchmark &amp; Model Tester</span>
            </div>
            <div style="display: flex; gap: 10px;">
              <select class="gemini-ui-select" id="gui-bench-model" style="flex: 1;">
                <option value="gemini-4-argon" selected>gemini-4-argon (Flagship Direct)</option>
                <option value="gemini-pro-advanced">gemini-pro-advanced</option>
                <option value="gemini-flash">gemini-flash</option>
              </select>
              <button class="gemini-ui-btn gemini-ui-btn-primary" id="gui-bench-btn">Run Benchmark</button>
            </div>
            <div style="font-size: 12px; color: var(--gemini-text-secondary, #8e918f); margin-top: 6px;">Output &amp; Streaming Metrics:</div>
            <div class="gemini-ui-terminal" id="gui-bench-output">Ready. Click 'Run Benchmark' to measure TTFT and token generation speed on gemini-4-argon.</div>
          </div>
        </div>

        <!-- Antigravity Direct Link Card -->
        <div class="gemini-ui-card">
          <div class="gemini-ui-card-header">
            <span class="gemini-ui-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Antigravity Chat Integration &bull; gemini-4-argon Direct Route
            </span>
            <span class="gemini-ui-badge gemini-ui-badge-success">Active &bull; http://127.0.0.1:8317</span>
          </div>
          <div style="font-size: 13px; line-height: 1.6; color: var(--gemini-text-secondary, #8e918f);">
            Chat queries from Antigravity are securely intercepted by BetterGravity's translator and routed directly to <code>gemini-4-argon</code> on CLI Proxy. No subscription quota is consumed. Extended thinking and reasoning are streamed live into your chat.
          </div>
        </div>
      </div>

      <!-- Live Web UI Iframe -->
      <div class="gemini-ui-iframe-container ${activeTab === 'web' ? 'active' : ''}" id="gui-view-web">
        <iframe class="gemini-ui-frame" id="gui-frame" src="${managerUrl}/?embedded=1&theme=${getThemeName()}"></iframe>
      </div>
    </div>
  `;

  // Wire Tab Navigation
  document.getElementById("gui-tab-dashboard").onclick = () => {
    activeTab = "dashboard";
    document.getElementById("gui-view-dashboard").classList.add("active");
    document.getElementById("gui-view-web").classList.remove("active");
    document.getElementById("gui-tab-dashboard").classList.add("active");
    document.getElementById("gui-tab-web").classList.remove("active");
    fetchStatus();
  };

  document.getElementById("gui-tab-web").onclick = () => {
    activeTab = "web";
    document.getElementById("gui-view-web").classList.add("active");
    document.getElementById("gui-view-dashboard").classList.remove("active");
    document.getElementById("gui-tab-web").classList.add("active");
    document.getElementById("gui-tab-dashboard").classList.remove("active");
  };

  document.getElementById("gui-refresh-btn").onclick = fetchStatus;
  document.getElementById("gui-close-btn").onclick = closePage;

  // Wire Actions
  document.getElementById("gui-enable-btn").onclick = function() {
    this.disabled = true;
    fetch(`${managerUrl}/api/enable`, { method: "POST" })
      .finally(() => { this.disabled = false; fetchStatus(); });
  };

  document.getElementById("gui-disable-btn").onclick = function() {
    this.disabled = true;
    fetch(`${managerUrl}/api/disable`, { method: "POST" })
      .finally(() => { this.disabled = false; fetchStatus(); });
  };

  document.getElementById("gui-ping-btn").onclick = function() {
    this.disabled = true;
    fetch(`${managerUrl}/api/ping-warmup`, { method: "POST" })
      .finally(() => { this.disabled = false; fetchStatus(); });
  };

  document.getElementById("gui-browser-login-btn").onclick = function() {
    this.disabled = true;
    const msg = document.getElementById("gui-login-status");
    if (msg) msg.textContent = "Launching Google Chrome... Sign into Gemini in the opened browser.";
    fetch(`${managerUrl}/api/browser-login/start`, { method: "POST" })
      .then(r => r.json())
      .then(d => {
        if (msg) msg.textContent = d.message || "Chrome launched. Waiting for login...";
        pollBrowserLogin();
      })
      .finally(() => { this.disabled = false; });
  };

  document.getElementById("gui-cookie-save-btn").onclick = function() {
    const raw = document.getElementById("gui-cookie-paste")?.value || "";
    if (!raw.trim()) return;
    this.disabled = true;
    fetch(`${managerUrl}/api/cookies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies: raw })
    })
      .then(() => { fetchStatus(); })
      .finally(() => { this.disabled = false; });
  };

  document.getElementById("gui-bench-btn").onclick = function() {
    const model = document.getElementById("gui-bench-model")?.value || "gemini-4-argon";
    const out = document.getElementById("gui-bench-output");
    if (out) out.textContent = `Running live benchmark against ${model}...`;
    this.disabled = true;
    fetch(`${managerUrl}/api/benchmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model })
    })
      .then(r => r.json())
      .then(d => {
        if (out) {
          out.textContent = `=== Benchmark Result for ${model} ===\n` +
            `Success: ${d.success ? "YES" : "NO"}\n` +
            `TTFT (Time to first token): ${d.ttft_seconds ? d.ttft_seconds.toFixed(2) + "s" : "--"}\n` +
            `Total Duration: ${d.duration_seconds ? d.duration_seconds.toFixed(2) + "s" : "--"}\n` +
            `Output Speed: ${d.tokens_per_second ? d.tokens_per_second.toFixed(1) + " tokens/s" : "--"}\n` +
            `Response Excerpt:\n${d.response || d.error || "No content returned"}`;
        }
      })
      .catch(err => {
        if (out) out.textContent = `Benchmark error: ${err.message}`;
      })
      .finally(() => { this.disabled = false; });
  };

  fetchStatus();
}

function pollBrowserLogin() {
  const managerUrl = (settings?.managerUrl || "http://127.0.0.1:8318").replace(/\/+$/, "");
  const interval = setInterval(() => {
    fetch(`${managerUrl}/api/browser-login/status`)
      .then(r => r.json())
      .then(st => {
        const msg = document.getElementById("gui-login-status");
        if (st.message && msg) msg.textContent = st.message;
        if (!st.running) {
          clearInterval(interval);
          fetchStatus();
        }
      })
      .catch(() => clearInterval(interval));
  }, 2000);
}

function fetchStatus() {
  const managerUrl = (settings?.managerUrl || "http://127.0.0.1:8318").replace(/\/+$/, "");
  fetch(`${managerUrl}/api/status`)
    .then(r => r.json())
    .then(st => {
      const isReady = st.fastapi_running && !st.gemini_route_disabled;
      const topBadge = document.getElementById("gui-status-badge");
      if (topBadge) {
        topBadge.textContent = isReady ? "Route Active" : "Route Offline";
        topBadge.className = `gemini-ui-badge ${isReady ? 'gemini-ui-badge-success' : 'gemini-ui-badge-danger'}`;
      }

      const setBadge = (id, ok, okTxt, badTxt) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = ok ? okTxt : badTxt;
        el.className = `gemini-ui-badge ${ok ? 'gemini-ui-badge-success' : 'gemini-ui-badge-danger'}`;
      };

      setBadge("gui-stat-fastapi", st.fastapi_running, "Running (8000)", "Offline");
      setBadge("gui-stat-cpa", st.cpa_running, "Running (8317)", "Offline");
      setBadge("gui-stat-route", !st.gemini_route_disabled, "Enabled", "Disabled");
      setBadge("gui-stat-cookies", st.has_credentials, `Valid (${st.psid_masked || "Active"})`, "Missing");

      if (st.warmup) {
        const wBadge = document.getElementById("gui-warmup-badge");
        if (wBadge) {
          wBadge.textContent = st.warmup.is_running ? "Active" : "Inactive";
          wBadge.className = `gemini-ui-badge ${st.warmup.is_running ? 'gemini-ui-badge-success' : 'gemini-ui-badge-danger'}`;
        }
        const wRun = document.getElementById("gui-warmup-running");
        if (wRun) wRun.textContent = st.warmup.is_running ? `Running (${st.warmup.interval_seconds}s interval)` : "Stopped";
        const wIdle = document.getElementById("gui-warmup-idle");
        if (wIdle) wIdle.textContent = `${Math.round(st.warmup.idle_seconds || 0)}s`;
        const wPings = document.getElementById("gui-warmup-pings");
        if (wPings) wPings.textContent = String(st.warmup.ping_count || 0);
        const wLat = document.getElementById("gui-warmup-latency");
        if (wLat) wLat.textContent = st.warmup.last_latency_seconds ? `${st.warmup.last_latency_seconds.toFixed(2)}s` : "--";
      }
    })
    .catch(() => {});
}

function openPage() {
  if (pageDisposed) return;
  if (page?.isConnected) return;

  const vp = findViewport();
  if (!vp) return;

  pageViewport = vp;
  page = document.createElement("div");
  page.id = "bettergravity-gemini-ui-view";
  page.setAttribute("data-bettergravity-view", "");

  hideSiblings();
  pageViewport.appendChild(page);
  pageViewport.setAttribute("data-gemini-ui-host", "");

  renderContent();
  buttonHandle.setActive(true);
  buttonHandle.element?.classList.add("bg-sidebar-secondary");

  pageViewportObserver?.disconnect();
  pageViewportObserver = new MutationObserver(() => {
    hideSiblings();
  });
  pageViewportObserver.observe(pageViewport, { childList: true });
}

// Global keydown for Escape
function handleKeydown(e) {
  if (e.key === "Escape" && page) {
    e.preventDefault();
    closePage();
  }
}
window.addEventListener("keydown", handleKeydown);

plugin.onDispose(() => {
  pageDisposed = true;
  window.removeEventListener("keydown", handleKeydown);
  closePage();
});
