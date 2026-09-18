::: lesson m6-types

Most databases are strict about types: a column declared `INTEGER` holds
integers, full stop. SQLite is unusual — it uses **type affinity**. The declared
type is a preference, and each *value* carries its own storage class:
`NULL`, `INTEGER`, `REAL`, `TEXT` or `BLOB`.

```sql
SELECT
  typeof(product_id)   AS id_type,
  typeof(name)         AS name_type,
  typeof(unit_price)   AS price_type,
  typeof(reorder_level) AS reorder_type
FROM products
LIMIT 3;
```

Note `reorder_level`: it is `INTEGER` for most rows and `null` for the rows
where nothing was recorded.

## Why this matters

Comparisons between different storage classes follow a fixed order —
NULL < numbers < text < blob — so a number is **always** smaller than any
string:

```sql
SELECT
  5 < '3'      AS number_vs_text,
  '5' < '30'   AS text_vs_text,
  5 < 30       AS number_vs_number;
```

`'5' < '30'` is false because text compares character by character: `'5'` beats
`'3'`. Quote your numbers by accident and your filters go quietly wrong.

## CAST

`CAST(value AS type)` converts explicitly:

```sql
SELECT
  '42' + 0             AS implicit_number,
  CAST('42' AS INTEGER) AS cast_integer,
  CAST(unit_price AS INTEGER) AS truncated_price,
  CAST(7 AS REAL) / 2   AS real_division
FROM products
LIMIT 3;
```

`CAST(x AS INTEGER)` **truncates** towards zero — it does not round. Use
`ROUND()` when you want rounding.

## Integer division

```sql
SELECT
  7 / 2        AS integer_division,
  7 / 2.0      AS real_division,
  7 * 1.0 / 2  AS also_real;
```

This is the single most common cause of "why is my percentage 0?".

> [!warn]
> Other databases (PostgreSQL, SQL Server…) reject a string inserted into an
> integer column; SQLite stores it happily. When you write SQL that has to run
> elsewhere, be explicit about types rather than relying on SQLite's tolerance.

::: lesson m6-text

The text functions you will actually use:

| function | does |
| --- | --- |
| `LENGTH(s)` | characters in s |
| `UPPER(s)` / `LOWER(s)` | change case |
| `SUBSTR(s, start, len)` | slice (1-based!) |
| `TRIM(s)`, `LTRIM`, `RTRIM` | strip whitespace (or given characters) |
| `REPLACE(s, find, with)` | substitute |
| `INSTR(s, needle)` | position, 0 if absent |
| `s1 \|\| s2` | concatenate |
| `printf(fmt, …)` / `format(…)` | formatted output |

```sql
SELECT
  name,
  LENGTH(name)              AS chars,
  UPPER(SUBSTR(name, 1, 3)) AS prefix,
  REPLACE(name, ' ', '-')   AS slug
FROM products
ORDER BY product_id
LIMIT 8;
```

## Splitting an email

```sql
SELECT
  email,
  SUBSTR(email, 1, INSTR(email, '@') - 1)  AS local_part,
  SUBSTR(email, INSTR(email, '@') + 1)     AS domain
FROM customers
ORDER BY customer_id
LIMIT 6;
```

`SUBSTR` with two arguments runs to the end of the string. Negative starting
positions count from the right: `SUBSTR(email, -4)` gives the last four
characters.

## Formatting numbers into text

```sql
SELECT
  name,
  printf('%.2f', unit_price)           AS price_text,
  printf('%-28s %8.2f', name, unit_price) AS padded_line
FROM products
ORDER BY unit_price DESC
LIMIT 5;
```

## Case-insensitive matching, portably

```sql
SELECT COUNT(*) AS guitars
FROM products
WHERE LOWER(name) LIKE '%guitar%';
```

> [!warn]
> Wrapping a column in a function (`LOWER(name)`, `SUBSTR(email, …)`) inside
> `WHERE` prevents an ordinary index on that column from being used. It is fine
> on small tables; Module 10 shows the alternatives (expression indexes, storing
> a normalised copy).

::: lesson m6-numbers

```sql
SELECT
  ROUND(1234.5678, 2)  AS two_dp,
  ROUND(1234.5678, -2) AS to_hundreds,
  ABS(-42)             AS absolute,
  MAX(3, 9)            AS bigger_of_two,
  MIN(3, 9)            AS smaller_of_two;
```

`MIN`/`MAX` with **several arguments** are scalar functions — completely
different from the aggregates with the same name. Handy for clamping values.

## Rounding money

Floating point cannot represent every decimal exactly, so totals can drift by a
fraction of a cent:

```sql
SELECT
  0.1 + 0.2 = 0.3                   AS looks_wrong,
  ROUND(0.1 + 0.2, 10) = 0.3        AS after_rounding;
```

Round **once, at the end** of a calculation, not on every intermediate step. For
real money, many teams store integer cents instead of floats.

## Percentages and ratios

```sql
SELECT
  status,
  COUNT(*) AS orders,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 2) AS pct
FROM orders
GROUP BY status
ORDER BY orders DESC;
```

## Bucketing with integer arithmetic

Integer division makes tidy buckets:

```sql
SELECT
  (CAST(unit_price AS INTEGER) / 500) * 500 AS price_bucket,
  COUNT(*) AS products
FROM products
GROUP BY price_bucket
ORDER BY price_bucket;
```

::: lesson m6-dates

SQLite has no dedicated date type. Dates live in `TEXT` as ISO-8601 strings
(`'2025-03-14'`, `'2025-03-14 09:30:00'`), which sort correctly and work with
every date function.

> The sample data ends on **2025-06-30** — treat that as "today" in exercises,
> rather than `date('now')`, so answers stay stable.

## The four workhorses

```sql
SELECT
  date('2025-03-14 09:30:00')                AS just_the_date,
  time('2025-03-14 09:30:00')                AS just_the_time,
  datetime('2025-03-14 09:30:00')            AS full,
  strftime('%Y-%m', '2025-03-14')            AS year_month,
  julianday('2025-03-14')                    AS julian_day_number;
```

`strftime` formats (and extracts):

| pattern | meaning | example |
| --- | --- | --- |
| `%Y` | 4-digit year | 2025 |
| `%m` | month 01–12 | 03 |
| `%d` | day 01–31 | 14 |
| `%H:%M:%S` | time | 09:30:00 |
| `%W` | week of year | 10 |
| `%w` | weekday, 0 = Sunday | 5 |
| `%j` | day of year | 073 |

```sql
SELECT
  strftime('%Y', order_date)  AS year,
  strftime('%m', order_date)  AS month,
  COUNT(*)                    AS orders
FROM orders
GROUP BY year, month
ORDER BY year, month
LIMIT 12;
```

## Modifiers: date arithmetic

Pass modifiers to shift a date:

```sql
SELECT
  date('2025-03-14', '+7 days')          AS next_week,
  date('2025-03-14', '-1 month')         AS last_month,
  date('2025-03-14', 'start of month')   AS month_start,
  date('2025-03-14', 'start of month', '+1 month', '-1 day') AS month_end,
  date('2025-03-14', 'weekday 0')        AS next_sunday;
```

`'start of month', '+1 month', '-1 day'` is the standard way to get the last day
of a month — a pattern worth memorising.

## Current date and time

```sql
SELECT date('now') AS today, datetime('now') AS now_utc;
```

`'now'` is UTC. Add `'localtime'` to shift into the machine's timezone.

::: lesson m6-date-math

## How far apart are two dates?

`julianday()` turns a date into a number of days, so subtraction just works:

```sql
SELECT
  order_id,
  order_date,
  ship_date,
  CAST(julianday(ship_date) - julianday(order_date) AS INTEGER) AS days_to_ship
FROM orders
WHERE ship_date IS NOT NULL
ORDER BY days_to_ship DESC
LIMIT 10;
```

Average fulfilment time, by status:

```sql
SELECT
  status,
  COUNT(*) AS orders,
  ROUND(AVG(julianday(ship_date) - julianday(order_date)), 2) AS avg_days_to_ship
FROM orders
WHERE ship_date IS NOT NULL
GROUP BY status
ORDER BY avg_days_to_ship;
```

## Ages and anniversaries

Age in whole years is a subtraction of formatted dates — the comparison handles
"has the birthday happened yet?" automatically:

```sql
SELECT
  customer_id,
  birth_date,
  CAST((strftime('%Y%m%d', '2025-06-30') - strftime('%Y%m%d', birth_date)) / 10000 AS INTEGER) AS age
FROM customers
WHERE birth_date IS NOT NULL
ORDER BY age DESC
LIMIT 10;
```

## Recency buckets

```sql
SELECT
  CASE
    WHEN julianday('2025-06-30') - julianday(order_date) <= 30  THEN '0-30 days'
    WHEN julianday('2025-06-30') - julianday(order_date) <= 90  THEN '31-90 days'
    WHEN julianday('2025-06-30') - julianday(order_date) <= 365 THEN '91-365 days'
    ELSE 'over a year'
  END AS recency,
  COUNT(*) AS orders
FROM orders
GROUP BY recency
ORDER BY orders DESC;
```

## Grouping by period

```sql
SELECT
  date(order_date, 'start of month') AS month,
  COUNT(*) AS orders,
  ROUND(SUM(shipping_cost), 2) AS shipping
FROM orders
WHERE order_date >= '2025-01-01'
GROUP BY month
ORDER BY month;
```

> [!warn]
> Filtering with a function on the column (`WHERE strftime('%Y', order_date) =
> '2025'`) forces a full scan. `WHERE order_date >= '2025-01-01' AND order_date
> < '2026-01-01'` means the same thing and can use an index.

::: lesson m6-nullfns

Functions that deal with missing or sentinel values.

| function | returns |
| --- | --- |
| `COALESCE(a, b, …)` | first non-NULL argument |
| `IFNULL(a, b)` | two-argument COALESCE |
| `NULLIF(a, b)` | NULL if a = b, otherwise a |
| `IIF(cond, x, y)` | compact CASE |

```sql
SELECT
  customer_id,
  COALESCE(city, country, 'unknown') AS best_known_location,
  IIF(referred_by IS NULL, 'organic', 'referred') AS acquisition
FROM customers
ORDER BY customer_id
LIMIT 10;
```

## NULLIF guards division

Dividing by zero gives NULL in SQLite rather than an error, but the idiom below
is portable and self-documenting — turn the zero into NULL and let NULL
propagate:

```sql
SELECT
  o.order_id,
  ROUND(o.shipping_cost / NULLIF(i.items, 0), 2) AS shipping_per_item
FROM orders AS o
JOIN (SELECT order_id, COUNT(*) AS items FROM order_items GROUP BY order_id) AS i
  ON i.order_id = o.order_id
ORDER BY o.order_id
LIMIT 8;
```

`NULLIF` also rescues "empty string means missing" data:
`NULLIF(TRIM(column), '')`.

## Sorting NULLs where you want them

```sql
SELECT name, reorder_level
FROM products
ORDER BY reorder_level IS NULL, reorder_level DESC
LIMIT 10;
```

`reorder_level IS NULL` evaluates to 0 or 1, so NULLs sort last. `NULLS LAST`
does the same in engines that support it (SQLite does).

::: lesson m6-json

Modern SQLite ships the JSON1 functions, so a text column holding JSON is
queryable. `product_meta.attributes` holds documents like
`{"colour": "black", "weight_kg": 3.4, "warranty_months": 24, "tags": ["pro", "studio"]}`.

## Reading a field

```sql
SELECT
  product_id,
  json_extract(attributes, '$.colour')          AS colour,
  json_extract(attributes, '$.warranty_months') AS warranty_months
FROM product_meta
ORDER BY product_id
LIMIT 8;
```

`->>` is the shorthand operator (SQLite 3.38+), returning a plain SQL value:

```sql
SELECT
  product_id,
  attributes ->> '$.colour'     AS colour,
  attributes ->> '$.weight_kg'  AS weight_kg
FROM product_meta
ORDER BY product_id
LIMIT 5;
```

(`->` returns JSON, `->>` returns text/number. Use `->>` unless you are chaining
into another JSON function.)

## Filtering and grouping on JSON

```sql
SELECT
  attributes ->> '$.colour' AS colour,
  COUNT(*) AS products
FROM product_meta
GROUP BY colour
ORDER BY products DESC;
```

## Arrays: json_each

`json_each` expands an array into rows, so you can join against it:

```sql
SELECT
  t.value AS tag,
  COUNT(*) AS products
FROM product_meta AS m
JOIN json_each(m.attributes, '$.tags') AS t
GROUP BY tag
ORDER BY products DESC;
```

Find every product tagged `bestseller`:

```sql
SELECT p.product_id, p.name
FROM product_meta AS m
JOIN products AS p ON p.product_id = m.product_id
WHERE EXISTS (
  SELECT 1 FROM json_each(m.attributes, '$.tags') AS t WHERE t.value = 'bestseller'
)
ORDER BY p.product_id
LIMIT 10;
```

## Building JSON

```sql
SELECT json_object(
  'product_id', product_id,
  'name', name,
  'price', unit_price
) AS doc
FROM products
ORDER BY product_id
LIMIT 3;
```

`json_group_array` and `json_group_object` aggregate rows into a document.

> [!warn]
> JSON columns are flexible, not free: every read parses the document and no
> ordinary index helps. If you filter on a field constantly, promote it to a
> real column (or add an expression index over `attributes ->> '$.field'`).
