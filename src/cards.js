/* =====================================================================
   SQL Quest — insight cards
   The surprise reward. A card appears on a randomly chosen solve, which
   makes the reward unpredictable (an unpredictable reward produces a
   larger dopamine response than a predictable one — Schultz's reward
   prediction error). The content is the point: each card is a fact worth
   knowing, so the collection is a knowledge set, not a trinket set.
   ===================================================================== */

export const CARDS = [
  { id: "count-one", title: "COUNT(1) is not faster",
    body: "COUNT(*) and COUNT(1) compile to the same plan in every major engine. COUNT(column) is the one that differs — it skips NULLs." },
  { id: "null-sort", title: "NULLs have a sort position",
    body: "SQLite sorts NULLs first ascending, last descending. PostgreSQL does the opposite by default. Write NULLS FIRST / NULLS LAST when it matters." },
  { id: "between-time", title: "BETWEEN eats timestamps",
    body: "col BETWEEN '2025-03-01' AND '2025-03-31' silently drops everything that happened during the 31st. Half-open ranges (>= start AND < next start) never have this bug." },
  { id: "not-in-null", title: "One NULL empties a NOT IN",
    body: "x NOT IN (1, 2, NULL) can never be true, so the query returns nothing. NOT EXISTS is immune — it compares no values, it only asks whether a row matched." },
  { id: "distinct-plaster", title: "DISTINCT is a symptom",
    body: "If DISTINCT 'fixes' duplicated rows after a join, the join fanned out. Fix the grain instead — the sort DISTINCT costs is the smaller half of the problem." },
  { id: "int-division", title: "Integer division truncates",
    body: "5 / 2 is 2, and 100 * completed / total is often 0. Multiply by 1.0 (or 100.0) first to keep the fraction." },
  { id: "window-where", title: "Windows run after WHERE",
    body: "That is why you cannot filter on ROW_NUMBER() in the same SELECT that defines it. Wrap it in a CTE and filter outside." },
  { id: "last-value", title: "LAST_VALUE lies by default",
    body: "The default frame ends at the current row, so LAST_VALUE returns the current row. Add ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING." },
  { id: "rows-vs-range", title: "ROWS counts rows, RANGE counts peers",
    body: "With ties in the ORDER BY, RANGE includes every tied row and ROWS does not. With a unique key they agree — which is why the bug only shows up in production." },
  { id: "moving-gap", title: "A 7-row window is not 7 days",
    body: "ROWS BETWEEN 6 PRECEDING counts rows. If a day has no data there is no row, and the window quietly reaches further back. Build a date spine first." },
  { id: "sargable", title: "Keep the column bare",
    body: "WHERE strftime('%Y', d) = '2025' cannot use an index; WHERE d >= '2025-01-01' AND d < '2026-01-01' can. Same rows, different order of magnitude." },
  { id: "composite-order", title: "Composite index = phone book",
    body: "An index on (surname, first_name) finds a surname instantly and a first name not at all. Equality columns first, then the range or sort column." },
  { id: "covering", title: "The fastest read touches no table",
    body: "If an index holds every column a query needs, the engine answers from the index alone. Plans call it a COVERING INDEX." },
  { id: "fk-index", title: "Foreign keys are not indexed for you",
    body: "SQLite (and most engines) index the parent's primary key, not the child's foreign key. Every 'find the children' query scans until you add it." },
  { id: "txn-speed", title: "One transaction, not ten thousand",
    body: "Outside a transaction each statement commits on its own and each commit syncs to disk. Wrapping a bulk load in BEGIN…COMMIT can be orders of magnitude faster." },
  { id: "lost-update", title: "Read-modify-write loses sales",
    body: "Two sessions read stock = 10 and both write 9. SET stock = stock - 1 is atomic and cannot lose the update; add a WHERE guard so it cannot go negative." },
  { id: "historical-price", title: "Copying a price is not denormalisation",
    body: "order_items.unit_price stores the price at the time of sale — a different fact from today's catalogue price. Historical facts must be stored, never recomputed." },
  { id: "sum-empty", title: "SUM over nothing is NULL",
    body: "COUNT gives 0, SUM gives NULL. Any report that must show a zero needs COALESCE(SUM(x), 0) — or SQLite's TOTAL(x)." },
  { id: "having-where", title: "HAVING is not 'WHERE for groups you forgot'",
    body: "Row conditions belong in WHERE so fewer rows ever reach the grouping. Use HAVING only for conditions that genuinely depend on the aggregate." },
  { id: "left-join-where", title: "WHERE can undo a LEFT JOIN",
    body: "A condition on the optional table in WHERE drops the NULL-filled rows, turning the outer join back into an inner one. Put it in the ON clause." },
  { id: "count-star-left", title: "COUNT(*) counts invented rows",
    body: "After a LEFT JOIN, unmatched rows still exist. COUNT(*) counts them as 1; COUNT(right.column) correctly gives 0." },
  { id: "exists-select", title: "SELECT 1 inside EXISTS",
    body: "EXISTS never reads the columns, only whether a row appeared — and it can stop at the first match. The convention is SELECT 1; SELECT * costs nothing extra either." },
  { id: "island-trick", title: "Value minus row number is constant",
    body: "For consecutive values, date − ROW_NUMBER() does not change. Group by that difference and every group is one unbroken run. That is the whole gaps-and-islands trick." },
  { id: "order-undefined", title: "No ORDER BY, no order",
    body: "Row order without ORDER BY is undefined — stable for years, then different the day someone adds an index. LIMIT without ORDER BY returns arbitrary rows." },
  { id: "cte-debug", title: "CTEs are a debugger",
    body: "Comment out the final SELECT, run SELECT * FROM first_step instead, and look at the rows. That is how you find which step of a long query went wrong." },
  { id: "json-cost", title: "JSON columns have no index",
    body: "Every read parses the document and ordinary indexes do not reach inside it. Promote hot fields to real columns, or index the extracted expression." },
  { id: "explain-first", title: "Read the plan before optimising",
    body: "EXPLAIN QUERY PLAN takes two seconds and replaces an afternoon of guessing. SCAN on a big table inside a join is the line that usually matters." },
  { id: "constraint-wins", title: "Constraints outlive code",
    body: "Application validation protects one code path. A CHECK, UNIQUE or foreign key protects the data from every writer — including the import script someone runs at 2am." },
];

export function cardById(id) {
  return CARDS.find((card) => card.id === id) || null;
}
