/* =====================================================================
   SQL Quest — playground
   A persistent scratch database: write anything, break anything, reset.
   ===================================================================== */

import { execPlayground, resetPlayground, describeSchema } from "../db.js";
import { escapeHtml, resultTable, resultMeta } from "../format.js";
import { explainSqlError } from "../grader.js";
import { createEditor } from "../editor.js";
import * as store from "../store.js";
import { toast, questToast, levelUpBanner } from "../ui.js";
import { awardEvent } from "../game.js";

const STARTER = `-- Scratch space. This database keeps your changes until you reset it.
-- Ctrl/⌘ + Enter runs. Click a table on the left to peek inside it.

SELECT
  c.name AS category,
  COUNT(p.product_id) AS products,
  ROUND(AVG(p.unit_price), 2) AS avg_price
FROM categories AS c
LEFT JOIN products AS p ON p.category_id = c.category_id
GROUP BY c.category_id, c.name
ORDER BY products DESC, category;`;

export default async function renderPlayground(container) {
  const schema = await describeSchema();

  container.innerHTML = `
    <div class="breadcrumb"><a href="#/">Dashboard</a> · Playground</div>
    <h1>Playground</h1>
    <p class="muted">Anything you run here persists in a private copy of the sample database — including
    writes. Press <strong>Reset database</strong> to start over.</p>

    <div class="pg-layout">
      <aside class="pg-side">
        <h4>Tables</h4>
        <div id="pg-tables">
          ${schema
            .map(
              (table) => `
            <div class="pg-table" data-table="${escapeHtml(table.name)}" title="${table.rowCount} rows">
              ${escapeHtml(table.name)} <span class="faint">${table.rowCount}</span>
            </div>`
            )
            .join("")}
        </div>
        <h4>Saved snippets</h4>
        <div id="pg-snippets"></div>
      </aside>

      <div>
        <div id="pg-editor"></div>
        <div id="pg-output" class="result"></div>
      </div>
    </div>`;

  const output = container.querySelector("#pg-output");

  async function run(editor) {
    const sql = editor.getValue().trim();
    if (!sql) return;
    editor.setBusy(true);
    output.innerHTML = '<div class="msg info">Running…</div>';
    try {
      const result = await execPlayground(sql);
      store.recordAttempt("playground");
      const award = awardEvent("playground");
      for (const quest of award.quests || []) questToast(quest);
      if (award.levelUp) levelUpBanner(award.levelUp);
      if (!result.results.length) {
        output.innerHTML = `<div class="msg ok">Statement executed — ${result.rowsModified} row${
          result.rowsModified === 1 ? "" : "s"
        } changed. ${result.elapsed < 1 ? "<1" : result.elapsed.toFixed(0)} ms.</div>`;
      } else {
        output.innerHTML = result.results
          .map((set) => resultMeta(set, result.elapsed) + resultTable(set, { maxRows: 200 }))
          .join("");
      }
    } catch (err) {
      const tip = explainSqlError(err.message);
      output.innerHTML = `<div class="msg err">${escapeHtml(err.message)}</div>${
        tip ? `<div class="msg info">${tip}</div>` : ""
      }`;
    } finally {
      editor.setBusy(false);
    }
  }

  const editor = createEditor({
    value: STARTER,
    height: 240,
    storageKey: "playground",
    onRun: run,
    hint: "Ctrl/⌘ + Enter to run · changes persist until you reset",
    buttons: [
      {
        label: "💾 Save snippet",
        className: "btn small ghost",
        onClick: (api) => {
          const name = prompt("Name this snippet:");
          if (!name) return;
          store.saveSnippet(name.trim(), api.getValue());
          renderSnippets();
          toast("Snippet saved", "ok");
        },
      },
      {
        label: "↺ Reset database",
        className: "btn small ghost",
        title: "Restore the sample data",
        onClick: async () => {
          await resetPlayground();
          output.innerHTML = '<div class="msg ok">Database restored to its original state.</div>';
          toast("Sample database restored", "ok");
        },
      },
    ],
  });

  container.querySelector("#pg-editor").append(editor.el);

  function renderSnippets() {
    const list = container.querySelector("#pg-snippets");
    const saved = store.snippets();
    list.innerHTML = saved.length
      ? saved
          .map(
            (snippet) => `
        <div class="snippet-item">
          <button data-load="${escapeHtml(snippet.name)}">${escapeHtml(snippet.name)}</button>
          <span class="del" data-del="${escapeHtml(snippet.name)}" title="Delete">✕</span>
        </div>`
          )
          .join("")
      : '<div class="faint" style="padding:0 6px">Nothing saved yet.</div>';

    for (const button of list.querySelectorAll("[data-load]")) {
      button.addEventListener("click", () => {
        const snippet = store.snippets().find((s) => s.name === button.dataset.load);
        if (snippet) {
          editor.setValue(snippet.sql);
          editor.focus();
        }
      });
    }
    for (const del of list.querySelectorAll("[data-del]")) {
      del.addEventListener("click", () => {
        store.deleteSnippet(del.dataset.del);
        renderSnippets();
      });
    }
  }

  renderSnippets();

  for (const item of container.querySelectorAll(".pg-table")) {
    item.addEventListener("click", () => {
      editor.setValue(`SELECT * FROM ${item.dataset.table} LIMIT 20;`);
      run(editor);
    });
  }
}
