::: lesson m3-count

So far every query returned one output row per input row. Aggregation changes
that: it **collapses many rows into one summary row**.

```sql
SELECT COUNT(*) AS orders
FROM orders;
```

## Three different COUNTs

```sql
SELECT
  COUNT(*)                AS all_rows,
  COUNT(ship_date)        AS rows_with_ship_date,
  COUNT(DISTINCT status)  AS distinct_statuses
FROM orders;
```

- `COUNT(*)` counts **rows**, NULLs and all.
- `COUNT(column)` counts rows where that column **is not NULL**.
- `COUNT(DISTINCT column)` counts the distinct non-NULL values.

That second form is a neat trick: `COUNT(ship_date)` tells you how many orders
have shipped without any filtering at all.

## Counting a condition

`COUNT(*)` plus `WHERE` counts a subset:

```sql
SELECT COUNT(*) AS cancelled_orders
FROM orders
WHERE status = 'cancelled';
```

Later in this module you will learn how to count several conditions *side by
side* in one pass, which is far more useful.

> [!warn]
> `COUNT(1)` and `COUNT(*)` do exactly the same thing at exactly the same
> speed. Any argument you have heard to the contrary is folklore.

::: lesson m3-aggregates

The other standard aggregates work the same way: feed them a column, get one
value back.

| function | what it gives you |
| --- | --- |
| `SUM(x)` | total |
| `AVG(x)` | mean |
| `MIN(x)` / `MAX(x)` | smallest / largest |
| `TOTAL(x)` | like SUM but returns 0.0 instead of NULL for no rows (SQLite) |

```sql
SELECT
  COUNT(*)              AS products,
  ROUND(AVG(unit_price), 2) AS avg_price,
  MIN(unit_price)       AS cheapest,
  MAX(unit_price)       AS dearest,
  ROUND(SUM(units_in_stock * unit_price), 2) AS stock_value
FROM products;
```

Aggregates accept any expression, not just a bare column — `SUM(units_in_stock
* unit_price)` multiplies first, then totals.

## Aggregates ignore NULLs

This matters more than it sounds:

```sql
SELECT
  COUNT(*)          AS supplier_rows,
  COUNT(rating)     AS rated,
  ROUND(AVG(rating), 3) AS avg_rating,
  ROUND(SUM(rating) / COUNT(*), 3) AS avg_including_missing_as_zero
FROM suppliers;
```

`AVG(rating)` divides by the number of **rated** suppliers, not by the number of
suppliers. If you want unrated suppliers to count as zero, say so explicitly
with `AVG(COALESCE(rating, 0))`.

## MIN and MAX work on text and dates too

```sql
SELECT
  MIN(order_date) AS first_order,
  MAX(order_date) AS latest_order
FROM orders;
```

## A revenue calculation

Line items store price and discount, so revenue is an expression:

```sql
SELECT
  ROUND(SUM(quantity * unit_price * (1 - discount)), 2) AS gross_revenue,
  SUM(quantity) AS units_sold,
  COUNT(*)      AS line_items
FROM order_items;
```

Keep that expression in mind — it comes back in almost every later module.

::: lesson m3-groupby

`GROUP BY` runs the aggregate **once per group** instead of once for the whole
table.

```sql
SELECT
  status,
  COUNT(*) AS orders
FROM orders
GROUP BY status
ORDER BY orders DESC;
```

Read it as: *split the rows into piles by `status`, then count each pile*.

## The golden rule

Every column in the `SELECT` list must either

1. appear in the `GROUP BY`, or
2. be wrapped in an aggregate function.

Anything else is a bug. Most databases reject it outright; SQLite quietly picks
an arbitrary row from the group, which is worse.

```sql
SELECT
  loyalty_tier,
  COUNT(*) AS customers
FROM customers
GROUP BY loyalty_tier
ORDER BY customers DESC;
```

## Grouping by several columns

Extra keys make finer piles — one row per **combination** that exists:

```sql
SELECT
  country,
  loyalty_tier,
  COUNT(*) AS customers
FROM customers
GROUP BY country, loyalty_tier
ORDER BY country, loyalty_tier;
```

## Per-product totals without a join

`order_items` already carries `product_id`, so you can summarise sales per
product before you know anything about joins:

```sql
SELECT
  product_id,
  SUM(quantity) AS units_sold,
  ROUND(SUM(quantity * unit_price * (1 - discount)), 2) AS revenue
FROM order_items
GROUP BY product_id
ORDER BY revenue DESC
LIMIT 10;
```

> NULL forms its own group. If some customers have no country, you get one row
> with a NULL country — which is usually exactly what you want to see.

::: lesson m3-having

`WHERE` filters **rows**, before grouping. `HAVING` filters **groups**, after.

```sql
SELECT
  product_id,
  SUM(quantity) AS units_sold
FROM order_items
GROUP BY product_id
HAVING SUM(quantity) >= 40
ORDER BY units_sold DESC;
```

Trying to write that in `WHERE` fails — at that point the groups do not exist
yet:

```sql-static
WHERE SUM(quantity) >= 40      -- misuse of aggregate function SUM()
```

## Both in the same query

They cooperate happily, and the order of execution is the key to reading it:

```sql
SELECT
  customer_id,
  COUNT(*) AS completed_orders
FROM orders
WHERE status = 'completed'          -- 1. drop rows we do not care about
GROUP BY customer_id                -- 2. pile up the survivors
HAVING COUNT(*) >= 6                -- 3. keep only the big piles
ORDER BY completed_orders DESC, customer_id
LIMIT 10;
```

## Prefer WHERE when you have the choice

Filtering early means fewer rows to group, which is faster. Use `HAVING` only
for conditions that genuinely depend on the aggregate.

> SQLite lets `HAVING` reference a `SELECT` alias (`HAVING units_sold >= 40`).
> It is convenient, but not portable — PostgreSQL, for instance, refuses.

::: lesson m3-group-expressions

You can group by any expression, not just a column. This is how you produce
monthly reports, price bands and buckets of every kind.

## Group by a slice of a date

`substr(order_date, 1, 7)` turns `'2025-03-14'` into `'2025-03'`:

```sql
SELECT
  substr(order_date, 1, 7) AS month,
  COUNT(*) AS orders
FROM orders
WHERE order_date >= '2025-01-01'
GROUP BY month
ORDER BY month;
```

`strftime('%Y-%m', order_date)` says the same thing more explicitly and is
covered in Module 6.

## Group by a CASE expression

```sql
SELECT
  CASE
    WHEN unit_price >= 1500 THEN 'premium'
    WHEN unit_price >= 400  THEN 'mid'
    ELSE 'budget'
  END AS price_band,
  COUNT(*) AS products,
  ROUND(AVG(unit_price), 2) AS avg_price
FROM products
GROUP BY price_band
ORDER BY avg_price DESC;
```

Note that `GROUP BY price_band` reuses the alias — SQLite allows it, and it
keeps the expression in one place.

## Aggregates of aggregates need two steps

"What is the average number of items per order?" is really two questions:
count per order, then average those counts. One `SELECT` cannot do both, so you
stack them — which is exactly what subqueries and CTEs (Module 5) are for:

```sql
SELECT ROUND(AVG(items), 2) AS avg_items_per_order
FROM (
  SELECT order_id, COUNT(*) AS items
  FROM order_items
  GROUP BY order_id
);
```

::: lesson m3-conditional

Conditional aggregation is the single most useful reporting trick in SQL: put a
`CASE` **inside** an aggregate and you can count several different things in one
pass over the data.

```sql
SELECT
  COUNT(*) AS orders,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) / COUNT(*),
    1
  ) AS cancel_rate_pct
FROM orders;
```

Why `100.0` and not `100`? Because integer ÷ integer is integer division in
SQLite: `5 / 620` is `0`. Multiplying by a float first keeps the decimals.

## Splitting a total by category

```sql
SELECT
  substr(order_date, 1, 4) AS year,
  ROUND(SUM(CASE WHEN status = 'completed' THEN shipping_cost ELSE 0 END), 2) AS completed_shipping,
  ROUND(SUM(CASE WHEN status <> 'completed' THEN shipping_cost ELSE 0 END), 2) AS other_shipping
FROM orders
GROUP BY year
ORDER BY year;
```

## The FILTER clause

SQLite (and PostgreSQL) support a cleaner spelling:

```sql
SELECT
  COUNT(*) AS orders,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders;
```

`FILTER (WHERE …)` applies to that aggregate only. It reads better than
`SUM(CASE …)`, but `SUM(CASE …)` works everywhere, so you will meet both.

## Counting distinct things conditionally

```sql
SELECT
  COUNT(DISTINCT customer_id) AS customers_who_ordered,
  COUNT(DISTINCT CASE WHEN status = 'returned' THEN customer_id END) AS customers_who_returned
FROM orders;
```

With no `ELSE`, the `CASE` gives NULL for non-matching rows — and `COUNT`
ignores NULLs. That omission is the whole trick.

::: lesson m3-groupconcat

A few more aggregates worth knowing.

## group_concat: rows into a list

```sql
SELECT
  loyalty_tier,
  COUNT(*) AS customers,
  group_concat(DISTINCT country) AS countries
FROM customers
GROUP BY loyalty_tier
ORDER BY customers DESC;
```

By default values are joined with commas; pass a second argument for a custom
separator (`group_concat(country, ' | ')`). In PostgreSQL the same function is
called `string_agg`, in MySQL `GROUP_CONCAT`.

> [!warn]
> The order of concatenated values is not guaranteed. If it matters, sort in a
> subquery first (or use `ORDER BY` inside the aggregate in engines that support
> it).

## MIN and MAX as "earliest" and "latest"

```sql
SELECT
  customer_id,
  COUNT(*)            AS orders,
  MIN(order_date)     AS first_order,
  MAX(order_date)     AS last_order
FROM orders
GROUP BY customer_id
ORDER BY orders DESC, customer_id
LIMIT 10;
```

A caution: `MIN(order_date)` and `MAX(shipping_cost)` in the same row come from
**different** orders. To pull a whole row that matches an extreme, you need
window functions (Module 8) or a correlated subquery (Module 5).

## Aggregates on an empty set

```sql
SELECT
  COUNT(*)   AS rows_found,
  SUM(quantity) AS total_qty,
  TOTAL(quantity) AS total_qty_sqlite
FROM order_items
WHERE product_id = -1;
```

`COUNT` gives 0, but `SUM` gives **NULL** — there was nothing to add. Wrap it
(`COALESCE(SUM(x), 0)`) whenever a report must show a zero.

::: lesson m3-checkpoint

Aggregation is where SQL starts to feel powerful: a handful of lines answers
questions that would take a long spreadsheet.

Before the exercises, a summary of the execution order you have now met in full:

```sql-static
FROM      -- 1. read rows
WHERE     -- 2. filter rows
GROUP BY  -- 3. build groups
HAVING    -- 4. filter groups
SELECT    -- 5. compute output columns (aggregates included)
ORDER BY  -- 6. sort
LIMIT     -- 7. cut
```

Every puzzle in this checkpoint is a matter of deciding which step each part of
the question belongs to. A worked example — *"which months of 2025 had more than
20 orders, and what did each month's average shipping cost look like?"*:

```sql
SELECT
  substr(order_date, 1, 7) AS month,
  COUNT(*)                 AS orders,
  ROUND(AVG(shipping_cost), 2) AS avg_shipping
FROM orders
WHERE order_date >= '2025-01-01'
GROUP BY month
HAVING COUNT(*) > 20
ORDER BY month;
```
