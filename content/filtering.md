::: lesson m2-where

`WHERE` keeps only the rows you care about. It sits between `FROM` and
`ORDER BY`, and the database applies it to **one row at a time**: if the
condition is true, the row survives.

```sql
SELECT name, unit_price
FROM products
WHERE unit_price > 1000
ORDER BY unit_price DESC;
```

## The comparison operators

| operator | meaning | example |
| --- | --- | --- |
| `=` | equal | `status = 'completed'` |
| `<>` or `!=` | not equal | `status <> 'cancelled'` |
| `<` `>` `<=` `>=` | ordering | `unit_price >= 500` |

Text comparisons need single quotes; numbers must not have them.

```sql
SELECT order_id, status, order_date
FROM orders
WHERE status = 'completed'
ORDER BY order_date DESC
LIMIT 10;
```

> [!warn]
> `WHERE unit_price > '1000'` compares a number with *text*. SQLite will happily
> run it and give you a surprising answer, because a number always sorts before
> a string. Quote text, never numbers.

## Dates are text — and that is fine

This database stores dates as `YYYY-MM-DD` strings. That format sorts
chronologically, so the normal operators work:

```sql
SELECT order_id, order_date, status
FROM orders
WHERE order_date >= '2025-01-01'
ORDER BY order_date
LIMIT 10;
```

Module 6 covers real date arithmetic (`date()`, `strftime()`, "how many days
between…").

## Filters run before SELECT

Logically, `WHERE` is evaluated *before* the `SELECT` list is computed, so in
standard SQL it cannot see an alias defined there:

```sql-static
SELECT unit_price * 0.9 AS sale_price
FROM products
WHERE sale_price < 100;     -- PostgreSQL / MySQL / SQL Server: no such column
```

SQLite is unusually permissive and accepts it anyway — try it in the
Playground. Do not lean on that: the same query fails on every other engine,
and the habit hides the execution order you need to understand. Repeat the
expression instead:

```sql
SELECT name, unit_price * 0.9 AS sale_price
FROM products
WHERE unit_price * 0.9 < 100
ORDER BY sale_price, product_id
LIMIT 8;
```

::: lesson m2-boolean

Conditions combine with `AND`, `OR` and `NOT`.

```sql
SELECT name, unit_price, units_in_stock
FROM products
WHERE unit_price < 200
  AND units_in_stock > 0
ORDER BY unit_price;
```

`AND` means both must hold; `OR` means at least one must.

## Precedence: AND binds tighter than OR

This is the single most common filtering bug in SQL:

```sql-static
WHERE country = 'USA' OR country = 'Canada' AND loyalty_tier = 'gold'
```

reads as `USA OR (Canada AND gold)` — every US customer comes back, gold or
not. Parentheses make the intent explicit and cost nothing:

```sql
SELECT customer_id, country, loyalty_tier
FROM customers
WHERE (country = 'USA' OR country = 'Canada')
  AND loyalty_tier = 'gold';
```

> Use brackets whenever `AND` and `OR` appear in the same `WHERE`. Reviewers
> should not have to remember precedence rules to check your logic.

## NOT

`NOT` negates the condition that follows it:

```sql
SELECT order_id, status
FROM orders
WHERE NOT status = 'completed'
LIMIT 10;
```

`WHERE status <> 'completed'` says the same thing more directly. `NOT` earns its
place in front of `IN`, `LIKE`, `EXISTS` and `BETWEEN`.

## Booleans in SQLite

SQLite has no separate boolean type: it uses `1` and `0`. That is why
`discontinued` is an integer, and why both of these work:

```sql
SELECT name, discontinued
FROM products
WHERE discontinued = 1;
```

```sql
SELECT COUNT(*) AS still_sold
FROM products
WHERE NOT discontinued;
```

::: lesson m2-in-between

## IN: one of a list

Instead of a chain of `OR`s, list the values:

```sql
SELECT customer_id, country, loyalty_tier
FROM customers
WHERE country IN ('Germany', 'France', 'Sweden')
ORDER BY country, customer_id;
```

`NOT IN` flips it:

```sql
SELECT order_id, status
FROM orders
WHERE status NOT IN ('cancelled', 'returned')
LIMIT 10;
```

> [!warn]
> `NOT IN` plus a NULL in the list returns **no rows at all**. `x NOT IN (1, 2,
> NULL)` can never be proven true, because x might equal that unknown value.
> This matters most when the list comes from a subquery — Module 5 has the full
> story, and `NOT EXISTS` is the safe alternative.

## BETWEEN: a range, inclusive at both ends

```sql
SELECT name, unit_price
FROM products
WHERE unit_price BETWEEN 200 AND 500
ORDER BY unit_price;
```

`BETWEEN 200 AND 500` is exactly `unit_price >= 200 AND unit_price <= 500`.
Both ends are included, and the low value must come first — `BETWEEN 500 AND
200` matches nothing.

It works on text and dates too:

```sql
SELECT order_id, order_date
FROM orders
WHERE order_date BETWEEN '2025-03-01' AND '2025-03-31'
ORDER BY order_date;
```

> [!warn]
> Careful with `BETWEEN` on timestamps. `paid_at BETWEEN '2025-03-01' AND
> '2025-03-31'` drops everything paid *during* the 31st, because
> `'2025-03-31 14:05:00'` is greater than `'2025-03-31'`. For timestamps prefer
> a half-open range: `paid_at >= '2025-03-01' AND paid_at < '2025-04-01'`.

```sql
SELECT COUNT(*) AS payments_in_march
FROM payments
WHERE paid_at >= '2025-03-01' AND paid_at < '2025-04-01';
```

::: lesson m2-like

`LIKE` matches text patterns with two wildcards:

- `%` — any run of characters, including none
- `_` — exactly one character

```sql
SELECT name
FROM products
WHERE name LIKE '%Bass%'
ORDER BY name;
```

| pattern | matches |
| --- | --- |
| `'Studio%'` | starts with Studio |
| `'%Cable'` | ends with Cable |
| `'%mic%'` | contains mic anywhere |
| `'_ass%'` | second-to-fourth letters are "ass" — Bass, Pass… |

```sql
SELECT email
FROM customers
WHERE email LIKE 'a%'
ORDER BY email;
```

## Case sensitivity

In SQLite, `LIKE` ignores case for ASCII letters, so `'%bass%'` and `'%BASS%'`
find the same rows. Most other databases are case-sensitive here, so the
portable habit is to be explicit:

```sql
SELECT name
FROM products
WHERE LOWER(name) LIKE '%guitar%'
ORDER BY name;
```

`GLOB` is SQLite's case-**sensitive** alternative, with file-glob syntax
(`*` and `?`):

```sql
SELECT name FROM products WHERE name GLOB '*Mic*';
```

## Matching a literal % or _

Escape it with a character of your choosing, declared via `ESCAPE`:

```sql
SELECT '100% cotton' LIKE '%!%%' ESCAPE '!' AS matches_percent;
```

> [!warn]
> A leading wildcard (`LIKE '%bass%'`) cannot use an index: the engine must read
> every row. Fine on 61 products, painful on 61 million. Module 10 explains
> what to do instead.

::: lesson m2-null

NULL is not zero and not an empty string. It means **unknown** — no value was
recorded. Some customers in our database have no country:

```sql
SELECT customer_id, first_name, country
FROM customers
WHERE country IS NULL;
```

## Any comparison with NULL is unknown

This is the rule that catches everyone:

```sql
SELECT
  NULL = NULL      AS null_equals_null,
  NULL <> NULL     AS null_differs,
  NULL = 'x'       AS null_equals_text,
  NULL IS NULL     AS is_null_test;
```

The first three come back NULL (not true, not false), only `IS NULL` gives a
definite answer. `WHERE` keeps a row only when the condition is **true**, so a
row whose value is NULL fails both `= 'USA'` and `<> 'USA'`:

```sql
SELECT COUNT(*) AS not_usa
FROM customers
WHERE country <> 'USA';
```

That count silently excludes the customers with no country at all. To include
them you must say so:

```sql
SELECT COUNT(*) AS not_usa_including_unknown
FROM customers
WHERE country <> 'USA' OR country IS NULL;
```

## Testing for NULL

Use `IS NULL` and `IS NOT NULL`. SQLite also has `IS` / `IS NOT`, which compare
NULLs as equal — handy when you want "different, treating NULL as a value":

```sql
SELECT order_id, ship_date
FROM orders
WHERE ship_date IS NULL
LIMIT 10;
```

## Replacing NULLs

`COALESCE(a, b, c, …)` returns the first argument that is not NULL.
`IFNULL(a, b)` is the two-argument shorthand.

```sql
SELECT
  customer_id,
  COALESCE(country, 'unknown')  AS country,
  IFNULL(city, '—')             AS city
FROM customers
WHERE country IS NULL;
```

> [!warn]
> NULL spreads through arithmetic too: `shipping_cost + NULL` is NULL, and
> `'Ada ' || NULL` is NULL. Wrap the nullable part in `COALESCE` before you
> compute with it.

::: lesson m2-case

`CASE` is SQL's if/else. It turns values into other values, right inside a
query.

```sql
SELECT
  name,
  unit_price,
  CASE
    WHEN unit_price >= 1500 THEN 'premium'
    WHEN unit_price >= 400  THEN 'mid'
    ELSE 'budget'
  END AS price_band
FROM products
ORDER BY unit_price DESC
LIMIT 12;
```

Rules worth knowing:

- conditions are tested **top to bottom**; the first true one wins
- without a matching branch and without `ELSE`, the result is NULL
- every branch should return the same kind of value

## The short form

When you are comparing one expression against constants, the simple form is
tidier:

```sql
SELECT
  status,
  CASE status
    WHEN 'completed' THEN 'money in'
    WHEN 'shipped'   THEN 'on its way'
    WHEN 'returned'  THEN 'money out'
    ELSE 'not fulfilled'
  END AS bucket
FROM orders
LIMIT 10;
```

## CASE is an expression, so it goes anywhere

Sort by a custom priority:

```sql
SELECT order_id, status
FROM orders
ORDER BY
  CASE status
    WHEN 'processing' THEN 1
    WHEN 'shipped'    THEN 2
    WHEN 'completed'  THEN 3
    ELSE 4
  END,
  order_id
LIMIT 12;
```

…or filter with it, though a plain `WHERE` is usually clearer.

`IIF(condition, then, else)` is a compact two-branch `CASE`:

```sql
SELECT name, IIF(discontinued = 1, 'retired', 'active') AS state
FROM products
LIMIT 8;
```

In Module 3 you will put `CASE` inside `SUM()` to count things conditionally —
one of the most useful tricks in all of SQL.

::: lesson m2-checkpoint

Time to combine everything from Modules 1 and 2. Nothing new here — just
questions that need two or three ideas at once.

A checklist for building a filter:

1. Which table holds the rows? → `FROM`
2. Which rows do I want to keep? → `WHERE`, one condition at a time
3. Are NULLs possible in those columns? → decide whether they should survive
4. Which columns do I want, and what should they be called? → `SELECT … AS`
5. In what order, and how many? → `ORDER BY`, `LIMIT`

Here is a query that uses all of it — products that are worth restocking:

```sql
SELECT
  name,
  units_in_stock,
  COALESCE(reorder_level, 0) AS reorder_level,
  CASE
    WHEN units_in_stock = 0 THEN 'out of stock'
    WHEN units_in_stock <= COALESCE(reorder_level, 0) THEN 'reorder now'
    ELSE 'ok'
  END AS stock_state
FROM products
WHERE discontinued = 0
  AND units_in_stock <= COALESCE(reorder_level, 0)
ORDER BY units_in_stock, name;
```

Read it clause by clause and make sure each line earns its place — that is
exactly how you will read other people's SQL for the rest of your career.
