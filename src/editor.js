/* =====================================================================
   SQL Quest — SQL editor
   A textarea with a syntax-highlighted layer behind it. No dependencies,
   no build step; just enough editing comfort to stay out of the way.
   ===================================================================== */

import { highlightSql } from "./format.js";

const DRAFT_PREFIX = "sqlquest.draft.";

function loadDraft(key) {
  if (!key) return null;
  try {
    return localStorage.getItem(DRAFT_PREFIX + key);
  } catch {
    return null;
  }
}

function saveDraft(key, value) {
  if (!key) return;
  try {
    if (value.trim()) localStorage.setItem(DRAFT_PREFIX + key, value);
    else localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ignore quota errors */
  }
}

export function clearDraft(key) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} options
 * @param {string} options.value        initial SQL
 * @param {number} options.height       editor height in px
 * @param {string} options.storageKey   persists the draft between visits
 * @param {function} options.onRun      Ctrl/Cmd+Enter
 * @param {string} options.hint         text shown in the toolbar
 * @param {Array}  options.buttons      [{label, className, onClick, title}]
 */
export function createEditor(options = {}) {
  const {
    value = "",
    height = 150,
    storageKey = "",
    onRun = null,
    hint = "Ctrl/⌘ + Enter to run",
    buttons = [],
  } = options;

  const wrap = document.createElement("div");
  wrap.className = "editor-wrap";
  wrap.style.setProperty("--editor-h", `${height}px`);

  const scroll = document.createElement("div");
  scroll.className = "editor-scroll";

  const highlight = document.createElement("pre");
  highlight.className = "editor-highlight";
  highlight.setAttribute("aria-hidden", "true");

  const input = document.createElement("textarea");
  input.className = "editor-input";
  input.spellcheck = false;
  input.autocapitalize = "off";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "SQL editor");
  input.value = loadDraft(storageKey) ?? value;

  scroll.append(highlight, input);

  const bar = document.createElement("div");
  bar.className = "editor-bar";

  const runBtn = document.createElement("button");
  runBtn.className = "btn primary small";
  runBtn.textContent = "▸ Run";
  bar.append(runBtn);

  for (const spec of buttons) {
    const btn = document.createElement("button");
    btn.className = spec.className || "btn small ghost";
    btn.textContent = spec.label;
    if (spec.title) btn.title = spec.title;
    btn.addEventListener("click", () => spec.onClick(api));
    bar.append(btn);
    spec.el = btn;
  }

  const spacer = document.createElement("span");
  spacer.className = "spacer";
  const hintEl = document.createElement("span");
  hintEl.className = "editor-hint";
  hintEl.textContent = hint;
  bar.append(spacer, hintEl);

  wrap.append(scroll, bar);

  function paint() {
    const text = input.value;
    highlight.innerHTML = highlightSql(text) + (text.endsWith("\n") ? " " : "");
    // grow the textarea so the caret never falls outside the scroll box
    input.style.height = "auto";
    input.style.height = `${Math.max(scroll.clientHeight, input.scrollHeight)}px`;
    highlight.style.height = input.style.height;
  }

  input.addEventListener("input", () => {
    paint();
    saveDraft(storageKey, input.value);
  });
  input.addEventListener("scroll", () => {
    highlight.scrollTop = input.scrollTop;
  });
  input.addEventListener("focus", () => wrap.classList.add("focused"));
  input.addEventListener("blur", () => wrap.classList.remove("focused"));

  input.addEventListener("keydown", (event) => {
    // Ctrl/Cmd + Enter runs
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (onRun) onRun(api);
      return;
    }
    // Tab indents instead of leaving the editor
    if (event.key === "Tab") {
      event.preventDefault();
      const { selectionStart: start, selectionEnd: end, value: text } = input;
      if (event.shiftKey) {
        const lineStart = text.lastIndexOf("\n", start - 1) + 1;
        if (text.slice(lineStart, lineStart + 2) === "  ") {
          input.value = text.slice(0, lineStart) + text.slice(lineStart + 2);
          input.selectionStart = input.selectionEnd = Math.max(lineStart, start - 2);
        }
      } else {
        input.value = `${text.slice(0, start)}  ${text.slice(end)}`;
        input.selectionStart = input.selectionEnd = start + 2;
      }
      paint();
      saveDraft(storageKey, input.value);
    }
  });

  runBtn.addEventListener("click", () => onRun && onRun(api));

  const api = {
    el: wrap,
    input,
    buttons,
    getValue: () => input.value,
    setValue(next, { persist = true } = {}) {
      input.value = next;
      paint();
      if (persist) saveDraft(storageKey, next);
    },
    reset() {
      api.setValue(value, { persist: false });
      clearDraft(storageKey);
    },
    focus: () => input.focus(),
    setBusy(busy) {
      runBtn.disabled = busy;
      runBtn.textContent = busy ? "Running…" : "▸ Run";
    },
  };

  // first paint once the element has been measured
  requestAnimationFrame(paint);
  paint();
  return api;
}
