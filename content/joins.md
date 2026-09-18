::: lesson m4-why

Real data is split across tables on purpose. `orders` does not repeat the
customer's name and email in every row — it stores a `customer_id` and lets the
`customers` table hold the details. That is **normalisation**, and it means:

- a fact is stored once, so it cannot disagree with itself
- updating an email touches one row, not thousands

The price is that answering "which customers placed these orders?" means putting
the tables back together. That is what a **join** does.

## The mechanism

A join is a matching exercise. For each row on the left, find the rows on the
right where the condition holds, and stick them side by side:

```sql-static
customers                      orders
+-------------+------+         +----------+-------------+
| customer_id | name |         | order_id | customer_id |
+-------------+------+         +----------+-------------+
| 1           | Ada  |  <----  | 1001     | 1           |
| 2           | Ben  |  <----  | 1002     | 1           |
+-------------+------+         | 1003     | 2           |
                               +----------+-------------+
```

Customer 1 matches two orders, so Ada appears twice in the result — once per
order. **A join changes how many rows you have.** Keeping track of that is most
of the skill.

## Finding the join condition

Look for a foreign key: a column in one table holding the primary key of
another.

| from | to | condition |
| --- | --- | --- |
| `orders.customer_id` | `customers.customer_id` | `o.customer_id = c.customer_id` |
| `order_items.product_id` | `products.product_id` | `i.product_id = p.product_id` |
| `products.category_id` | `categories.category_id` | `p.category_id = c.category_id` |
| `employees.manager_id` | `employees.employee_id` | `e.manager_id = m.employee_id` |

The Schema page draws all of them. Here is the first one in action:

```sql
SELECT
  c.first_name,
  c.last_name,
  o.order_id,
  o.order_date
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
ORDER BY o.order_id
LIMIT 10;
```

`AS o` and `AS c` are **table aliases**. With more than one table they stop
being decoration: they tell the reader (and the engine) which table each column
belongs to.

::: lesson m4-inner

`INNER JOIN` — usually written just `JOIN` — keeps only the rows that match on
both sides.

```sql
SELECT
  p.name      AS product,
  s.name      AS supplier,
  s.country
FROM products AS p
JOIN suppliers AS s ON s.supplier_id = p.supplier_id
ORDER BY p.product_id
LIMIT 10;
```

## Anatomy

```sql-static
FROM   left_table  AS l
JOIN   right_table AS r   ON  r.key = l.key
```

- `JOIN` names the second table
- `ON` says how rows correspond

Conditions can be more than equality, and can involve several columns:
`ON r.key = l.key AND r.valid_from <= l.event_date`.

## Filtering a join

`WHERE` still filters the combined rows:

```sql
SELECT
  p.name,
  p.unit_price,
  s.name AS supplier
FROM products AS p
JOIN suppliers AS s ON s.supplier_id = p.supplier_id
WHERE s.country = 'Japan'
  AND p.unit_price > 500
ORDER BY p.unit_price DESC;
```

## USING and NATURAL JOIN

When the columns on both sides have the same name, `USING` is shorter — and it
merges the two columns into one in the output:

```sql
SELECT order_id, product_id, quantity, name
FROM order_items
JOIN products USING (product_id)
ORDER BY order_id
LIMIT 5;
```

`NATURAL JOIN` goes further and joins on *every* column with a matching name.
Avoid it: add a column called `name` to two tables and your query silently
starts returning different rows.

> [!warn]
> Forgetting `ON` produces a cross join — every row paired with every row.
> `order_items` × `products` is 1,436 × 61 = 87,596 rows. The query "works",
> which is exactly what makes it dangerous.

::: lesson m4-left

`INNER JOIN` drops rows that have no match. Often that is wrong: a customer with
no orders is still a customer.

`LEFT JOIN` keeps **every row from the left table**, filling the right-hand
columns with NULL when nothing matches.

```sql
SELECT
  c.customer_id,
  c.last_name,
  o.order_id,
  o.order_date
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.customer_id
ORDER BY c.customer_id
LIMIT 15;
```

Scroll down the result: the customers with no orders are there, with NULLs where
the order should be.

## The anti-join: finding what is missing

Add `WHERE <right column> IS NULL` and you get exactly the unmatched rows —
"customers who have never ordered":

```sql
SELECT
  c.customer_id,
  c.first_name,
  c.last_name
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
ORDER BY c.customer_id;
```

This pattern answers a whole family of questions: products never sold,
employees with no orders, categories with no products.

## The trap: WHERE turns a LEFT JOIN back into an INNER JOIN

Compare these two. The first keeps every customer; the second silently drops
customers whose orders are all cancelled:

```sql
SELECT c.customer_id, COUNT(o.order_id) AS completed_orders
FROM customers AS c
LEFT JOIN orders AS o
       ON o.customer_id = c.customer_id
      AND o.status = 'completed'      -- condition lives in the JOIN
GROUP BY c.customer_id
ORDER BY completed_orders, c.customer_id
LIMIT 10;
```

```sql
SELECT c.customer_id, COUNT(o.order_id) AS completed_orders
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.customer_id
WHERE o.status = 'completed'          -- condition in WHERE: kills the NULL rows
GROUP BY c.customer_id
ORDER BY completed_orders, c.customer_id
LIMIT 10;
```

Rule of thumb: **conditions on the optional table belong in `ON`; conditions on
the mandatory table belong in `WHERE`.**

## RIGHT and FULL

`RIGHT JOIN` keeps every row from the right table (modern SQLite supports it;
older versions did not, which is why you rarely see it — people just swap the
table order). `FULL OUTER JOIN` keeps unmatched rows from both sides.

::: lesson m4-multi

Nothing stops you joining more than two tables. Each `JOIN` adds another
matching step, and the result of the previous joins becomes the new left side.

```sql
SELECT
  o.order_id,
  o.order_date,
  c.last_name AS customer,
  p.name      AS product,
  i.quantity,
  i.unit_price
FROM orders AS o
JOIN customers   AS c ON c.customer_id = o.customer_id
JOIN order_items AS i ON i.order_id    = o.order_id
JOIN products    AS p ON p.product_id  = i.product_id
ORDER BY o.order_id, i.item_no
LIMIT 15;
```

Read it as a chain: orders → their customer → their line items → the product on
each line.

## Grain: what is one row?

Before that join, one row was one order. After it, one row is **one line item**.
That is the query's *grain*, and every later clause depends on it. Say it out
loud when you write a join — most join bugs are grain confusion.

## Mixing inner and outer joins

They combine freely, but order matters: once you `LEFT JOIN` a table, an
`INNER JOIN` onto that table's columns will drop the NULL-filled rows again.

```sql
SELECT
  p.name AS product,
  c.name AS category,
  s.name AS supplier
FROM products AS p
JOIN categories AS c ON c.category_id = p.category_id
LEFT JOIN suppliers AS s ON s.supplier_id = p.supplier_id
ORDER BY p.product_id
LIMIT 10;
```

## Building a big join safely

1. start with the table whose grain you want
2. add one join, run it, check the row count did not explode
3. add the next join, run it again
4. only then add `WHERE`, `GROUP BY` and the rest

::: lesson m4-self

A **self join** is a table joined to itself under two different aliases. It is
how you relate a row to another row in the same table — the classic case being
an employee and their manager.

```sql
SELECT
  e.employee_id,
  e.first_name || ' ' || e.last_name AS employee,
  e.title,
  m.first_name || ' ' || m.last_name AS manager
FROM employees AS e
LEFT JOIN employees AS m ON m.employee_id = e.manager_id
ORDER BY e.employee_id;
```

`LEFT JOIN` matters here: the CEO has no manager, and an inner join would make
her disappear.

## Pairing rows with each other

Self joins also find pairs within a table. To list customers who live in the
same city, join on city and keep one row per pair with `<`:

```sql
SELECT
  a.city,
  a.last_name AS customer_a,
  b.last_name AS customer_b
FROM customers AS a
JOIN customers AS b
  ON b.city = a.city
 AND b.customer_id > a.customer_id
ORDER BY a.city, a.customer_id, b.customer_id
LIMIT 15;
```

Without `b.customer_id > a.customer_id` you would get every pair twice, plus
every customer paired with themselves.

> Self joins reach one level at a time. For "everyone below this manager, all
> the way down", you need a recursive CTE — Module 9.

::: lesson m4-cross

`CROSS JOIN` pairs every row on the left with every row on the right. No `ON`
clause, no matching: 61 products × 12 suppliers = 732 rows.

Used deliberately it builds complete grids — every combination that *should*
exist, so you can spot the ones that do not:

```sql
SELECT
  s.name AS supplier,
  b.band,
  COUNT(p.product_id) AS products
FROM suppliers AS s
CROSS JOIN (SELECT 'budget' AS band UNION ALL SELECT 'premium') AS b
LEFT JOIN products AS p
       ON p.supplier_id = s.supplier_id
      AND ((b.band = 'budget'  AND p.unit_price <  500)
        OR (b.band = 'premium' AND p.unit_price >= 500))
GROUP BY s.name, b.band
ORDER BY s.name, b.band
LIMIT 12;
```

The same trick fills date grids so that days with no sales still appear as zero
(Module 9 does this properly with a recursive date spine).

## Accidental cross joins

Far more often, a cross join is a mistake:

```sql-static
FROM orders, customers            -- old comma syntax, no condition = cross join
FROM orders o JOIN customers c ON 1 = 1
```

Symptoms: the row count is suspiciously round (a multiple of the small table),
totals are inflated by a constant factor, and the query is slow. Always write
`JOIN … ON …` explicitly; the comma form hides the missing condition.

```sql
SELECT COUNT(*) AS pairs FROM suppliers CROSS JOIN categories;
```

::: lesson m4-agg

Joins plus `GROUP BY` is where most real reporting lives — and where the most
expensive mistakes hide.

## Revenue per product, properly labelled

```sql
SELECT
  p.name AS product,
  SUM(i.quantity) AS units_sold,
  ROUND(SUM(i.quantity * i.unit_price * (1 - i.discount)), 2) AS revenue
FROM order_items AS i
JOIN products AS p ON p.product_id = i.product_id
GROUP BY p.product_id, p.name
ORDER BY revenue DESC
LIMIT 10;
```

Group by the **id** as well as the name: two products could share a name, and
grouping by id keeps the groups honest.

## Counting after a LEFT JOIN

`COUNT(*)` counts rows — including the NULL-filled ones a `LEFT JOIN` invents.
`COUNT(o.order_id)` counts actual matches, so customers with no orders get 0:

```sql
SELECT
  c.customer_id,
  COUNT(*)            AS rows_counted,
  COUNT(o.order_id)   AS real_orders
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.customer_id
GROUP BY c.customer_id
ORDER BY real_orders, c.customer_id
LIMIT 8;
```

## The fan-out trap

Join `orders` to `order_items` and each order is repeated once per line item. Any
order-level number — `shipping_cost`, for instance — is then counted several
times:

```sql
SELECT
  ROUND(SUM(o.shipping_cost), 2) AS shipping_inflated,
  ROUND(SUM(DISTINCT o.shipping_cost), 2) AS still_wrong,
  COUNT(*) AS item_rows
FROM orders AS o
JOIN order_items AS i ON i.order_id = o.order_id;
```

Compare with the truth:

```sql
SELECT ROUND(SUM(shipping_cost), 2) AS shipping_correct, COUNT(*) AS order_rows
FROM orders;
```

`SUM(DISTINCT …)` is not a fix — it removes genuinely equal values too. The real
fixes are to aggregate each table at its own grain first (Module 5's CTEs), or
to use a window function (Module 8).

> Before you sum anything after a join, ask: *is this column at the grain of the
> joined result, or at the grain of one of the original tables?*

::: lesson m4-sets

Set operators stack result sets **vertically** — a join is horizontal, a union
is vertical. Both sides must have the same number of columns, in compatible
types.

## UNION ALL and UNION

```sql
SELECT 'customer' AS kind, first_name, last_name FROM customers
UNION ALL
SELECT 'employee', first_name, last_name FROM employees
ORDER BY kind, last_name
LIMIT 12;
```

- `UNION ALL` concatenates. Fast, keeps duplicates.
- `UNION` removes duplicate rows — which means sorting or hashing everything.

Use `UNION ALL` unless you actually need the de-duplication.

Only one `ORDER BY` is allowed, at the very end, and it applies to the combined
result. Column names come from the first `SELECT`.

## INTERSECT and EXCEPT

`INTERSECT` keeps rows present in both results; `EXCEPT` keeps rows from the
first that are not in the second.

```sql
SELECT product_id FROM order_items
INTERSECT
SELECT product_id FROM reviews
ORDER BY product_id
LIMIT 10;
```

```sql
SELECT product_id FROM products
EXCEPT
SELECT product_id FROM order_items
ORDER BY product_id;
```

That last query — products that have never been sold — is the same question the
`LEFT JOIN … IS NULL` anti-join answers. `EXCEPT` is more readable when you are
comparing whole rows; the anti-join wins when you need columns from the left
table as well.

> [!warn]
> `EXCEPT` and `INTERSECT` compare **entire rows** and, unlike `NOT IN`, treat
> NULLs as equal to each other. They also remove duplicates, which occasionally
> matters.

::: lesson m4-checkpoint

Joins are the skill that separates "I can query a table" from "I can answer a
question". A checklist for writing one:

1. **Which tables hold the facts I need?**
2. **What is one row in my answer?** (the grain)
3. **Which table drives the row count?** — that is the leftmost table
4. **Should unmatched rows survive?** — yes → `LEFT JOIN`; no → `JOIN`
5. **Where does each filter belong?** — optional table → `ON`; required → `WHERE`
6. **Am I summing anything that got duplicated by the join?**

A worked example — *the top 5 categories by revenue, with how many distinct
orders each one appeared in*:

```sql
SELECT
  cat.name AS category,
  COUNT(DISTINCT o.order_id) AS orders,
  ROUND(SUM(i.quantity * i.unit_price * (1 - i.discount)), 2) AS revenue
FROM order_items AS i
JOIN orders     AS o   ON o.order_id    = i.order_id
JOIN products   AS p   ON p.product_id  = i.product_id
JOIN categories AS cat ON cat.category_id = p.category_id
WHERE o.status = 'completed'
GROUP BY cat.category_id, cat.name
ORDER BY revenue DESC
LIMIT 5;
```

Note `COUNT(DISTINCT o.order_id)`: the join repeated each order once per line
item, and `DISTINCT` undoes that for the count.
