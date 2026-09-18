::: lesson m9-recursive-series

A **recursive CTE** is a query that refers to itself. It has two halves joined by
`UNION ALL`:

1. the **anchor** — the starting row(s)
2. the **recursive step** — rows derived from what the CTE has produced so far

It stops when the step returns nothing.

```sql
WITH RECURSIVE numbers(n) AS (
  SELECT 1                      -- anchor
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 10   -- step (with a stop condition!)
)
SELECT n FROM numbers;
```

> [!danger]
> Forget the `WHERE` in the recursive step and the query never ends. If a query
> in this app takes more than a few seconds it is cancelled automatically — but
> in production that is a very bad afternoon.

## A date spine

The most useful recursive query in analytics: every date in a range, whether or
not anything happened on it.

```sql
WITH RECURSIVE calendar(day) AS (
  SELECT '2025-01-01'
  UNION ALL
  SELECT date(day, '+1 day') FROM calendar WHERE day < '2025-01-31'
)
SELECT day FROM calendar;
```

Left join real data onto it and empty days appear as zeros instead of vanishing:

```sql
WITH RECURSIVE calendar(day) AS (
  SELECT '2025-06-01'
  UNION ALL
  SELECT date(day, '+1 day') FROM calendar WHERE day < '2025-06-30'
)
SELECT
  c.day,
  COUNT(o.order_id) AS orders
FROM calendar AS c
LEFT JOIN orders AS o ON o.order_date = c.day
GROUP BY c.day
ORDER BY c.day;
```

Compare that with `GROUP BY order_date` alone: days with no orders are simply
missing there, which silently distorts moving averages and charts.

## Month spines

```sql
WITH RECURSIVE months(m) AS (
  SELECT '2025-01'
  UNION ALL
  SELECT strftime('%Y-%m', date(m || '-01', '+1 month')) FROM months WHERE m < '2025-06'
)
SELECT m FROM months;
```

::: lesson m9-recursive-tree

The other classic use of recursion: hierarchies. `categories.parent_id` points at
another category, so the table is a tree of unknown depth — impossible with
plain joins, natural with recursion.

```sql
WITH RECURSIVE tree AS (
  SELECT category_id, name, parent_id, 0 AS depth, name AS path
  FROM categories
  WHERE parent_id IS NULL                        -- anchor: the roots
  UNION ALL
  SELECT c.category_id, c.name, c.parent_id, t.depth + 1, t.path || ' > ' || c.name
  FROM categories AS c
  JOIN tree AS t ON t.category_id = c.parent_id  -- step: children of what we have
)
SELECT depth, path, category_id
FROM tree
ORDER BY path;
```

Two things are being built as the recursion descends: `depth` (how far from the
root) and `path` (the trail of names). Both are standard tricks.

## Everything under one node

Change the anchor to start somewhere specific:

```sql
WITH RECURSIVE subtree AS (
  SELECT category_id, name, parent_id, 0 AS depth
  FROM categories
  WHERE category_id = 1                          -- Instruments
  UNION ALL
  SELECT c.category_id, c.name, c.parent_id, s.depth + 1
  FROM categories AS c
  JOIN subtree AS s ON s.category_id = c.parent_id
)
SELECT depth, category_id, name FROM subtree ORDER BY depth, name;
```

## Walking upwards

Flip the join and you climb from a node to its ancestors — an employee's whole
management chain:

```sql
WITH RECURSIVE chain AS (
  SELECT employee_id, first_name, last_name, manager_id, 0 AS steps_up
  FROM employees
  WHERE employee_id = 14
  UNION ALL
  SELECT e.employee_id, e.first_name, e.last_name, e.manager_id, c.steps_up + 1
  FROM employees AS e
  JOIN chain AS c ON e.employee_id = c.manager_id
)
SELECT steps_up, employee_id, first_name || ' ' || last_name AS person
FROM chain
ORDER BY steps_up;
```

## Rolling a subtree up

Combine recursion with aggregation to answer "how many products sit anywhere
below this category?":

```sql
WITH RECURSIVE tree AS (
  SELECT category_id AS root_id, category_id
  FROM categories
  UNION ALL
  SELECT t.root_id, c.category_id
  FROM categories AS c
  JOIN tree AS t ON t.category_id = c.parent_id
)
SELECT
  r.name AS category,
  COUNT(p.product_id) AS products_in_subtree
FROM tree AS t
JOIN categories AS r ON r.category_id = t.root_id
LEFT JOIN products AS p ON p.category_id = t.category_id
GROUP BY t.root_id, r.name
HAVING COUNT(p.product_id) > 0
ORDER BY products_in_subtree DESC
LIMIT 10;
```

> [!warn]
> A cycle in the data (A is B's parent, B is A's parent) makes a recursive CTE
> loop forever. Real systems either guarantee acyclicity or carry a depth guard:
> `WHERE depth < 20`.

::: lesson m9-pivot

SQLite has no `PIVOT` keyword. It does not need one: **conditional aggregation**
(Module 3) turns rows into columns.

```sql
SELECT
  substr(order_date, 1, 4) AS year,
  COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
  COUNT(*) FILTER (WHERE status = 'shipped')    AS shipped,
  COUNT(*) FILTER (WHERE status = 'processing') AS processing,
  COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled,
  COUNT(*) FILTER (WHERE status = 'returned')   AS returned,
  COUNT(*) AS total
FROM orders
GROUP BY year
ORDER BY year;
```

The portable spelling, if `FILTER` is not available:

```sql
SELECT
  substr(order_date, 1, 4) AS year,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
FROM orders
GROUP BY year
ORDER BY year;
```

## A revenue matrix

Rows are categories, columns are quarters:

```sql
SELECT
  c.name AS category,
  ROUND(SUM(CASE WHEN substr(o.order_date, 6, 2) IN ('01','02','03')
                 THEN i.quantity * i.unit_price * (1 - i.discount) ELSE 0 END), 0) AS q1,
  ROUND(SUM(CASE WHEN substr(o.order_date, 6, 2) IN ('04','05','06')
                 THEN i.quantity * i.unit_price * (1 - i.discount) ELSE 0 END), 0) AS q2,
  ROUND(SUM(CASE WHEN substr(o.order_date, 6, 2) IN ('07','08','09')
                 THEN i.quantity * i.unit_price * (1 - i.discount) ELSE 0 END), 0) AS q3,
  ROUND(SUM(CASE WHEN substr(o.order_date, 6, 2) IN ('10','11','12')
                 THEN i.quantity * i.unit_price * (1 - i.discount) ELSE 0 END), 0) AS q4
FROM order_items AS i
JOIN orders AS o ON o.order_id = i.order_id
JOIN products AS p ON p.product_id = i.product_id
JOIN categories AS c ON c.category_id = p.category_id
WHERE o.order_date >= '2025-01-01'
GROUP BY c.name
ORDER BY c.name;
```

Pivoting is inherently static: every column must be written out. If the set of
columns is unknown, produce the long format (`group, key, value`) and let the
reporting tool pivot it.

## Unpivot: columns into rows

The reverse is a `UNION ALL` per column:

```sql
SELECT product_id, 'in_stock' AS metric, units_in_stock AS value FROM products
UNION ALL
SELECT product_id, 'reorder_level', COALESCE(reorder_level, 0) FROM products
ORDER BY product_id, metric
LIMIT 10;
```

::: lesson m9-gaps-islands

"Gaps and islands" is the family of questions about **runs of consecutive
values**: streaks of active days, unbroken id ranges, sessions of activity.

The trick: for consecutive rows, *value minus row number* is constant. Group by
that difference and every group is one island.

```sql
WITH days AS (
  SELECT DISTINCT date(started_at) AS day FROM web_sessions
),
marked AS (
  SELECT
    day,
    julianday(day) - ROW_NUMBER() OVER (ORDER BY day) AS island
  FROM days
)
SELECT
  MIN(day) AS island_start,
  MAX(day) AS island_end,
  COUNT(*) AS days_in_a_row
FROM marked
GROUP BY island
ORDER BY days_in_a_row DESC, island_start
LIMIT 10;
```

Read the middle CTE carefully: on consecutive days both `julianday(day)` and the
row number increase by 1, so their difference does not change. The moment a day
is missing, the difference jumps — a new island begins.

## The gaps themselves

Use `LEAD` to find the holes between islands:

```sql
WITH days AS (
  SELECT DISTINCT date(started_at) AS day FROM web_sessions
),
gaps AS (
  SELECT
    day,
    LEAD(day) OVER (ORDER BY day) AS next_day,
    CAST(julianday(LEAD(day) OVER (ORDER BY day)) - julianday(day) AS INTEGER) AS gap_days
  FROM days
)
SELECT day AS last_active, next_day AS back_again, gap_days - 1 AS missing_days
FROM gaps
WHERE gap_days > 1
ORDER BY missing_days DESC, day
LIMIT 10;
```

## Streaks per entity

Partition the island calculation and you get per-customer streaks — the same
shape as "consecutive days logged in":

```sql
WITH customer_days AS (
  SELECT DISTINCT customer_id, order_date AS day
  FROM orders
  WHERE customer_id IS NOT NULL
),
marked AS (
  SELECT
    customer_id,
    day,
    julianday(day) - ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY day) AS island
  FROM customer_days
)
SELECT customer_id, MIN(day) AS streak_start, COUNT(*) AS days_in_a_row
FROM marked
GROUP BY customer_id, island
HAVING COUNT(*) > 1
ORDER BY days_in_a_row DESC, customer_id
LIMIT 10;
```

::: lesson m9-dedup

Duplicate rows arrive through imports, retries and bugs. Finding them is a
`GROUP BY … HAVING COUNT(*) > 1`; removing them is a window function.

## Find them

```sql
SELECT
  product_id,
  customer_id,
  COUNT(*) AS reviews
FROM reviews
GROUP BY product_id, customer_id
HAVING COUNT(*) > 1
ORDER BY reviews DESC, product_id
LIMIT 10;
```

## Keep one, mark the rest

`ROW_NUMBER()` over the duplicate key, ordered by whichever row you want to
keep:

```sql
WITH ranked AS (
  SELECT
    review_id,
    product_id,
    customer_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, customer_id
      ORDER BY created_at DESC, review_id DESC
    ) AS rn
  FROM reviews
)
SELECT review_id, product_id, customer_id, created_at
FROM ranked
WHERE rn > 1
ORDER BY product_id, customer_id, review_id
LIMIT 10;
```

Those are the rows to delete — everything except the newest review per
customer/product pair.

## Delete them

```sql
DELETE FROM reviews
WHERE review_id IN (
  SELECT review_id FROM (
    SELECT review_id,
           ROW_NUMBER() OVER (PARTITION BY product_id, customer_id
                              ORDER BY created_at DESC, review_id DESC) AS rn
    FROM reviews
  )
  WHERE rn > 1
);

SELECT COUNT(*) AS reviews_left FROM reviews;
```

Then stop it happening again: `CREATE UNIQUE INDEX ux_reviews_one_per_customer
ON reviews(product_id, customer_id);`. A constraint is the only permanent fix —
de-duplication scripts run forever otherwise.

## Near-duplicates

Exact matches are the easy case. For "same person, different spelling", normalise
first and group on the normalised value:

```sql
SELECT LOWER(TRIM(last_name)) AS normalised, COUNT(*) AS rows_found
FROM customers
GROUP BY normalised
HAVING COUNT(*) > 1
ORDER BY rows_found DESC
LIMIT 10;
```

::: lesson m9-cohort

A **cohort analysis** groups people by when they started and follows each group
over time. It is the standard retention report, and it is pure SQL:

```sql
WITH first_order AS (
  SELECT
    customer_id,
    MIN(order_date) AS first_date
  FROM orders
  GROUP BY customer_id
),
activity AS (
  SELECT
    f.customer_id,
    substr(f.first_date, 1, 7) AS cohort_month,
    (CAST(substr(o.order_date, 1, 4) AS INTEGER) * 12 + CAST(substr(o.order_date, 6, 2) AS INTEGER))
      - (CAST(substr(f.first_date, 1, 4) AS INTEGER) * 12 + CAST(substr(f.first_date, 6, 2) AS INTEGER))
      AS months_since_first
  FROM orders AS o
  JOIN first_order AS f ON f.customer_id = o.customer_id
)
SELECT
  cohort_month,
  COUNT(DISTINCT CASE WHEN months_since_first = 0 THEN customer_id END) AS month_0,
  COUNT(DISTINCT CASE WHEN months_since_first = 1 THEN customer_id END) AS month_1,
  COUNT(DISTINCT CASE WHEN months_since_first = 2 THEN customer_id END) AS month_2,
  COUNT(DISTINCT CASE WHEN months_since_first = 3 THEN customer_id END) AS month_3
FROM activity
WHERE cohort_month >= '2024-01'
GROUP BY cohort_month
ORDER BY cohort_month;
```

Three ideas, stacked:

1. **anchor** each customer with their first order (`first_order`)
2. **measure distance** from that anchor for every later order (`activity`)
3. **pivot** the distances into columns (`COUNT(DISTINCT CASE …)`)

Turning counts into percentages is one more division:

```sql
WITH first_order AS (
  SELECT customer_id, MIN(order_date) AS first_date FROM orders GROUP BY customer_id
),
activity AS (
  SELECT
    substr(f.first_date, 1, 7) AS cohort_month,
    f.customer_id,
    CAST((julianday(o.order_date) - julianday(f.first_date)) / 30 AS INTEGER) AS period
  FROM orders AS o
  JOIN first_order AS f ON f.customer_id = o.customer_id
),
sized AS (
  SELECT cohort_month, COUNT(DISTINCT customer_id) AS cohort_size
  FROM activity WHERE period = 0 GROUP BY cohort_month
)
SELECT
  a.cohort_month,
  s.cohort_size,
  a.period,
  COUNT(DISTINCT a.customer_id) AS active,
  ROUND(100.0 * COUNT(DISTINCT a.customer_id) / s.cohort_size, 1) AS pct_retained
FROM activity AS a
JOIN sized AS s ON s.cohort_month = a.cohort_month
WHERE a.cohort_month >= '2025-01' AND a.period <= 3
GROUP BY a.cohort_month, s.cohort_size, a.period
ORDER BY a.cohort_month, a.period;
```

::: lesson m9-funnel

## Sessionising events

`web_sessions` already has one row per visit, but real event tables do not —
they have a stream of timestamps that you must cut into sessions. The rule
"a gap of more than 30 minutes starts a new session" is `LAG` plus a running
sum:

```sql
WITH events AS (
  SELECT customer_id, started_at
  FROM web_sessions
  WHERE customer_id IS NOT NULL
),
marked AS (
  SELECT
    customer_id,
    started_at,
    CASE
      WHEN LAG(started_at) OVER (PARTITION BY customer_id ORDER BY started_at) IS NULL
        OR (julianday(started_at)
            - julianday(LAG(started_at) OVER (PARTITION BY customer_id ORDER BY started_at))) * 24 * 60 > 30
      THEN 1 ELSE 0
    END AS is_new_session
  FROM events
),
numbered AS (
  SELECT
    customer_id,
    started_at,
    SUM(is_new_session) OVER (PARTITION BY customer_id ORDER BY started_at
                              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS session_no
  FROM marked
)
SELECT customer_id, session_no, MIN(started_at) AS session_start, COUNT(*) AS events
FROM numbered
GROUP BY customer_id, session_no
ORDER BY events DESC, customer_id
LIMIT 10;
```

The `is_new_session` flag plus a running `SUM` is a general pattern: it turns
"where does a new group start?" into a group number.

## A funnel

Funnels count how many entities reached each stage. Compute one flag per stage,
then aggregate:

```sql
WITH stages AS (
  SELECT
    c.customer_id,
    1 AS signed_up,
    MAX(CASE WHEN o.order_id IS NOT NULL THEN 1 ELSE 0 END) AS ordered,
    MAX(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS completed,
    MAX(CASE WHEN r.review_id IS NOT NULL THEN 1 ELSE 0 END) AS reviewed
  FROM customers AS c
  LEFT JOIN orders AS o ON o.customer_id = c.customer_id
  LEFT JOIN reviews AS r ON r.customer_id = c.customer_id
  GROUP BY c.customer_id
)
SELECT
  SUM(signed_up) AS signed_up,
  SUM(ordered)   AS ordered,
  SUM(completed) AS completed,
  SUM(reviewed)  AS reviewed,
  ROUND(100.0 * SUM(ordered) / SUM(signed_up), 1) AS pct_ordered,
  ROUND(100.0 * SUM(completed) / NULLIF(SUM(ordered), 0), 1) AS pct_of_orderers_completed
FROM stages;
```

## Device and channel breakdowns

```sql
SELECT
  device,
  COUNT(*) AS sessions,
  ROUND(AVG(duration_sec), 0) AS avg_seconds,
  COUNT(DISTINCT customer_id) AS known_customers
FROM web_sessions
GROUP BY device
ORDER BY sessions DESC;
```

::: lesson m9-quality

Before trusting any analysis, interrogate the data. These queries take a minute
and save days.

## Orphans: broken relationships

```sql
SELECT COUNT(*) AS orphan_items
FROM order_items AS i
LEFT JOIN orders AS o ON o.order_id = i.order_id
WHERE o.order_id IS NULL;
```

Zero is the only acceptable answer. (SQLite can check all declared foreign keys
at once with `PRAGMA foreign_key_check;`.)

## Completeness: how much is missing?

```sql
SELECT
  COUNT(*) AS customers,
  ROUND(100.0 * SUM(CASE WHEN country IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_no_country,
  ROUND(100.0 * SUM(CASE WHEN birth_date IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_no_birth_date,
  ROUND(100.0 * SUM(CASE WHEN referred_by IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_no_referrer
FROM customers;
```

## Plausibility: does the data obey its own rules?

```sql
SELECT
  SUM(CASE WHEN ship_date < order_date THEN 1 ELSE 0 END) AS shipped_before_ordered,
  SUM(CASE WHEN status = 'completed' AND ship_date IS NULL THEN 1 ELSE 0 END) AS completed_but_unshipped,
  SUM(CASE WHEN shipping_cost < 0 THEN 1 ELSE 0 END) AS negative_shipping
FROM orders;
```

## Distributions: the shape of a column

```sql
SELECT
  MIN(unit_price) AS min_price,
  ROUND(AVG(unit_price), 2) AS avg_price,
  MAX(unit_price) AS max_price,
  COUNT(*) AS products,
  COUNT(DISTINCT category_id) AS categories
FROM products;
```

## Reconciliation: two ways to the same number

If two independent calculations disagree, one of them is wrong — usually a join
that fanned out:

```sql
SELECT
  (SELECT ROUND(SUM(quantity * unit_price * (1 - discount)), 2) FROM order_items) AS revenue_direct,
  (SELECT ROUND(SUM(goods), 2) FROM (
     SELECT order_id, SUM(quantity * unit_price * (1 - discount)) AS goods
     FROM order_items GROUP BY order_id
   )) AS revenue_via_orders;
```

> A short checklist before publishing any number: row counts at each step, the
> grain of the final result, NULL handling, and one independent recomputation of
> the headline figure.
