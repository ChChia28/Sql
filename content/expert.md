::: lesson m10-execution-order

You write a query in one order and the database runs it in another. Knowing both
explains most of SQL's "surprising" behaviour.

```sql-static
written:    SELECT → FROM → WHERE → GROUP BY → HAVING → WINDOW → ORDER BY → LIMIT
evaluated:  FROM → WHERE → GROUP BY → HAVING → SELECT → WINDOW → ORDER BY → LIMIT
```

Walk through it:

1. **FROM / JOIN** — build the working set of rows (the *grain*).
2. **WHERE** — discard rows. Aliases from `SELECT` do not exist yet; aggregates
   are not allowed.
3. **GROUP BY** — collapse rows into groups.
4. **HAVING** — discard groups. Aggregates *are* allowed.
5. **SELECT** — compute the output columns, including aggregates; aliases are
   born here.
6. **Window functions** — evaluated over the result of steps 1–5.
7. **ORDER BY** — sort; aliases and window results are visible.
8. **LIMIT / OFFSET** — cut.

That single list answers:

- *Why is my alias rejected in WHERE?* It does not exist yet (step 5 > step 2).
  SQLite tolerates it; PostgreSQL, MySQL, SQL Server and Oracle do not.
- *Why is `WHERE COUNT(*) > 5` an error?* No groups exist at step 2.
- *Why can't I filter on `ROW_NUMBER()` in WHERE?* Windows run at step 6.
- *Why does `LIMIT` not speed up a query with `ORDER BY` on an unindexed
  column?* Everything must be sorted before the cut.

## This is logical, not physical

The engine is free to do anything that produces the same answer: reorder joins,
push a filter down into a scan, stop early when it has enough rows. What it may
never do is change the result. The plan it actually chose is what
`EXPLAIN QUERY PLAN` shows you — next lesson.

```sql
SELECT customer_id, COUNT(*) AS orders
FROM orders
WHERE status <> 'cancelled'
GROUP BY customer_id
HAVING COUNT(*) >= 8
ORDER BY orders DESC, customer_id
LIMIT 5;
```

Say each clause out loud in evaluation order and the query becomes a sentence:
*take orders, drop the cancelled ones, pile them by customer, keep piles of 8+,
compute the counts, sort, keep five.*

::: lesson m10-explain

`EXPLAIN QUERY PLAN` shows how SQLite intends to run a statement. Every database
has an equivalent (`EXPLAIN`, `EXPLAIN ANALYZE`, "show plan"), and reading it is
the difference between guessing at performance and knowing.

```sql
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE customer_id = 42;
```

The output mentions `SEARCH orders USING INDEX idx_orders_customer` — the engine
jumps straight to the matching rows. Now a column with no index:

```sql
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE shipping_cost > 40;
```

`SCAN orders`: every row is read and tested. On 620 rows that is instant; on 620
million it is your afternoon.

## The vocabulary

| line | meaning |
| --- | --- |
| `SCAN t` | full table scan — every row |
| `SEARCH t USING INDEX ix (col=?)` | index lookup |
| `SEARCH t USING INTEGER PRIMARY KEY (rowid=?)` | direct rowid hit, the cheapest of all |
| `USE TEMP B-TREE FOR ORDER BY` | the result had to be sorted in memory |
| `USING COVERING INDEX ix` | answered from the index alone, table never touched |

A `SCAN` is not automatically bad — reading a small table end to end beats
bouncing through an index. A `SCAN` of a large table inside a join, repeated per
row, is what kills queries.

## Plans for joins

```sql
EXPLAIN QUERY PLAN
SELECT c.last_name, COUNT(*) AS orders
FROM customers AS c
JOIN orders AS o ON o.customer_id = c.customer_id
GROUP BY c.customer_id;
```

Read it top to bottom: the outer loop first, then what it does for each row. If
the inner table is scanned, an index on the join column is usually the fix.

## Sorting

```sql
EXPLAIN QUERY PLAN
SELECT * FROM products ORDER BY unit_price DESC LIMIT 10;
```

`USE TEMP B-TREE FOR ORDER BY` means a sort. An index on `unit_price` would let
the engine walk the order directly — worth it only if this query matters.

::: lesson m10-indexes

An index is a sorted copy of some columns plus a pointer back to the row. It
turns "read everything and test" into "jump straight there".

```sql
CREATE INDEX idx_orders_status ON orders(status);

EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE status = 'processing';
```

## What to index

- columns you filter on (`WHERE`) and join on (`ON`)
- columns you sort by, when the sort is the expensive part
- the foreign key side of a relationship: **SQLite does not index foreign keys
  automatically**, and neither do most engines

## Composite indexes: order matters

An index on `(a, b)` is like a phone book sorted by surname, then first name:

| query | can it use `(a, b)`? |
| --- | --- |
| `WHERE a = 1` | yes |
| `WHERE a = 1 AND b = 2` | yes, fully |
| `WHERE b = 2` | no — you cannot look up a first name without a surname |
| `WHERE a = 1 ORDER BY b` | yes, and the sort is free |

Rule of thumb: **equality columns first, then the range or sort column**.

```sql
CREATE INDEX idx_orders_cust_date ON orders(customer_id, order_date);

EXPLAIN QUERY PLAN
SELECT order_id FROM orders WHERE customer_id = 12 ORDER BY order_date;
```

## Covering indexes

If the index contains every column the query needs, the table is never touched:

```sql
CREATE INDEX idx_products_cat_price ON products(category_id, unit_price);

EXPLAIN QUERY PLAN
SELECT category_id, unit_price FROM products WHERE category_id = 100;
```

Look for `USING COVERING INDEX` — that is as fast as a relational database gets.

## Expression indexes

If you must filter on a function, index the function:

```sql
CREATE INDEX idx_customers_lower_last ON customers(LOWER(last_name));

EXPLAIN QUERY PLAN
SELECT * FROM customers WHERE LOWER(last_name) = 'chen';
```

## The cost side

Every index must be updated on every insert, update and delete of its columns,
and it occupies space. Indexes that are never used are pure overhead. Add them
deliberately, in response to a plan you have actually looked at.

::: lesson m10-sargable

A predicate is **sargable** ("search-argument-able") when the engine can use an
index for it. The rule is simple: *keep the column bare on one side of the
comparison*.

| instead of | write |
| --- | --- |
| `WHERE strftime('%Y', order_date) = '2025'` | `WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01'` |
| `WHERE unit_price * 1.2 > 100` | `WHERE unit_price > 100 / 1.2` |
| `WHERE LOWER(email) = 'x@y.z'` | store a normalised column, or index the expression |
| `WHERE name LIKE '%bass%'` | full-text search, or a trigram/expression index |
| `WHERE CAST(customer_id AS TEXT) = '42'` | `WHERE customer_id = 42` |

```sql
EXPLAIN QUERY PLAN
SELECT COUNT(*) FROM orders WHERE strftime('%Y', order_date) = '2025';
```

```sql
EXPLAIN QUERY PLAN
SELECT COUNT(*) FROM orders
WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01';
```

Same answer, different plans — and on a big table, different orders of
magnitude.

## Leading wildcards

`LIKE 'Studio%'` can use an index (it is a prefix range). `LIKE '%Studio'`
cannot. If you need infix search at scale, that is what FTS5 (SQLite's
full-text index) or a dedicated search engine is for.

## Keyset pagination

`LIMIT 20 OFFSET 100000` makes the engine walk 100,020 rows to return 20. Page
by the last key you saw instead:

```sql
SELECT product_id, name, unit_price
FROM products
WHERE product_id > 40           -- the last id from the previous page
ORDER BY product_id
LIMIT 5;
```

Constant time per page, whatever the offset. The trade-off: you can only move
forward and back, not jump to "page 57".

## OR is often the enemy

`WHERE a = 1 OR b = 2` can rarely use one index for both sides. Two queries
combined with `UNION ALL` (each using its own index) is often dramatically
faster:

```sql
SELECT order_id FROM orders WHERE customer_id = 12
UNION
SELECT order_id FROM orders WHERE employee_id = 5
ORDER BY order_id
LIMIT 10;
```

## Measure, do not guess

Change one thing, re-read the plan, keep what helps. Intuition about performance
is wrong often enough that the plan is the only honest referee.

::: lesson m10-design

Schema design decides how easy every future query will be.

## Normalisation, in three steps

- **1NF** — one value per cell. No comma-separated lists, no `phone1, phone2,
  phone3` columns.
- **2NF** — every non-key column depends on the *whole* primary key. In
  `order_items(order_id, item_no, …)`, storing `customer_id` would break this:
  it depends on the order alone.
- **3NF** — no column depends on another non-key column. Storing
  `supplier_country` in `products` would break it; the country belongs to the
  supplier.

The plain-English version: **one fact, in one place**. Every duplicate of a fact
is a future contradiction.

## What our schema does

`order_items` stores `unit_price` even though `products` has one. That looks
like a violation and is not: the item price is the price **at the time of the
order**, a different fact from today's catalogue price. Prices change; invoices
must not.

```sql
SELECT
  i.order_id, p.name,
  i.unit_price AS price_when_sold,
  p.unit_price AS price_today
FROM order_items AS i
JOIN products AS p ON p.product_id = i.product_id
WHERE i.unit_price <> p.unit_price
ORDER BY i.order_id
LIMIT 8;
```

## When to denormalise

Deliberately, for a measured read problem, and never silently:

- a cached `orders.total` to avoid re-summing line items on every page view
- a reporting table rebuilt nightly
- a materialised rollup for a dashboard

Each one buys speed with the risk of drift. Whoever adds it owns keeping it
correct — and should add a reconciliation query that proves it still matches.

## Choosing keys

Surrogate keys (auto-incrementing integers) for anything that might change;
natural keys for genuinely immutable codes (ISO country codes, currency codes).
Composite keys where the pair is the identity, as in `order_items`.

## Nullable or not?

`NOT NULL` wherever the value is genuinely required. A nullable column is a
promise to every future query author that they must handle the NULL — and most
of them will forget.

## Storing time

ISO-8601 text (`'2025-03-14 09:30:00'`) sorts correctly, is human-readable and
works with every SQLite date function. Store UTC; convert for display. Mixing
timezones in one column is a bug that surfaces months later.

::: lesson m10-concurrency

A transaction is not just "all or nothing" — it also decides what you see while
other people are writing.

## The classic anomalies

| anomaly | what happens |
| --- | --- |
| dirty read | you read another transaction's uncommitted change |
| non-repeatable read | you read a row twice and it changed in between |
| phantom read | you run the same query twice and new rows appeared |
| lost update | two writers read-modify-write and one change vanishes |

Isolation levels trade these away for concurrency. `READ COMMITTED` (PostgreSQL's
default) prevents dirty reads; `SERIALIZABLE` prevents everything, at the cost of
retries and blocking.

**SQLite is effectively serialisable**: one writer at a time, readers unaffected
in WAL mode. That simplicity is why it is a good place to learn the concepts
without configuring anything.

## The lost update, concretely

```sql-static
-- both sessions read 10
session A: SELECT units_in_stock FROM products WHERE product_id = 1;  -- 10
session B: SELECT units_in_stock FROM products WHERE product_id = 1;  -- 10
session A: UPDATE products SET units_in_stock = 9 WHERE product_id = 1;
session B: UPDATE products SET units_in_stock = 9 WHERE product_id = 1;
-- two sales, one unit deducted
```

Two fixes:

1. **Do the arithmetic in the database** — `SET units_in_stock = units_in_stock -
   1` is atomic, no read-then-write gap.
2. **Optimistic concurrency** — carry a version and make the update conditional:

```sql
UPDATE products
SET units_in_stock = units_in_stock - 1
WHERE product_id = 1 AND units_in_stock >= 1
RETURNING product_id, units_in_stock;
```

If the row does not change, somebody beat you to it — and you retry rather than
corrupt the count.

## Keep transactions short

A transaction holds locks (and, in MVCC systems, keeps old row versions alive).
Never keep one open across a network call or a user's coffee break. Read the
data, compute, write, commit.

## Deadlocks

Two transactions each holding what the other needs. Databases detect the cycle
and kill one — so application code must be able to retry. The prevention is
boring and effective: **always take locks in the same order** (for example,
always update `orders` before `order_items`).

## Idempotence

Any write that might be retried should be safe to run twice. `INSERT … ON
CONFLICT DO NOTHING` and conditional updates are how you get there; blind
`INSERT` plus retry is how you get duplicates.

::: lesson m10-antipatterns

A catalogue of things that look reasonable and are not.

## SELECT * in production code

Fine while exploring. In an application it transfers columns nobody uses, breaks
when the table changes, and prevents covering indexes. Name your columns.

## Filtering after aggregating (or the reverse)

Filter rows in `WHERE`, groups in `HAVING`. Putting a row condition in `HAVING`
works but forces the engine to group rows it will throw away.

## DISTINCT as a bug plaster

If a join duplicated your rows, `DISTINCT` hides the symptom and costs a sort.
Find the fan-out instead: aggregate at the right grain, or use `EXISTS`.

```sql
SELECT COUNT(*) AS with_join, COUNT(DISTINCT c.customer_id) AS actual_customers
FROM customers AS c
JOIN orders AS o ON o.customer_id = c.customer_id;
```

## NOT IN with a nullable subquery

Covered in Module 5 and worth repeating: one NULL and the result is empty. Use
`NOT EXISTS`.

## Implicit cross joins

`FROM a, b WHERE a.id = b.a_id` works, but the day someone drops the `WHERE`
condition you get a cartesian product with no syntax error. Explicit
`JOIN … ON …` makes the mistake impossible to miss.

## Correlated subqueries in the SELECT list of a big query

One per row, per subquery. Five of them over a million rows is five million
lookups. A single join plus `GROUP BY` — or a window function — does it in one
pass.

## Storing lists in a column

`tags = 'pro,studio,stage'` cannot be indexed, joined or validated. Use a child
table (or a JSON column *and* accept the cost, as Module 6 discussed).

## Wildcard-leading LIKE as a search feature

`LIKE '%term%'` scans everything. It is fine for an admin filter over thousands
of rows; it is not a search engine.

## Trusting the application to enforce data rules

Constraints do not forget, do not have race conditions, and apply to the import
script somebody runs at 2am.

## No ORDER BY, but expecting an order

Row order without `ORDER BY` is undefined. It may be stable for years, then
change when an index is added.

```sql
SELECT name FROM products LIMIT 5;
```

::: lesson m10-portability

Most SQL transfers unchanged. These are the differences that actually bite.

| topic | SQLite | PostgreSQL | MySQL |
| --- | --- | --- | --- |
| string concat | `\|\|` | `\|\|` | `CONCAT()` (`\|\|` is OR by default) |
| limit rows | `LIMIT n OFFSET m` | same | same |
| current timestamp | `datetime('now')` | `now()` | `NOW()` |
| date arithmetic | `date(d, '+7 days')` | `d + INTERVAL '7 days'` | `DATE_ADD(d, INTERVAL 7 DAY)` |
| format a date | `strftime('%Y-%m', d)` | `to_char(d, 'YYYY-MM')` | `DATE_FORMAT(d, '%Y-%m')` |
| string aggregate | `group_concat(x)` | `string_agg(x, ',')` | `GROUP_CONCAT(x)` |
| booleans | 0 / 1 | real `boolean` | `TINYINT(1)` |
| types | dynamic affinity | strict | strict |
| upsert | `ON CONFLICT DO UPDATE` | same | `ON DUPLICATE KEY UPDATE` |
| `RETURNING` | yes | yes | no |
| full outer join | 3.39+ | yes | 8.0.31+ |
| identifier quoting | `"x"` or `` `x` `` | `"x"` | `` `x` `` |

## Things that are the same everywhere

`SELECT`/`FROM`/`WHERE`/`GROUP BY`/`HAVING`/`ORDER BY`, joins, subqueries,
CTEs (including recursive ones), window functions, set operators, `CASE`,
`COALESCE`, transactions. That is 95% of the SQL you will ever write.

## Writing portable SQL

- prefer standard syntax when it costs nothing (`CAST` over `::`)
- never rely on SQLite's type tolerance
- always alias derived tables
- do not depend on implicit ordering or on `DISTINCT` doing your sorting

```sql
SELECT
  CAST(strftime('%Y', order_date) AS INTEGER) AS year,
  COUNT(*) AS orders
FROM orders
GROUP BY year
ORDER BY year;
```

::: lesson m10-capstone

Everything you have learned, applied to questions like the ones you will
actually be asked at work. Each capstone needs several techniques: joins,
aggregation, windows, maybe a recursive CTE.

A worked one first — *a monthly report with revenue, its running total, and
growth against the previous month*:

```sql
WITH monthly AS (
  SELECT
    substr(o.order_date, 1, 7) AS month,
    SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue,
    COUNT(DISTINCT o.order_id) AS orders
  FROM orders AS o
  JOIN order_items AS i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY month
)
SELECT
  month,
  ROUND(revenue, 2) AS revenue,
  orders,
  ROUND(SUM(revenue) OVER (ORDER BY month), 2) AS running_revenue,
  ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
        / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1) AS pct_change
FROM monthly
ORDER BY month;
```

Notice the shape: **aggregate in a CTE, analyse with windows in the outer
query**. Most real reports are exactly that.

Approach each capstone the way you would at work:

1. Write down what one row of the answer represents.
2. Find the tables that hold those facts.
3. Build it in steps as CTEs, running each one.
4. Sanity-check the numbers a second way before you believe them.
