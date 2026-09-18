/* =====================================================================
   SQL Quest — application shell
   Routing, sidebar, search palette, theme. Everything runs client-side:
   the course, the database and your progress never leave the browser.
   ===================================================================== */

import { initEngine } from "./db.js";
import { MODULES, findLesson, searchIndex } from "./curriculum/index.js";
import { loadModuleContent } from "./content.js";
import * as store from "./store.js";
import { courseStats, moduleStats, lessonSolved, toast } from "./ui.js";
import { escapeHtml } from "./format.js";

import renderDashboard from "./views/dashboard.js";
import renderLesson from "./views/lesson.js";
import renderPlayground from "./views/playground.js";
import renderSchema from "./views/schema.js";
import renderReference from "./views/reference.js";
import renderProgress from "./views/progress.js";

const view = document.getElementById("view");
const sidebarInner = document.getElementById("sidebar-inner");

/* ----------------------------------------------------------------- theme */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.setTheme(theme);
}

document.getElementById("theme-btn").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

applyTheme(store.theme());

/* --------------------------------------------------------------- sidebar */

function buildSidebar() {
  const current = currentRoute();
  const activeLessonId = current.name === "lesson" ? current.param : null;
  const activeModuleId = activeLessonId ? (findLesson(activeLessonId) || {}).module?.id : null;

  sidebarInner.innerHTML = MODULES.map((mod) => {
    const stats = moduleStats(mod);
    const open = mod.id === activeModuleId || (!activeModuleId && mod.number === 1);
    return `
      <div class="mod ${open ? "open" : ""} ${stats.done ? "done" : ""}" data-module="${mod.id}">
        <button class="mod-head" type="button">
          <span class="chev">▶</span>
          <span class="mod-num">${stats.done ? "✓" : mod.number}</span>
          <span class="mod-title">${escapeHtml(mod.title)}</span>
          <span class="mod-pct">${stats.pct}%</span>
        </button>
        <ul class="mod-lessons">
          ${mod.lessons
            .map(
              (lesson) => `
            <li>
              <a href="#/lesson/${lesson.id}" class="${lesson.id === activeLessonId ? "active" : ""}">
                <span class="tick ${lessonSolved(lesson) ? "on" : ""}">${lessonSolved(lesson) ? "✓" : "○"}</span>
                <span>${escapeHtml(lesson.title)}</span>
              </a>
            </li>`
            )
            .join("")}
        </ul>
      </div>`;
  }).join("");

  for (const head of sidebarInner.querySelectorAll(".mod-head")) {
    head.addEventListener("click", () => head.closest(".mod").classList.toggle("open"));
  }
}

function updateRing() {
  const { pct } = courseStats();
  const circumference = 2 * Math.PI * 15.5;
  const ring = document.getElementById("ring-fg");
  ring.style.strokeDasharray = String(circumference);
  ring.style.strokeDashoffset = String(circumference * (1 - pct / 100));
  document.getElementById("ring-label").textContent = `${pct}%`;
}

store.subscribe(() => {
  buildSidebar();
  updateRing();
});

/* ---------------------------------------------------------------- router */

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, param] = hash.split("/");
  if (!name) return { name: "home" };
  return { name, param };
}

const ROUTES = {
  home: renderDashboard,
  lesson: renderLesson,
  playground: renderPlayground,
  schema: renderSchema,
  reference: renderReference,
  progress: renderProgress,
};

async function route() {
  const { name, param } = currentRoute();
  const render = ROUTES[name] || renderDashboard;

  for (const link of document.querySelectorAll(".top-nav a")) {
    link.classList.toggle("active", link.dataset.nav === (ROUTES[name] ? name : "home"));
  }

  document.getElementById("sidebar").classList.remove("open");
  buildSidebar();
  updateRing();

  view.innerHTML = '<div class="boot"><div class="spinner"></div></div>';
  try {
    await render(view, param);
  } catch (err) {
    view.innerHTML = `<div class="card"><h1>Something went wrong</h1><p class="muted">${escapeHtml(
      err.message
    )}</p><p><a href="#/">Back to the dashboard</a></p></div>`;
    console.error(err);
  }
  view.scrollIntoView({ block: "start" });
  window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", route);

/* --------------------------------------------------------- search palette */

let index = null;
const backdrop = document.getElementById("palette-backdrop");
const input = document.getElementById("palette-input");
const results = document.getElementById("palette-results");
let selected = 0;

async function ensureIndex() {
  if (index) return index;
  const prose = new Map();
  await Promise.all(
    MODULES.map(async (mod) => {
      try {
        prose.set(mod.id, await loadModuleContent(mod.id));
      } catch {
        /* a module's prose failing to load should not break search */
      }
    })
  );
  index = searchIndex(prose);
  return index;
}

function renderResults(query) {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = (index || [])
    .map((entry) => {
      if (!terms.length) return { entry, score: 1 };
      let score = 0;
      for (const term of terms) {
        if (entry.title.toLowerCase().includes(term)) score += 10;
        if (entry.goal.toLowerCase().includes(term)) score += 4;
        if (entry.haystack.includes(term)) score += 1;
        else if (!entry.title.toLowerCase().includes(term)) return { entry, score: -1 };
      }
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  selected = 0;
  results.innerHTML = scored.length
    ? scored
        .map(
          ({ entry }, i) => `
      <li data-id="${entry.id}" class="${i === 0 ? "sel" : ""}">
        ${escapeHtml(entry.title)}
        <small>Module ${entry.moduleNumber} · ${escapeHtml(entry.module)}${
            entry.goal ? ` — ${escapeHtml(entry.goal)}` : ""
          }</small>
      </li>`
        )
        .join("")
    : '<li class="faint" style="cursor:default">No lessons match that.</li>';

  for (const li of results.querySelectorAll("li[data-id]")) {
    li.addEventListener("click", () => {
      location.hash = `#/lesson/${li.dataset.id}`;
      closePalette();
    });
  }
}

async function openPalette() {
  backdrop.hidden = false;
  input.value = "";
  results.innerHTML = '<li class="faint" style="cursor:default">Loading lessons…</li>';
  input.focus();
  await ensureIndex();
  renderResults("");
}

function closePalette() {
  backdrop.hidden = true;
}

document.getElementById("search-btn").addEventListener("click", openPalette);
backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) closePalette();
});
input.addEventListener("input", () => renderResults(input.value));
input.addEventListener("keydown", (event) => {
  const items = [...results.querySelectorAll("li[data-id]")];
  if (event.key === "Escape") return closePalette();
  if (!items.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    items[selected]?.classList.remove("sel");
    selected = (selected + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
    items[selected].classList.add("sel");
    items[selected].scrollIntoView({ block: "nearest" });
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const item = items[selected];
    if (item) {
      location.hash = `#/lesson/${item.dataset.id}`;
      closePalette();
    }
  }
});

document.addEventListener("keydown", (event) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  if (event.key === "/" && !typing) {
    event.preventDefault();
    openPalette();
  }
  if (event.key === "Escape" && !backdrop.hidden) closePalette();
});

document.getElementById("menu-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

/* ------------------------------------------------------------------ boot */

(async function start() {
  buildSidebar();
  updateRing();
  try {
    await initEngine();
  } catch (err) {
    view.innerHTML = `
      <div class="card">
        <h1>The database engine could not start</h1>
        <p class="muted">${escapeHtml(err.message)}</p>
        <p>SQL Quest needs to be served over HTTP — opening <code>index.html</code> straight from the
        file system blocks both ES modules and WebAssembly. From the project folder run:</p>
        <div class="code-block"><pre><code>python3 -m http.server 8000</code></pre></div>
        <p>then open <a href="http://localhost:8000">http://localhost:8000</a>.</p>
      </div>`;
    return;
  }
  await route();
  // warm the search index in the background
  ensureIndex().catch(() => {});
  if (!store.getState().stats.firstSeen) {
    toast("Welcome! Everything runs locally in your browser.", "ok");
  }
})();
