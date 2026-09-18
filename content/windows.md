::: lesson m8-intro

`GROUP BY` collapses rows. A **window function** computes across a set of rows
*without* collapsing them: every input row survives, and gains an extra column
that knows about its neighbours.

Compare the two. First, the aggregate you already know:

```sql
SELECT ROUND(AVG(unit_price), 2) AS avg_price FROM products;
```

One row. Now the window version:

```sql
SELECT
  name,
  unit_price,
  ROUND(AVG(unit_price) OVER (), 2) AS avg_price,
  ROUND(unit_price - AVG(unit_price) OVER (), 2) AS diff_from_avg
FROM products
ORDER BY diff_from_avg DESC
LIMIT 10;
```

61 rows, each carrying the catalogue average alongside its own price. That is
the whole idea: `OVER ()` turns an aggregate into a window function.

## The anatomy

```sql-static
function(args) OVER (
  PARTITION BY  …   -- split rows into independent groups (optional)
  ORDER BY      …   -- order within each group (optional)
  ROWS/RANGE    …   -- which neighbouring rows count (optional)
)
```

An empty `OVER ()` means "every row in the result". Add `PARTITION BY` and the
calculation restarts per group. Add `ORDER BY` and the function can see
position — which is what makes running totals and rankings possible.

## Where window functions run

They are computed **after** `WHERE`, `GROUP BY` and `HAVING`, and **before**
`ORDER BY` and `LIMIT`. Two consequences you will meet within the hour:

- you cannot filter on a window function in `WHERE` — wrap the query in a CTE
  and filter outside
- window functions can be used on top of aggregated data (they see the grouped
  rows, not the raw ones)

> Window functions exist in SQLite 3.25+, PostgreSQL, MySQL 8+, SQL Server,
> Oracle and every cloud warehouse. Learning them once pays everywhere.

::: lesson m8-partition

`PARTITION BY` splits the rows into independent groups. The function restarts
for each one — like `GROUP BY`, except the rows stay.

```sql
SELECT
  category_id,
  name,
  unit_price,
  ROUND(AVG(unit_price) OVER (PARTITION BY category_id), 2) AS category_avg,
  ROUND(unit_price - AVG(unit_price) OVER (PARTITION BY category_id), 2) AS vs_category
FROM products
ORDER BY category_id, unit_price DESC
LIMIT 20;
```

Each product now knows its own category's average — the query that needed a
correlated subquery back in Module 5, in one pass.

## Counting within a partition

```sql
SELECT
  o.order_id,
  o.customer_id,
  o.order_date,
  COUNT(*) OVER (PARTITION BY o.customer_id) AS orders_by_this_customer
FROM orders AS o
ORDER BY o.customer_id, o.order_date
LIMIT 20;
```

## Share-of-total

Dividing a value by a window sum gives percentages without a second query:

```sql
WITH product_revenue AS (
  SELECT
    p.category_id,
    p.name,
    SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue
  FROM order_items AS i
  JOIN products AS p ON p.product_id = i.product_id
  GROUP BY p.category_id, p.name
)
SELECT
  category_id,
  name,
  ROUND(revenue, 2) AS revenue,
  ROUND(100.0 * revenue / SUM(revenue) OVER (PARTITION BY category_id), 1) AS pct_of_category,
  ROUND(100.0 * revenue / SUM(revenue) OVER (), 1) AS pct_of_all
FROM product_revenue
ORDER BY category_id, revenue DESC
LIMIT 20;
```

Notice the aggregate *and* the window function in the same pipeline: the CTE
groups, the outer query windows over the grouped rows.

::: lesson m8-rank

Three ranking functions, three different answers to ties:

| function | 10, 10, 9 becomes | meaning |
| --- | --- | --- |
| `ROW_NUMBER()` | 1, 2, 3 | arbitrary but unique position |
| `RANK()` | 1, 1, 3 | ties share a rank, then a gap |
| `DENSE_RANK()` | 1, 1, 2 | ties share a rank, no gap |

```sql
SELECT
  name,
  unit_price,
  ROW_NUMBER()  OVER (ORDER BY unit_price DESC) AS row_number,
  RANK()        OVER (ORDER BY unit_price DESC) AS rank,
  DENSE_RANK()  OVER (ORDER BY unit_price DESC) AS dense_rank
FROM products
ORDER BY unit_price DESC
LIMIT 12;
```

All three need `ORDER BY` inside `OVER` — without an order, "position" is
meaningless.

## Top-N per group

This is the pattern to memorise. Rank inside each partition, then filter outside:

```sql
WITH ranked AS (
  SELECT
    category_id,
    name,
    unit_price,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY unit_price DESC, product_id) AS rn
  FROM products
)
SELECT category_id, name, unit_price
FROM ranked
WHERE rn <= 2
ORDER BY category_id, rn;
```

"The two most expensive products in every category." Without window functions
this takes a correlated subquery or a self-join; with them it is six lines.

> [!warn]
> `WHERE rn <= 2` cannot go in the same `SELECT` that defines `rn` — window
> functions are computed after `WHERE`. The CTE (or subquery) is not optional.
> Some databases offer `QUALIFY` for exactly this; SQLite does not.

## Deterministic ranking

Add a unique tie-breaker to the `ORDER BY` inside `OVER` (`…, product_id`), or
the same query can return different rows on different runs.

::: lesson m8-lag-lead

`LAG()` looks at a previous row; `LEAD()` looks ahead. Both need an `ORDER BY`
inside `OVER`.

```sql
WITH monthly AS (
  SELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders
  FROM orders
  GROUP BY month
)
SELECT
  month,
  orders,
  LAG(orders) OVER (ORDER BY month) AS prev_month,
  orders - LAG(orders) OVER (ORDER BY month) AS change
FROM monthly
ORDER BY month
LIMIT 15;
```

The first row has no predecessor, so `LAG` gives NULL. Supply a default with the
third argument: `LAG(orders, 1, 0)`.

## Growth rates

```sql
WITH monthly AS (
  SELECT substr(order_date, 1, 7) AS month,
         SUM(shipping_cost) AS shipping
  FROM orders
  GROUP BY month
)
SELECT
  month,
  ROUND(shipping, 2) AS shipping,
  ROUND(100.0 * (shipping - LAG(shipping) OVER (ORDER BY month))
        / NULLIF(LAG(shipping) OVER (ORDER BY month), 0), 1) AS pct_change
FROM monthly
ORDER BY month
LIMIT 15;
```

`NULLIF(…, 0)` keeps a zero denominator from ruining the report.

## Gaps between events

Partition by the customer, order by date, and `LAG` gives each order's
predecessor **for that customer**:

```sql
SELECT
  customer_id,
  order_id,
  order_date,
  LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS prev_order,
  CAST(julianday(order_date)
       - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id))
       AS INTEGER) AS days_since_prev
FROM orders
ORDER BY customer_id, order_date
LIMIT 20;
```

::: lesson m8-frames

With `ORDER BY` inside `OVER`, an aggregate becomes **cumulative**: by default
it covers everything from the start of the partition up to the current row.

```sql
WITH monthly AS (
  SELECT substr(order_date, 1, 7) AS month, SUM(shipping_cost) AS shipping
  FROM orders
  GROUP BY month
)
SELECT
  month,
  ROUND(shipping, 2) AS shipping,
  ROUND(SUM(shipping) OVER (ORDER BY month), 2) AS running_total
FROM monthly
ORDER BY month
LIMIT 15;
```

## Spelling the frame out

The default is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. You can say
exactly which neighbours count:

```sql-static
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW   -- running total
ROWS BETWEEN 2 PRECEDING AND CURRENT ROW           -- last three rows
ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING           -- neighbours either side
ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING   -- rest of the partition
```

```sql
WITH monthly AS (
  SELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders
  FROM orders
  GROUP BY month
)
SELECT
  month,
  orders,
  SUM(orders) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative,
  SUM(orders) OVER (ORDER BY month ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) AS remaining
FROM monthly
ORDER BY month
LIMIT 12;
```

## ROWS versus RANGE

- `ROWS` counts **physical rows**.
- `RANGE` counts **rows with the same ORDER BY value** as peers, so ties are
  included together.

With a unique ordering key they agree. With duplicates they do not — and the
difference is a classic source of "my running total jumps".

```sql
WITH daily AS (
  SELECT order_date, COUNT(*) AS orders FROM orders GROUP BY order_date
)
SELECT
  order_date,
  orders,
  SUM(orders) OVER (ORDER BY orders ROWS  BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS by_rows,
  SUM(orders) OVER (ORDER BY orders RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS by_range
FROM daily
ORDER BY orders, order_date
LIMIT 12;
```

::: lesson m8-moving

A moving average smooths a noisy series. It is just a frame of a fixed number of
rows:

```sql
WITH daily AS (
  SELECT order_date, COUNT(*) AS orders
  FROM orders
  WHERE order_date >= '2025-01-01'
  GROUP BY order_date
)
SELECT
  order_date,
  orders,
  ROUND(AVG(orders) OVER (ORDER BY order_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS avg_7d
FROM daily
ORDER BY order_date
LIMIT 20;
```

> [!warn]
> `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` means "the previous six **rows**",
> not "the previous six days". If a day is missing from the data, the window
> silently reaches further back. Build a complete date spine first (Module 9)
> when the distinction matters.

## Centred windows

```sql
WITH daily AS (
  SELECT order_date, COUNT(*) AS orders
  FROM orders
  WHERE order_date >= '2025-03-01'
  GROUP BY order_date
)
SELECT
  order_date,
  orders,
  ROUND(AVG(orders) OVER (ORDER BY order_date ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING), 2) AS centred_7
FROM daily
ORDER BY order_date
LIMIT 15;
```

## Cumulative distinct counts are not a thing

`COUNT(DISTINCT x) OVER (…)` is not supported by SQLite (nor by most engines).
When you need a running distinct count, compute a "first time seen" flag with
`ROW_NUMBER()` and take a running `SUM` of it — a trick Module 9 uses for
cohorts.

::: lesson m8-ntile

## NTILE: split into buckets

`NTILE(n)` divides the ordered rows into n roughly equal groups — quartiles,
deciles, percentiles:

```sql
SELECT
  name,
  unit_price,
  NTILE(4) OVER (ORDER BY unit_price) AS price_quartile
FROM products
ORDER BY unit_price
LIMIT 20;
```

Group by the bucket to describe each one:

```sql
WITH q AS (
  SELECT unit_price, NTILE(4) OVER (ORDER BY unit_price) AS quartile
  FROM products
)
SELECT
  quartile,
  COUNT(*) AS products,
  MIN(unit_price) AS from_price,
  MAX(unit_price) AS to_price
FROM q
GROUP BY quartile
ORDER BY quartile;
```

## PERCENT_RANK and CUME_DIST

- `PERCENT_RANK()` — relative rank from 0 to 1: `(rank - 1) / (rows - 1)`
- `CUME_DIST()` — proportion of rows at or below this one

```sql
SELECT
  name,
  unit_price,
  ROUND(PERCENT_RANK() OVER (ORDER BY unit_price), 3) AS pct_rank,
  ROUND(CUME_DIST()    OVER (ORDER BY unit_price), 3) AS cume_dist
FROM products
ORDER BY unit_price DESC
LIMIT 10;
```

A common use: find the rows above the 90th percentile.

```sql
WITH scored AS (
  SELECT customer_id, COUNT(*) AS orders,
         PERCENT_RANK() OVER (ORDER BY COUNT(*)) AS pr
  FROM orders
  GROUP BY customer_id
)
SELECT customer_id, orders, ROUND(pr, 3) AS pct_rank
FROM scored
WHERE pr >= 0.9
ORDER BY orders DESC, customer_id;
```

::: lesson m8-firstlast

`FIRST_VALUE`, `LAST_VALUE` and `NTH_VALUE` pull a value from a specific
position in the window.

```sql
SELECT
  category_id,
  name,
  unit_price,
  FIRST_VALUE(name) OVER (
    PARTITION BY category_id ORDER BY unit_price DESC, product_id
  ) AS priciest_in_category
FROM products
ORDER BY category_id, unit_price DESC
LIMIT 20;
```

> [!warn]
> `LAST_VALUE` surprises everyone. With the default frame (up to the current
> row) the "last value" is the current row. To mean *the last row of the
> partition*, spell the frame out:
> `LAST_VALUE(x) OVER (PARTITION BY … ORDER BY … ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)`.

```sql
SELECT
  category_id,
  name,
  unit_price,
  LAST_VALUE(name) OVER (
    PARTITION BY category_id ORDER BY unit_price DESC, product_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS cheapest_in_category
FROM products
ORDER BY category_id, unit_price DESC
LIMIT 20;
```

## Naming a window

When several functions share a window definition, define it once with a
`WINDOW` clause:

```sql
SELECT
  name,
  unit_price,
  ROW_NUMBER() OVER w AS rn,
  RANK()       OVER w AS rnk,
  ROUND(AVG(unit_price) OVER w, 2) AS running_avg
FROM products
WINDOW w AS (ORDER BY unit_price DESC, product_id)
ORDER BY unit_price DESC
LIMIT 10;
```

The `WINDOW` clause sits between `HAVING` and `ORDER BY`. It is pure
readability — and it guarantees the definitions cannot drift apart.

::: lesson m8-checkpoint

Window functions replace a whole category of clumsy SQL. A cheat sheet:

| question | window |
| --- | --- |
| compare a row to its group's average | `AVG(x) OVER (PARTITION BY g)` |
| top N per group | `ROW_NUMBER() OVER (PARTITION BY g ORDER BY x DESC)` + filter in a CTE |
| change since the previous period | `LAG(x) OVER (ORDER BY period)` |
| running total | `SUM(x) OVER (ORDER BY period)` |
| moving average | `AVG(x) OVER (ORDER BY period ROWS BETWEEN n PRECEDING AND CURRENT ROW)` |
| quartiles | `NTILE(4) OVER (ORDER BY x)` |
| value from the group's best row | `FIRST_VALUE(x) OVER (PARTITION BY g ORDER BY …)` |

Two habits that prevent most bugs:

1. **Always give `ORDER BY` inside `OVER` a unique tie-breaker** when position
   matters.
2. **Filter on a window result in an outer query**, never in the same `SELECT`.

A worked example — *each category's best-selling product, with its share of the
category's revenue*:

```sql
WITH product_revenue AS (
  SELECT
    p.category_id,
    p.product_id,
    p.name,
    SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue
  FROM order_items AS i
  JOIN products AS p ON p.product_id = i.product_id
  GROUP BY p.category_id, p.product_id, p.name
),
ranked AS (
  SELECT
    category_id,
    name,
    revenue,
    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY revenue DESC, product_id) AS rn,
    SUM(revenue) OVER (PARTITION BY category_id) AS category_revenue
  FROM product_revenue
)
SELECT
  category_id,
  name AS best_seller,
  ROUND(revenue, 2) AS revenue,
  ROUND(100.0 * revenue / category_revenue, 1) AS pct_of_category
FROM ranked
WHERE rn = 1
ORDER BY revenue DESC;
```
