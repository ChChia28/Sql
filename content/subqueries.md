::: lesson m5-scalar

A **subquery** is a query inside another query. The simplest kind is a *scalar*
subquery: it returns exactly one row and one column, so it can be used anywhere
a single value is allowed.

```sql
SELECT name, unit_price
FROM products
WHERE unit_price > (SELECT AVG(unit_price) FROM products)
ORDER BY unit_price DESC;
```

The inner query runs first and produces one number; the outer query compares
against it. Without the subquery you would have to run two queries and paste the
answer in by hand — and it would go stale tomorrow.

## In the SELECT list

```sql
SELECT
  name,
  unit_price,
  ROUND(unit_price - (SELECT AVG(unit_price) FROM products), 2) AS diff_from_avg
FROM products
ORDER BY diff_from_avg DESC
LIMIT 8;
```

## A comparison to a computed threshold

```sql
SELECT order_id, shipping_cost
FROM orders
WHERE shipping_cost > (
  SELECT AVG(shipping_cost) * 1.5 FROM orders
)
ORDER BY shipping_cost DESC
LIMIT 10;
```

> [!warn]
> If a scalar subquery returns more than one row, SQLite quietly uses the first
> one; most other databases raise an error. If it returns no rows at all you get
> NULL — and every comparison with NULL is unknown, so your `WHERE` silently
> matches nothing. Make sure the subquery is genuinely scalar.

::: lesson m5-in

A subquery can also produce a **list** of values for `IN`:

```sql
SELECT customer_id, last_name, country
FROM customers
WHERE customer_id IN (
  SELECT customer_id
  FROM orders
  WHERE status = 'returned'
)
ORDER BY customer_id;
```

Read it inside-out: the inner query lists the customers who returned something;
the outer query pulls their details.

## NOT IN and the NULL trap

`NOT IN` looks like the natural opposite, and it is — until the subquery
produces a NULL. Then the whole condition can never be true and you get **zero
rows**:

```sql
SELECT COUNT(*) AS employees_with_no_orders
FROM employees
WHERE employee_id NOT IN (SELECT employee_id FROM orders);
```

Fifty orders have no `employee_id`, so that list contains NULL — and the count
comes back 0, which is wrong. Two safe fixes:

```sql
SELECT COUNT(*) AS employees_with_no_orders
FROM employees
WHERE employee_id NOT IN (
  SELECT employee_id FROM orders WHERE employee_id IS NOT NULL
);
```

```sql
SELECT COUNT(*) AS employees_with_no_orders
FROM employees AS e
WHERE NOT EXISTS (
  SELECT 1 FROM orders AS o WHERE o.employee_id = e.employee_id
);
```

The second version is the one to reach for by default: `NOT EXISTS` is immune to
the problem because it never compares values, it only asks "did anything match?"

::: lesson m5-exists

`EXISTS (subquery)` is a yes/no test: true if the subquery produces at least one
row. It is almost always **correlated** — the inner query refers to the outer
row.

```sql
SELECT c.customer_id, c.last_name
FROM customers AS c
WHERE EXISTS (
  SELECT 1
  FROM orders AS o
  WHERE o.customer_id = c.customer_id
    AND o.status = 'completed'
)
ORDER BY c.customer_id
LIMIT 15;
```

`SELECT 1` is a convention: `EXISTS` never looks at the columns, only at whether
a row appeared. The engine can stop at the first match, which makes it cheap.

## NOT EXISTS: the reliable anti-join

```sql
SELECT p.product_id, p.name
FROM products AS p
WHERE NOT EXISTS (
  SELECT 1 FROM order_items AS i WHERE i.product_id = p.product_id
)
ORDER BY p.product_id;
```

Three ways to say "products never sold":

| technique | notes |
| --- | --- |
| `LEFT JOIN … WHERE i.product_id IS NULL` | fine; needs care not to duplicate rows |
| `NOT IN (subquery)` | breaks if the subquery yields NULL |
| `NOT EXISTS (correlated subquery)` | always correct, usually fastest |

## EXISTS with extra conditions

Because the subquery is a full query, it can join and filter freely:

```sql
SELECT c.customer_id, c.last_name
FROM customers AS c
WHERE EXISTS (
  SELECT 1
  FROM orders AS o
  JOIN order_items AS i ON i.order_id = o.order_id
  JOIN products AS p ON p.product_id = i.product_id
  WHERE o.customer_id = c.customer_id
    AND p.unit_price > 2000
)
ORDER BY c.customer_id;
```

::: lesson m5-correlated

A **correlated subquery** mentions a column from the outer query, so it is
conceptually re-evaluated for every outer row. That makes it expressive — and
occasionally slow.

```sql
SELECT
  c.customer_id,
  c.last_name,
  (SELECT COUNT(*) FROM orders AS o WHERE o.customer_id = c.customer_id) AS orders,
  (SELECT MAX(o.order_date) FROM orders AS o WHERE o.customer_id = c.customer_id) AS last_order
FROM customers AS c
ORDER BY orders DESC, c.customer_id
LIMIT 10;
```

The same answer is available from a `LEFT JOIN … GROUP BY`. Which to prefer?

- **Correlated subqueries** read beautifully when you need one or two extra
  numbers per row, and they keep the outer grain untouched.
- **Joins with GROUP BY** scale better when you need many aggregates, because
  the data is scanned once instead of once per row.

## Row-wise comparisons

Correlation shines for "compare each row to its own group":

```sql
SELECT p.name, p.category_id, p.unit_price
FROM products AS p
WHERE p.unit_price > (
  SELECT AVG(p2.unit_price)
  FROM products AS p2
  WHERE p2.category_id = p.category_id
)
ORDER BY p.category_id, p.unit_price DESC;
```

"Products priced above the average **of their own category**." In Module 8 you
will write this with a window function, which is shorter and faster — but this
form works in every database ever made.

## Pulling a matching row's value

```sql
SELECT
  o.order_id,
  o.order_date,
  (SELECT p.name
   FROM order_items AS i
   JOIN products AS p ON p.product_id = i.product_id
   WHERE i.order_id = o.order_id
   ORDER BY i.quantity * i.unit_price DESC
   LIMIT 1) AS biggest_line
FROM orders AS o
ORDER BY o.order_id
LIMIT 10;
```

::: lesson m5-derived

A subquery in the `FROM` clause is a **derived table**: a result set you treat
as if it were a table. It is how you aggregate twice, or filter on an aggregate
you already computed.

```sql
SELECT ROUND(AVG(items), 2) AS avg_items_per_order
FROM (
  SELECT order_id, COUNT(*) AS items
  FROM order_items
  GROUP BY order_id
) AS per_order;
```

Give every derived table an alias — some databases insist on it, and every
reader benefits.

## Filter, then aggregate again

```sql
SELECT
  band,
  COUNT(*) AS customers,
  ROUND(AVG(revenue), 2) AS avg_revenue
FROM (
  SELECT
    o.customer_id,
    SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue,
    CASE
      WHEN SUM(i.quantity * i.unit_price * (1 - i.discount)) >= 8000 THEN 'whale'
      WHEN SUM(i.quantity * i.unit_price * (1 - i.discount)) >= 3000 THEN 'regular'
      ELSE 'occasional'
    END AS band
  FROM orders AS o
  JOIN order_items AS i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
) AS totals
GROUP BY band
ORDER BY avg_revenue DESC;
```

That query is correct but hard to read: the interesting logic is buried inside
brackets and the revenue expression appears three times. The next lesson fixes
exactly that.

## Joining a derived table

Aggregating each table at its own grain *before* joining is the standard cure
for the fan-out problem from Module 4:

```sql
SELECT
  o.order_id,
  o.shipping_cost,
  li.items,
  ROUND(li.goods_total, 2) AS goods_total
FROM orders AS o
JOIN (
  SELECT order_id, COUNT(*) AS items,
         SUM(quantity * unit_price * (1 - discount)) AS goods_total
  FROM order_items
  GROUP BY order_id
) AS li ON li.order_id = o.order_id
ORDER BY goods_total DESC
LIMIT 10;
```

Each order appears once, so `SUM(o.shipping_cost)` over this result would be
correct.

::: lesson m5-cte

A **CTE** (Common Table Expression) is a derived table given a name up front,
with `WITH`. Same power, far better reading order: top to bottom instead of
inside out.

```sql
WITH per_order AS (
  SELECT order_id, COUNT(*) AS items
  FROM order_items
  GROUP BY order_id
)
SELECT ROUND(AVG(items), 2) AS avg_items_per_order
FROM per_order;
```

## The shape

```sql-static
WITH name1 AS ( query1 ),
     name2 AS ( query2 )
SELECT …
FROM name1
JOIN name2 ON …
```

Rules:

- one `WITH`, then any number of named queries separated by commas
- a CTE may reference earlier CTEs in the same `WITH`
- the final `SELECT` is what you get back
- the names live only for that statement

## Rewriting the customer bands

The same logic as the previous lesson, now readable:

```sql
WITH customer_revenue AS (
  SELECT
    o.customer_id,
    SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue
  FROM orders AS o
  JOIN order_items AS i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
),
banded AS (
  SELECT
    customer_id,
    revenue,
    CASE
      WHEN revenue >= 8000 THEN 'whale'
      WHEN revenue >= 3000 THEN 'regular'
      ELSE 'occasional'
    END AS band
  FROM customer_revenue
)
SELECT band, COUNT(*) AS customers, ROUND(AVG(revenue), 2) AS avg_revenue
FROM banded
GROUP BY band
ORDER BY avg_revenue DESC;
```

The revenue expression is written once. Each step has a name you can say out
loud. You can comment out the last `SELECT`, run `SELECT * FROM customer_revenue`
instead, and inspect the intermediate result — which is how you debug big
queries.

::: lesson m5-cte-chain

Real analytical queries are chains: filter → aggregate → rank → join back.
CTEs let you build them one honest step at a time.

```sql
WITH completed AS (
  SELECT order_id, customer_id, order_date
  FROM orders
  WHERE status = 'completed'
),
lines AS (
  SELECT
    c.customer_id,
    c.order_date,
    i.quantity * i.unit_price * (1 - i.discount) AS line_revenue
  FROM completed AS c
  JOIN order_items AS i ON i.order_id = c.order_id
),
monthly AS (
  SELECT
    substr(order_date, 1, 7) AS month,
    ROUND(SUM(line_revenue), 2) AS revenue,
    COUNT(DISTINCT customer_id) AS buyers
  FROM lines
  GROUP BY month
)
SELECT *
FROM monthly
WHERE month >= '2025-01'
ORDER BY month;
```

## How to build one

1. Write the first CTE. Run `SELECT * FROM first_cte LIMIT 20;` and read the rows.
2. Add the next. Run it again.
3. Only when every step looks right, write the final `SELECT`.

## Reusing a CTE

Referencing the same CTE twice is legal and often useful — for example to
compare each row to an overall total:

```sql
WITH product_revenue AS (
  SELECT product_id, SUM(quantity * unit_price * (1 - discount)) AS revenue
  FROM order_items
  GROUP BY product_id
)
SELECT
  p.name,
  ROUND(r.revenue, 2) AS revenue,
  ROUND(100.0 * r.revenue / (SELECT SUM(revenue) FROM product_revenue), 2) AS pct_of_total
FROM product_revenue AS r
JOIN products AS p ON p.product_id = r.product_id
ORDER BY revenue DESC
LIMIT 10;
```

> Performance note: SQLite may either inline a CTE into the outer query or
> materialise it once. You can force the choice with `WITH x AS MATERIALIZED
> (…)` or `AS NOT MATERIALIZED (…)`. Reach for that only when a query plan tells
> you to — Module 10.

## CTE or subquery?

Use a CTE when the step deserves a name, when it is used twice, or when the
query is more than a few lines. Use an inline subquery for a one-line scalar.
Nobody has ever regretted naming a step.

::: lesson m5-checkpoint

You can now express almost any question, because you can compose queries. The
decision table:

| you need… | reach for |
| --- | --- |
| a single value to compare against | scalar subquery |
| "is it in this set?" | `IN (subquery)` |
| "does a related row exist?" | `EXISTS` |
| "are there no related rows?" | `NOT EXISTS` |
| a second level of aggregation | derived table or CTE |
| several named steps | chained CTEs |

A worked example — *customers whose completed-order revenue is above the average
customer's, with their rank position implied by the ordering*:

```sql
WITH revenue AS (
  SELECT o.customer_id,
         SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue
  FROM orders AS o
  JOIN order_items AS i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
)
SELECT
  c.last_name,
  ROUND(r.revenue, 2) AS revenue
FROM revenue AS r
JOIN customers AS c ON c.customer_id = r.customer_id
WHERE r.revenue > (SELECT AVG(revenue) FROM revenue)
ORDER BY revenue DESC
LIMIT 10;
```
