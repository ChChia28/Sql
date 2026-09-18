/* =====================================================================
   SQL Quest — schema explorer
   ===================================================================== */

import { describeSchema, execIsolated } from "../db.js";
import { escapeHtml, resultTable, highlightSql } from "../format.js";

export default async function renderSchema(container) {
  const schema = await describeSchema();

  const relationships = schema.flatMap((table) =>
    table.columns
      .filter((column) => column.fk)
      .map((column) => ({
        from: `${table.name}.${column.name}`,
        to: `${column.fk.table}.${column.fk.to || "rowid"}`,
      }))
  );

  container.innerHTML = `
    <div class="breadcrumb"><a href="#/">Dashboard</a> · Schema</div>
    <h1>The sample database</h1>
    <p class="muted">An online music-gear shop: ${schema.length} tables, a nested category tree, a
    self-referencing employee hierarchy, deliberate NULLs and a JSON column. Click a table to preview its rows.</p>

    <div class="card">
      <h3 style="margin-bottom:.6em">How the tables connect</h3>
      <ul class="prose" style="margin:0; columns: 2; column-gap: 32px">
        ${relationships
          .map(
            (rel) =>
              `<li style="break-inside:avoid"><code>${escapeHtml(rel.from)}</code> → <code>${escapeHtml(
                rel.to
              )}</code></li>`
          )
          .join("")}
      </ul>
    </div>

    <div class="schema-grid" id="schema-grid">
      ${schema
        .map(
          (table) => `
        <div class="tbl-card" data-table="${escapeHtml(table.name)}">
          <h3>${escapeHtml(table.name)} <em>${table.rowCount.toLocaleString()} rows</em></h3>
          <ul class="col-list">
            ${table.columns
              .map(
                (column) => `
              <li>
                <span class="col-name">${escapeHtml(column.name)}</span>
                ${column.pk ? '<span class="key pk">PK</span>' : ""}
                ${column.fk ? `<span class="key fk" title="→ ${escapeHtml(column.fk.table)}">FK</span>` : ""}
                ${column.notNull && !column.pk ? '<span class="key nn">required</span>' : ""}
                <span class="col-type">${escapeHtml(column.type.toLowerCase())}</span>
              </li>`
              )
              .join("")}
          </ul>
          <div style="padding:8px 12px; border-top:1px solid var(--border-soft)" class="row">
            <button class="btn small ghost" data-preview="${escapeHtml(table.name)}">Preview rows</button>
            <button class="btn small ghost" data-ddl="${escapeHtml(table.name)}">Show DDL</button>
          </div>
          <div data-out="${escapeHtml(table.name)}"></div>
        </div>`
        )
        .join("")}
    </div>`;

  for (const button of container.querySelectorAll("[data-preview]")) {
    button.addEventListener("click", async () => {
      const name = button.dataset.preview;
      const out = container.querySelector(`[data-out="${CSS.escape(name)}"]`);
      out.innerHTML = '<div class="faint" style="padding:10px 12px">Loading…</div>';
      const run = await execIsolated(`SELECT * FROM ${name} LIMIT 8;`);
      out.innerHTML = run.ok
        ? resultTable(run.main.results[0], { maxRows: 8, rowNumbers: false })
        : `<div class="msg err">${escapeHtml(run.error)}</div>`;
    });
  }

  for (const button of container.querySelectorAll("[data-ddl]")) {
    button.addEventListener("click", () => {
      const name = button.dataset.ddl;
      const table = schema.find((t) => t.name === name);
      const out = container.querySelector(`[data-out="${CSS.escape(name)}"]`);
      out.innerHTML = `<pre style="margin:0;padding:12px;overflow-x:auto;font-size:.78rem">${highlightSql(
        table.ddl || ""
      )}</pre>`;
    });
  }
}
