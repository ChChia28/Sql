/* Module 9 — Advanced Patterns ----------------------------------------- */

export default {
  id: "patterns",
  number: 9,
  title: "Advanced Patterns",
  level: "Advanced",
  summary:
    "The queries professionals reach for: recursive CTEs, hierarchies, pivots, gaps and islands, de-duplication, cohorts, funnels and data-quality checks.",
  lessons: [
    {
      id: "m9-recursive-series",
      title: "Recursive CTEs: series and date spines",
      goal: "Generate rows that are not in any table — numbers, dates, month grids.",
      keywords: ["recursive", "with recursive", "series", "date spine", "calendar"],
      exercises: [
        {
          id: "m9-rec-e1",
          prompt:
            "Generate the numbers 1 to 20 as a single column named `n`, in order, with a recursive CTE.",
          starter:
            "WITH RECURSIVE numbers(n) AS (\n  SELECT 1\n  UNION ALL\n  -- the recursive step, with a stop condition\n)\nSELECT n FROM numbers;",
          solution:
            "WITH RECURSIVE numbers(n) AS (\n  SELECT 1\n  UNION ALL\n  SELECT n + 1 FROM numbers WHERE n < 20\n)\nSELECT n FROM numbers;",
          hints: ["Anchor, `UNION ALL`, then `SELECT n + 1 FROM numbers WHERE n < 20`."],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "RECURSIVE", msg: "Use WITH RECURSIVE." }],
        },
        {
          id: "m9-rec-e2",
          prompt:
            "Build a complete daily series for **June 2025** and count orders on each day — including days with none. Return `day` and `orders`, sorted by day.",
          starter: "",
          solution:
            "WITH RECURSIVE calendar(day) AS (\n  SELECT '2025-06-01'\n  UNION ALL\n  SELECT date(day, '+1 day') FROM calendar WHERE day < '2025-06-30'\n)\nSELECT c.day, COUNT(o.order_id) AS orders\nFROM calendar AS c\nLEFT JOIN orders AS o ON o.order_date = c.day\nGROUP BY c.day\nORDER BY c.day;",
          hints: [
            "Generate the dates first, then LEFT JOIN the orders onto them.",
            "`COUNT(o.order_id)` gives 0 on empty days; `COUNT(*)` would give 1.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "What stops a recursive CTE?",
          options: [
            "A LIMIT clause",
            "The recursive step returning no rows",
            "SQLite's 100-row default",
            "The UNION ALL",
          ],
          answer: 1,
          explain:
            "The step runs repeatedly until it produces nothing. Without a condition that eventually fails, it never stops.",
        },
      ],
    },

    {
      id: "m9-recursive-tree",
      title: "Recursive CTEs: hierarchies",
      goal: "Walk a parent/child tree in either direction and compute depth and paths.",
      keywords: ["hierarchy", "tree", "parent_id", "org chart", "path", "depth", "subtree"],
      exercises: [
        {
          id: "m9-tree-e1",
          prompt:
            "Flatten the category tree: return `depth` (0 for roots), `category_id` and `path` (names from the root joined with ` > `), sorted by `path`.",
          starter: "",
          solution:
            "WITH RECURSIVE tree AS (\n  SELECT category_id, name, parent_id, 0 AS depth, name AS path\n  FROM categories\n  WHERE parent_id IS NULL\n  UNION ALL\n  SELECT c.category_id, c.name, c.parent_id, t.depth + 1, t.path || ' > ' || c.name\n  FROM categories AS c\n  JOIN tree AS t ON t.category_id = c.parent_id\n)\nSELECT depth, category_id, path\nFROM tree\nORDER BY path;",
          hints: [
            "Anchor on the roots (`parent_id IS NULL`).",
            "Carry `depth + 1` and `path || ' > ' || c.name` down the recursion.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m9-tree-e2",
          prompt:
            "Return the whole management chain above employee 14: `steps_up` (0 for the employee), `employee_id` and `person` (first + space + last), sorted by `steps_up`.",
          starter: "",
          solution:
            "WITH RECURSIVE chain AS (\n  SELECT employee_id, first_name, last_name, manager_id, 0 AS steps_up\n  FROM employees\n  WHERE employee_id = 14\n  UNION ALL\n  SELECT e.employee_id, e.first_name, e.last_name, e.manager_id, c.steps_up + 1\n  FROM employees AS e\n  JOIN chain AS c ON e.employee_id = c.manager_id\n)\nSELECT steps_up, employee_id, first_name || ' ' || last_name AS person\nFROM chain\nORDER BY steps_up;",
          hints: [
            "Anchor on the employee, then join `e.employee_id = c.manager_id` to climb.",
            "The chain ends when someone has no manager.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m9-tree-e3",
          prompt:
            "How many products sit **anywhere below** each category (including in the category itself)? Return `category` and `products_in_subtree` for categories with at least one, sorted by count descending then category.",
          starter: "",
          solution:
            "WITH RECURSIVE tree AS (\n  SELECT category_id AS root_id, category_id\n  FROM categories\n  UNION ALL\n  SELECT t.root_id, c.category_id\n  FROM categories AS c\n  JOIN tree AS t ON t.category_id = c.parent_id\n)\nSELECT r.name AS category, COUNT(p.product_id) AS products_in_subtree\nFROM tree AS t\nJOIN categories AS r ON r.category_id = t.root_id\nLEFT JOIN products AS p ON p.category_id = t.category_id\nGROUP BY t.root_id, r.name\nHAVING COUNT(p.product_id) > 0\nORDER BY products_in_subtree DESC, category;",
          hints: [
            "Build (root, descendant) pairs: anchor every category to itself, then walk down.",
            "Join products onto the descendant and group by the root.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m9-pivot",
      title: "Pivoting",
      goal: "Turn rows into columns with conditional aggregation — and back again.",
      keywords: ["pivot", "crosstab", "filter", "matrix", "unpivot"],
      exercises: [
        {
          id: "m9-pivot-e1",
          prompt:
            "Order status matrix by year: return `year`, then `completed`, `shipped`, `processing`, `cancelled`, `returned` and `total`, sorted by year.",
          starter: "",
          solution:
            "SELECT\n  substr(order_date, 1, 4) AS year,\n  COUNT(*) FILTER (WHERE status = 'completed') AS completed,\n  COUNT(*) FILTER (WHERE status = 'shipped') AS shipped,\n  COUNT(*) FILTER (WHERE status = 'processing') AS processing,\n  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,\n  COUNT(*) FILTER (WHERE status = 'returned') AS returned,\n  COUNT(*) AS total\nFROM orders\nGROUP BY year\nORDER BY year;",
          hints: [
            "One conditional aggregate per column.",
            "`COUNT(*) FILTER (WHERE …)` or `SUM(CASE WHEN … THEN 1 ELSE 0 END)`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m9-pivot-e2",
          prompt:
            "Loyalty tiers per country: return `country`, `bronze`, `silver`, `gold`, `platinum` (counts of customers) for countries that are known, sorted by country.",
          starter: "",
          solution:
            "SELECT\n  country,\n  COUNT(*) FILTER (WHERE loyalty_tier = 'bronze') AS bronze,\n  COUNT(*) FILTER (WHERE loyalty_tier = 'silver') AS silver,\n  COUNT(*) FILTER (WHERE loyalty_tier = 'gold') AS gold,\n  COUNT(*) FILTER (WHERE loyalty_tier = 'platinum') AS platinum\nFROM customers\nWHERE country IS NOT NULL\nGROUP BY country\nORDER BY country;",
          hints: ["Same pattern as the status matrix, grouped by country."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Why can't a SQL pivot produce columns discovered at runtime?",
          options: [
            "It can — SQLite has a PIVOT keyword",
            "The column list of a result set is fixed when the statement is prepared",
            "Because of GROUP BY",
            "Only with a recursive CTE",
          ],
          answer: 1,
          explain:
            "Dynamic columns require generating SQL text first. Usually it is better to return long format and pivot in the presentation layer.",
        },
      ],
    },

    {
      id: "m9-gaps-islands",
      title: "Gaps and islands",
      goal: "Find runs of consecutive values — streaks, active periods, missing days.",
      keywords: ["gaps and islands", "streak", "consecutive", "row_number trick", "lead"],
      exercises: [
        {
          id: "m9-islands-e1",
          prompt:
            "Find the longest runs of consecutive days with at least one web session. Return `island_start`, `island_end` and `days_in_a_row` for the 10 longest, tie-broken by `island_start`.",
          starter:
            "WITH days AS (\n  SELECT DISTINCT date(started_at) AS day FROM web_sessions\n)\nSELECT * FROM days ORDER BY day LIMIT 10;",
          solution:
            "WITH days AS (\n  SELECT DISTINCT date(started_at) AS day FROM web_sessions\n),\nmarked AS (\n  SELECT day, julianday(day) - ROW_NUMBER() OVER (ORDER BY day) AS island\n  FROM days\n)\nSELECT MIN(day) AS island_start, MAX(day) AS island_end, COUNT(*) AS days_in_a_row\nFROM marked\nGROUP BY island\nORDER BY days_in_a_row DESC, island_start\nLIMIT 10;",
          hints: [
            "For consecutive days, `julianday(day) - ROW_NUMBER()` is constant.",
            "Group by that constant: each group is one unbroken run.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "ROW_NUMBER", msg: "The island trick needs ROW_NUMBER()." }],
        },
        {
          id: "m9-islands-e2",
          prompt:
            "Where are the holes? Return `last_active`, `back_again` and `missing_days` for the 10 biggest gaps between days with sessions, tie-broken by `last_active`.",
          starter: "",
          solution:
            "WITH days AS (\n  SELECT DISTINCT date(started_at) AS day FROM web_sessions\n),\ngaps AS (\n  SELECT\n    day,\n    LEAD(day) OVER (ORDER BY day) AS next_day,\n    CAST(julianday(LEAD(day) OVER (ORDER BY day)) - julianday(day) AS INTEGER) AS gap_days\n  FROM days\n)\nSELECT day AS last_active, next_day AS back_again, gap_days - 1 AS missing_days\nFROM gaps\nWHERE gap_days > 1\nORDER BY missing_days DESC, last_active\nLIMIT 10;",
          hints: [
            "`LEAD(day)` gives the next active day.",
            "A gap of n days means n - 1 missing days.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m9-islands-e3",
          prompt:
            "Customer ordering streaks: return `customer_id`, `streak_start` and `days_in_a_row` for streaks of **2 or more consecutive days** with an order, top 10 by length then `customer_id`.",
          starter: "",
          solution:
            "WITH customer_days AS (\n  SELECT DISTINCT customer_id, order_date AS day FROM orders\n),\nmarked AS (\n  SELECT customer_id, day,\n         julianday(day) - ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY day) AS island\n  FROM customer_days\n)\nSELECT customer_id, MIN(day) AS streak_start, COUNT(*) AS days_in_a_row\nFROM marked\nGROUP BY customer_id, island\nHAVING COUNT(*) >= 2\nORDER BY days_in_a_row DESC, customer_id\nLIMIT 10;",
          hints: [
            "Partition the row number by customer so streaks do not cross customers.",
            "DISTINCT first — two orders on the same day are one active day.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m9-dedup",
      title: "Finding and removing duplicates",
      goal: "Detect duplicate rows, keep the right one, and prevent a recurrence.",
      keywords: ["duplicates", "dedup", "row_number", "unique index", "data cleaning"],
      exercises: [
        {
          id: "m9-dedup-e1",
          prompt:
            "Which customer/product pairs have more than one review? Return `product_id`, `customer_id` and `reviews`, most duplicated first, tie-broken by `product_id` then `customer_id`.",
          starter: "",
          solution:
            "SELECT product_id, customer_id, COUNT(*) AS reviews\nFROM reviews\nGROUP BY product_id, customer_id\nHAVING COUNT(*) > 1\nORDER BY reviews DESC, product_id, customer_id;",
          hints: ["GROUP BY the key you expect to be unique, then HAVING COUNT(*) > 1."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m9-dedup-e2",
          prompt:
            "Keep only the **newest** review per customer/product pair: delete the rest. (Newest = highest `created_at`, tie-broken by highest `review_id`.)",
          starter: "",
          solution:
            "DELETE FROM reviews\nWHERE review_id IN (\n  SELECT review_id FROM (\n    SELECT review_id,\n           ROW_NUMBER() OVER (PARTITION BY product_id, customer_id\n                              ORDER BY created_at DESC, review_id DESC) AS rn\n    FROM reviews\n  )\n  WHERE rn > 1\n);",
          check:
            "SELECT COUNT(*) AS reviews, COUNT(DISTINCT product_id || '-' || customer_id) AS pairs FROM reviews;",
          hints: [
            "Number the rows within each pair, newest first.",
            "Delete every row whose number is greater than 1.",
          ],
        },
      ],
      quiz: [
        {
          q: "After cleaning duplicates, what stops them coming back?",
          options: [
            "Running the cleanup on a schedule",
            "A UNIQUE constraint or unique index on the key that should be unique",
            "Adding an ORDER BY",
            "Nothing can",
          ],
          answer: 1,
          explain: "Constraints are the only durable fix; scripts just mop up after the leak.",
        },
      ],
    },

    {
      id: "m9-cohort",
      title: "Cohort and retention analysis",
      goal: "Group customers by when they started and track them over time.",
      keywords: ["cohort", "retention", "first order", "months since", "churn"],
      exercises: [
        {
          id: "m9-cohort-e1",
          prompt:
            "For each customer return `customer_id`, `first_date` (their first order date) and `cohort_month` (`YYYY-MM` of that date), sorted by `first_date` then `customer_id`, limit 15.",
          starter: "",
          solution:
            "SELECT\n  customer_id,\n  MIN(order_date) AS first_date,\n  substr(MIN(order_date), 1, 7) AS cohort_month\nFROM orders\nGROUP BY customer_id\nORDER BY first_date, customer_id\nLIMIT 15;",
          hints: ["`MIN(order_date)` per customer is the cohort anchor."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m9-cohort-e2",
          prompt:
            "Retention table: for cohorts from 2024-01 onwards, return `cohort_month`, `month_0`, `month_1`, `month_2` and `month_3` — distinct customers active that many whole months after their first order. Sort by `cohort_month`.",
          starter: "",
          solution:
            "WITH first_order AS (\n  SELECT customer_id, MIN(order_date) AS first_date FROM orders GROUP BY customer_id\n),\nactivity AS (\n  SELECT\n    f.customer_id,\n    substr(f.first_date, 1, 7) AS cohort_month,\n    (CAST(substr(o.order_date, 1, 4) AS INTEGER) * 12 + CAST(substr(o.order_date, 6, 2) AS INTEGER))\n      - (CAST(substr(f.first_date, 1, 4) AS INTEGER) * 12 + CAST(substr(f.first_date, 6, 2) AS INTEGER))\n      AS months_since_first\n  FROM orders AS o\n  JOIN first_order AS f ON f.customer_id = o.customer_id\n)\nSELECT\n  cohort_month,\n  COUNT(DISTINCT CASE WHEN months_since_first = 0 THEN customer_id END) AS month_0,\n  COUNT(DISTINCT CASE WHEN months_since_first = 1 THEN customer_id END) AS month_1,\n  COUNT(DISTINCT CASE WHEN months_since_first = 2 THEN customer_id END) AS month_2,\n  COUNT(DISTINCT CASE WHEN months_since_first = 3 THEN customer_id END) AS month_3\nFROM activity\nWHERE cohort_month >= '2024-01'\nGROUP BY cohort_month\nORDER BY cohort_month;",
          hints: [
            "Anchor each customer with their first order, then measure each order's distance in months.",
            "Convert a date to a month number with year * 12 + month, then subtract.",
            "Pivot the distances with COUNT(DISTINCT CASE …).",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m9-funnel",
      title: "Funnels and sessionisation",
      goal: "Cut an event stream into sessions and measure stage-to-stage conversion.",
      keywords: ["funnel", "conversion", "sessionisation", "events", "flags"],
      exercises: [
        {
          id: "m9-funnel-e1",
          prompt:
            "Customer funnel in one row: `signed_up`, `ordered`, `completed`, `reviewed` (counts of customers reaching each stage) plus `pct_ordered` (1 dp).",
          starter: "",
          solution:
            "WITH stages AS (\n  SELECT\n    c.customer_id,\n    1 AS signed_up,\n    MAX(CASE WHEN o.order_id IS NOT NULL THEN 1 ELSE 0 END) AS ordered,\n    MAX(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS completed,\n    MAX(CASE WHEN r.review_id IS NOT NULL THEN 1 ELSE 0 END) AS reviewed\n  FROM customers AS c\n  LEFT JOIN orders AS o ON o.customer_id = c.customer_id\n  LEFT JOIN reviews AS r ON r.customer_id = c.customer_id\n  GROUP BY c.customer_id\n)\nSELECT\n  SUM(signed_up) AS signed_up,\n  SUM(ordered) AS ordered,\n  SUM(completed) AS completed,\n  SUM(reviewed) AS reviewed,\n  ROUND(100.0 * SUM(ordered) / SUM(signed_up), 1) AS pct_ordered\nFROM stages;",
          hints: [
            "One row per customer with a 0/1 flag per stage, then sum the flags.",
            "`MAX(CASE …)` turns 'any matching row' into a flag.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m9-funnel-e2",
          prompt:
            "Sessionise visits: treat a gap of more than 30 minutes as a new session. Return `customer_id`, `session_no`, `session_start` and `events` for the 10 busiest sessions (most events), tie-broken by `customer_id` then `session_no`. Ignore anonymous visits.",
          starter: "",
          solution:
            "WITH events AS (\n  SELECT customer_id, started_at FROM web_sessions WHERE customer_id IS NOT NULL\n),\nmarked AS (\n  SELECT\n    customer_id,\n    started_at,\n    CASE\n      WHEN LAG(started_at) OVER (PARTITION BY customer_id ORDER BY started_at) IS NULL\n        OR (julianday(started_at)\n            - julianday(LAG(started_at) OVER (PARTITION BY customer_id ORDER BY started_at))) * 24 * 60 > 30\n      THEN 1 ELSE 0\n    END AS is_new_session\n  FROM events\n),\nnumbered AS (\n  SELECT customer_id, started_at,\n         SUM(is_new_session) OVER (PARTITION BY customer_id ORDER BY started_at\n                                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS session_no\n  FROM marked\n)\nSELECT customer_id, session_no, MIN(started_at) AS session_start, COUNT(*) AS events\nFROM numbered\nGROUP BY customer_id, session_no\nORDER BY events DESC, customer_id, session_no\nLIMIT 10;",
          hints: [
            "LAG gives the previous event time for that customer.",
            "Flag 1 when the gap exceeds 30 minutes, then take a running SUM of the flag.",
            "Multiply a julianday difference by 24 * 60 to get minutes.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m9-quality",
      title: "Data quality checks",
      goal: "Interrogate data before you trust it — orphans, completeness, plausibility, reconciliation.",
      keywords: ["data quality", "orphans", "validation", "reconciliation", "sanity check"],
      exercises: [
        {
          id: "m9-quality-e1",
          prompt:
            "Completeness report for `customers`: return `customers`, `pct_no_country`, `pct_no_birth_date` and `pct_no_referrer` (each 1 dp).",
          starter: "",
          solution:
            "SELECT\n  COUNT(*) AS customers,\n  ROUND(100.0 * SUM(CASE WHEN country IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_no_country,\n  ROUND(100.0 * SUM(CASE WHEN birth_date IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_no_birth_date,\n  ROUND(100.0 * SUM(CASE WHEN referred_by IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_no_referrer\nFROM customers;",
          hints: ["Conditional counts divided by COUNT(*), times 100.0."],
          checkColumnNames: true,
        },
        {
          id: "m9-quality-e2",
          prompt:
            "Plausibility checks on `orders`, one row: `shipped_before_ordered`, `completed_but_unshipped` and `negative_shipping`.",
          starter: "",
          solution:
            "SELECT\n  SUM(CASE WHEN ship_date < order_date THEN 1 ELSE 0 END) AS shipped_before_ordered,\n  SUM(CASE WHEN status = 'completed' AND ship_date IS NULL THEN 1 ELSE 0 END) AS completed_but_unshipped,\n  SUM(CASE WHEN shipping_cost < 0 THEN 1 ELSE 0 END) AS negative_shipping\nFROM orders;",
          hints: ["Three conditional sums over the same table."],
          checkColumnNames: true,
        },
        {
          id: "m9-quality-e3",
          prompt:
            "Reconcile revenue two ways in one row: `revenue_direct` (straight from `order_items`, 2 dp) and `revenue_via_orders` (sum of per-order totals, 2 dp). They must match.",
          starter: "",
          solution:
            "SELECT\n  (SELECT ROUND(SUM(quantity * unit_price * (1 - discount)), 2) FROM order_items) AS revenue_direct,\n  (SELECT ROUND(SUM(goods), 2) FROM (\n     SELECT order_id, SUM(quantity * unit_price * (1 - discount)) AS goods\n     FROM order_items GROUP BY order_id\n   )) AS revenue_via_orders;",
          hints: [
            "Two scalar subqueries side by side.",
            "The second aggregates per order first, then totals those.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Two calculations of the same revenue figure differ by 12%. The most likely cause is…",
          options: [
            "Floating-point error",
            "A join that fanned out and multiplied some rows",
            "A missing index",
            "The ORDER BY clause",
          ],
          answer: 1,
          explain:
            "Rounding never moves a number by 12%. Check the grain of each query and the row counts at every step.",
        },
      ],
    },
  ],
};
