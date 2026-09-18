/* =====================================================================
   SQL Quest — lesson prose loader
   Lesson text lives in content/<module-id>.md, one file per module, with
   lessons separated by a "::: lesson <id>" marker. Keeping the prose in
   markdown (rather than inside JavaScript strings) means it can be read,
   diffed and edited like documentation.
   ===================================================================== */

/** Split a module markdown file into { lessonId: markdown }. */
export function splitLessonContent(text) {
  const out = new Map();
  const lines = String(text).replace(/\r/g, "").split("\n");
  let current = null;
  let buffer = [];
  const flush = () => {
    if (current) out.set(current, buffer.join("\n").trim());
    buffer = [];
  };
  for (const line of lines) {
    const marker = /^:::\s*lesson\s+([\w-]+)\s*$/.exec(line);
    if (marker) {
      flush();
      current = marker[1];
    } else if (current) {
      buffer.push(line);
    }
  }
  flush();
  return out;
}

const cache = new Map();

/** Fetch and parse one module's prose (browser only; cached). */
export async function loadModuleContent(moduleId) {
  if (cache.has(moduleId)) return cache.get(moduleId);
  const response = await fetch(`content/${moduleId}.md`);
  if (!response.ok) throw new Error(`Could not load content/${moduleId}.md`);
  const parsed = splitLessonContent(await response.text());
  cache.set(moduleId, parsed);
  return parsed;
}

export async function lessonMarkdown(moduleId, lessonId) {
  const parsed = await loadModuleContent(moduleId);
  return parsed.get(lessonId) || "";
}

export function cachedModuleContent(moduleId) {
  return cache.get(moduleId) || null;
}
