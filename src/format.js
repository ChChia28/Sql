/* =====================================================================
   SQL Quest — formatting helpers
   A tiny markdown subset for lesson prose, a SQL tokeniser used by both
   the highlighter and the editor, and the result-grid renderer.
   ===================================================================== */

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* --------------------------------------------------------------- SQL --- */

const KEYWORDS = new Set(`
ADD ALL ALTER AND AS ASC ATTACH AUTOINCREMENT BEGIN BETWEEN BY CASCADE CASE CAST
CHECK COLLATE COLUMN COMMIT CONFLICT CONSTRAINT CREATE CROSS CURRENT DATABASE
DEFAULT DEFERRABLE DELETE DESC DETACH DISTINCT DO DROP EACH ELSE END ESCAPE EXCEPT
EXCLUDE EXISTS EXPLAIN FILTER FIRST FOLLOWING FOR FOREIGN FROM FULL GENERATED GLOB
GROUP GROUPS HAVING IF IGNORE IMMEDIATE IN INDEX INDEXED INNER INSERT INSTEAD
INTERSECT INTO IS ISNULL JOIN KEY LAST LEFT LIKE LIMIT MATCH MATERIALIZED NATURAL
NO NOT NOTHING NOTNULL NULL NULLS OF OFFSET ON OR ORDER OTHERS OUTER OVER PARTITION
PLAN PRAGMA PRECEDING PRIMARY QUERY RAISE RANGE RECURSIVE REFERENCES REGEXP REINDEX
RELEASE RENAME REPLACE RESTRICT RETURNING RIGHT ROLLBACK ROW ROWS SAVEPOINT SELECT
SET TABLE TEMP TEMPORARY THEN TIES TO TRANSACTION TRIGGER UNBOUNDED UNION UNIQUE
UPDATE USING VACUUM VALUES VIEW VIRTUAL WHEN WHERE WINDOW WITH WITHOUT
INTEGER TEXT REAL BLOB NUMERIC BOOLEAN DATE DATETIME VARCHAR CHAR DECIMAL
`.trim().split(/\s+/));

const FUNCTIONS = new Set(`
ABS AVG CEIL CEILING CHANGES CHAR COALESCE CONCAT CONCAT_WS COUNT CUME_DIST
CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATE DATETIME DENSE_RANK FIRST_VALUE
FLOOR FORMAT GROUP_CONCAT HEX IFNULL IIF INSTR JSON JSON_ARRAY JSON_ARRAY_LENGTH
JSON_EACH JSON_EXTRACT JSON_GROUP_ARRAY JSON_GROUP_OBJECT JSON_INSERT JSON_OBJECT
JSON_PATCH JSON_QUOTE JSON_REMOVE JSON_REPLACE JSON_SET JSON_TREE JSON_TYPE
JSON_VALID JULIANDAY LAG LAST_VALUE LEAD LENGTH LIKELIHOOD LOWER LTRIM MAX MIN
NTH_VALUE NTILE NULLIF PERCENT_RANK PRINTF QUOTE RANDOM RANK REPLACE ROUND ROW_NUMBER
RTRIM SIGN SQRT STRFTIME STRING_AGG SUBSTR SUBSTRING SUM TIME TIMEDIFF TOTAL TRIM
TYPEOF UNICODE UNIXEPOCH UPPER
`.trim().split(/\s+/));

const TOKEN_RE = new RegExp(
  [
    "(--[^\\n]*)",                 // line comment
    "(/\\*[\\s\\S]*?\\*/)",        // block comment
    "('(?:[^']|'')*')",            // string literal
    '("(?:[^"]|"")*")',            // quoted identifier
    "(\\b\\d+\\.?\\d*\\b)",        // number
    "([A-Za-z_][A-Za-z_0-9$]*)",   // word
    "([(),;.*=<>!+\\-/%|]+)",      // operator / punctuation
    "(\\s+)",                      // whitespace
  ].join("|"),
  "g"
);

/** Highlight SQL as HTML (already escaped). */
export function highlightSql(sql) {
  let out = "";
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(sql)) !== null) {
    if (m.index > last) out += escapeHtml(sql.slice(last, m.index));
    last = m.index + m[0].length;
    const [, lineComment, blockComment, str, ident, num, word, op, ws] = m;
    const text = escapeHtml(m[0]);
    if (lineComment || blockComment) out += `<span class="tok-com">${text}</span>`;
    else if (str) out += `<span class="tok-str">${text}</span>`;
    else if (ident) out += `<span class="tok-id">${text}</span>`;
    else if (num) out += `<span class="tok-num">${text}</span>`;
    else if (word) {
      const upper = word.toUpperCase();
      if (KEYWORDS.has(upper)) out += `<span class="tok-kw">${text}</span>`;
      else if (FUNCTIONS.has(upper)) out += `<span class="tok-fn">${text}</span>`;
      else out += `<span class="tok-id">${text}</span>`;
    } else if (op) out += `<span class="tok-op">${text}</span>`;
    else out += ws ? text : text;
  }
  if (last < sql.length) out += escapeHtml(sql.slice(last));
  return out;
}

/** A code block with a header and (optionally) a Run button. */
export function codeBlock(sql, { runnable = true, label = "SQL", id = "" } = {}) {
  const runBtn = runnable
    ? `<button class="btn small ghost run-sql" data-sql="${escapeHtml(sql)}">▸ Run</button>`
    : "";
  return `
  <div class="code-block" ${id ? `id="${id}"` : ""}>
    <div class="code-head"><span>${escapeHtml(label)}</span><span class="spacer"></span>${runBtn}</div>
    <pre><code>${highlightSql(sql)}</code></pre>
    <div class="code-out" hidden></div>
  </div>`;
}

/* ---------------------------------------------------------- markdown --- */

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

/**
 * Render the lesson-flavoured markdown subset: headings, paragraphs, lists,
 * tables, blockquote callouts and fenced SQL blocks (which become runnable).
 */
export function renderMarkdown(source) {
  const lines = String(source).replace(/\r/g, "").split("\n");
  const html = [];
  let i = 0;

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // fenced code
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      const code = body.join("\n");
      if (lang === "sql" || lang === "") {
        html.push(codeBlock(code, { runnable: lang === "sql", label: lang === "sql" ? "SQL" : "example" }));
      } else if (lang === "sql-static") {
        html.push(codeBlock(code, { runnable: false, label: "SQL" }));
      } else if (lang === "sql-error") {
        // deliberately invalid: running it is the lesson
        html.push(codeBlock(code, { runnable: true, label: "SQL — this one fails on purpose" }));
      } else {
        html.push(`<div class="code-block"><div class="code-head"><span>${escapeHtml(lang)}</span></div><pre><code>${escapeHtml(code)}</code></pre></div>`);
      }
      continue;
    }

    // heading
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // blockquote / callout
    if (/^>\s?/.test(line)) {
      const body = [];
      let variant = "";
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      let text = body.join("\n");
      const tag = /^\[!(warn|danger|tip)\]\s*/i.exec(text);
      if (tag) {
        variant = tag[1].toLowerCase() === "tip" ? "" : tag[1].toLowerCase();
        text = text.slice(tag[0].length);
      }
      html.push(`<blockquote${variant ? ` class="${variant}"` : ""}>${text
        .split(/\n{2,}/)
        .map((p) => `<p>${inline(p.replace(/\n/g, " "))}</p>`)
        .join("")}</blockquote>`);
      continue;
    }

    // table
    if (isTableRow(line) && isTableRow(lines[i + 1] || "") && /^[\s|:-]+$/.test(lines[i + 1])) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      html.push(
        `<table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
          "</tbody></table>"
      );
      continue;
    }

    // lists
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let text = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          text += " " + lines[i].trim();
          i++;
        }
        items.push(`<li>${inline(text)}</li>`);
      }
      html.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }

    // paragraph
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(```|#{2,4}\s|>\s?|\s*([-*]|\d+\.)\s)/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      para.push(lines[i++]);
    }
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return html.join("\n");
}

/* ------------------------------------------------------------ results --- */

const MAX_DISPLAY_ROWS = 200;

export function formatCell(value) {
  if (value === null || value === undefined) return { text: "NULL", cls: "null" };
  if (typeof value === "number") {
    const text = Number.isInteger(value) ? String(value) : String(Math.round(value * 1e6) / 1e6);
    return { text, cls: "num" };
  }
  if (value instanceof Uint8Array) return { text: `«blob, ${value.length} bytes»`, cls: "null" };
  return { text: String(value), cls: "" };
}

/** Render a sql.js result set ({columns, values}) as an HTML table. */
export function resultTable(result, { maxRows = MAX_DISPLAY_ROWS, rowNumbers = true } = {}) {
  if (!result || !result.columns) return "";
  const rows = result.values.slice(0, maxRows);
  const head =
    (rowNumbers ? "<th></th>" : "") +
    result.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows
    .map((row, index) => {
      const cells = row
        .map((value) => {
          const { text, cls } = formatCell(value);
          return `<td class="${cls}">${escapeHtml(text)}</td>`;
        })
        .join("");
      return `<tr>${rowNumbers ? `<td class="rowno">${index + 1}</td>` : ""}${cells}</tr>`;
    })
    .join("");
  const truncated =
    result.values.length > maxRows
      ? `<div class="faint" style="padding:6px 10px">… ${result.values.length - maxRows} more rows not shown</div>`
      : "";
  return `<div class="table-scroll"><table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${truncated}`;
}

/** Summary line under a query: row count and timing. */
export function resultMeta(result, elapsed, extra = "") {
  const rows = result ? result.values.length : 0;
  const parts = [`${rows} row${rows === 1 ? "" : "s"}`];
  if (typeof elapsed === "number") parts.push(`${elapsed < 1 ? "<1" : elapsed.toFixed(0)} ms`);
  if (extra) parts.push(extra);
  return `<div class="result-meta">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join("")}</div>`;
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
