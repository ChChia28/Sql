::: lesson m1-tables

SQL is how you talk to a **relational database**. A relational database stores
data in **tables** — and a table is just a grid with very strict rules:

- every **column** has a name and a type (text, number, date-as-text…)
- every **row** is one thing: one product, one order, one customer
- the order of the rows means nothing until you ask for a specific order

Here is the whole idea in one query. Press **Run** and look at what comes back.

```sql
SELECT * FROM products LIMIT 5;
```

Four things just happened:

| piece | meaning |
| --- | --- |
| `SELECT` | "give me some columns" |
| `*` | "all of them" |
| `FROM products` | "from the table called products" |
| `LIMIT 5` | "stop after 5 rows" |

The semicolon ends the statement. SQLite forgives a missing one at the end of a
single query, but get into the habit — you will soon run several statements at
once.

## SQL is a request, not a recipe

In most programming languages you say *how* to do something: loop over this
list, keep a counter, compare each item. In SQL you describe *what you want*,
and the database works out how to get it. That is why a single line can churn
through a million rows.

## The store you will be working with

Every lesson uses the same small dataset: an online music-gear shop. It has a
catalogue, customers, staff, orders and reviews.

```sql
SELECT * FROM customers LIMIT 5;
```

Two columns deserve a name right away:

- **Primary key** — the column that identifies a row uniquely. `customer_id` in
  `customers`, `product_id` in `products`. No duplicates, never empty.
- **Foreign key** — a column that points at another table's primary key.
  `orders.customer_id` says *which* customer placed the order.

Those links are what makes the database *relational*, and in Module 4 you will
use them to combine tables.

> Open the **Schema** page in the top navigation at any time to see every table,
> every column and how they connect. You will use it constantly at first.

## Counting things

`COUNT(*)` answers "how many rows?".

```sql
SELECT COUNT(*) FROM orders;
```

One row, one column, one number. Result sets are always tables — even when the
table is 1×1.

::: lesson m1-select

`SELECT *` is convenient while exploring, but in real queries you name the
columns you actually want. It is faster, and — more importantly — the result
stops changing when somebody adds a column to the table.

```sql
SELECT name, unit_price, units_in_stock
FROM products
LIMIT 10;
```

The rules are simple:

- list the columns after `SELECT`, separated by commas
- the result columns appear in the order **you** wrote them, not the table's order
- no trailing comma before `FROM` (the most common beginner typo)

```sql
SELECT first_name, last_name, country
FROM customers
LIMIT 8;
```

## Case and whitespace

SQL keywords are case-insensitive: `select`, `SELECT` and `SeLeCt` all work.
Almost everyone writes keywords in upper case and names in lower case, because
it makes the shape of a query readable at a glance.

Line breaks and indentation mean nothing to the engine, so use them freely:

```sql
SELECT
  name,
  unit_price
FROM products
LIMIT 3;
```

> [!warn]
> Table and column *names* are not case-sensitive in SQLite, but **text values
> are**: `'Gold'` and `'gold'` are different strings. That bites everyone once.

::: lesson m1-expressions

A `SELECT` list can hold more than bare column names. Anything that produces a
value is allowed: arithmetic, function calls, literals.

```sql
SELECT
  name,
  unit_price,
  unit_price * 0.9,
  units_in_stock * unit_price
FROM products
LIMIT 5;
```

Those computed columns get unhelpful auto-generated names. Fix that with `AS` —
an **alias**:

```sql
SELECT
  name,
  unit_price AS list_price,
  ROUND(unit_price * 0.9, 2) AS sale_price,
  ROUND(units_in_stock * unit_price, 2) AS stock_value
FROM products
LIMIT 5;
```

`AS` is optional (`unit_price list_price` works) but write it anyway; it reads
better. If an alias needs spaces or punctuation, wrap it in double quotes:
`AS "sale price"`.

## Joining text together

`||` glues strings. In SQLite it is the concatenation operator, not "or".

```sql
SELECT
  first_name || ' ' || last_name AS full_name,
  UPPER(country) AS country
FROM customers
LIMIT 6;
```

## Literals

A constant value is a perfectly good column, which is handy for tagging rows:

```sql
SELECT name, 'active catalogue' AS source, 1 AS version
FROM products
LIMIT 3;
```

> [!warn]
> Single quotes are for **text values**. Double quotes are for **identifiers**
> (column and table names). Writing `WHERE country = "USA"` sometimes appears to
> work in SQLite, but it is asking for a *column* named USA and will bite you
> in every other database.

::: lesson m1-distinct

`DISTINCT` removes duplicate rows from a result. Ask "which countries do our
customers come from?" and you want the list, not one entry per customer.

```sql
SELECT DISTINCT country
FROM customers;
```

Without `DISTINCT` you would get 80 rows, most of them repeats.

`DISTINCT` applies to the **whole row**, not to one column. Two columns means
distinct *combinations*:

```sql
SELECT DISTINCT country, city
FROM customers;
```

That is a different question — "which country/city pairs exist?" — and returns
more rows than the country list alone.

## Counting distinct values

`COUNT(DISTINCT column)` is the natural follow-up question:

```sql
SELECT
  COUNT(*)                 AS customer_rows,
  COUNT(DISTINCT country)  AS countries,
  COUNT(country)           AS rows_with_country
FROM customers;
```

Look closely at the last two numbers. `COUNT(column)` skips NULLs (missing
values) while `COUNT(*)` counts rows regardless — the difference tells you how
many customers have no country recorded. NULL gets a whole lesson of its own in
Module 2.

> [!warn]
> `DISTINCT` is not free: the database has to sort or hash every row to find the
> duplicates. If you find yourself sprinkling it everywhere to "fix" repeated
> rows after a join, the join is usually the real problem.

::: lesson m1-order

Rows come back in whatever order the engine finds convenient. If you care about
order — and you usually do — say so with `ORDER BY`.

```sql
SELECT name, unit_price
FROM products
ORDER BY unit_price DESC
LIMIT 10;
```

- `ASC` = ascending (A→Z, small→large). This is the default.
- `DESC` = descending.

## Sorting by several columns

Extra sort keys break ties, left to right:

```sql
SELECT country, city, last_name
FROM customers
ORDER BY country ASC, city ASC, last_name ASC
LIMIT 15;
```

Each key gets its own direction; `ORDER BY country ASC, signup_date DESC` is
perfectly normal.

## Sorting by an alias or a position

`ORDER BY` runs after the `SELECT` list is built, so it can use an alias:

```sql
SELECT name, ROUND(unit_price * units_in_stock, 2) AS stock_value
FROM products
ORDER BY stock_value DESC
LIMIT 5;
```

You can also sort by column position (`ORDER BY 2 DESC`). It is handy in the
console and awful in saved code — one extra column and the meaning silently
changes.

## Where do NULLs go?

In SQLite, NULLs sort **first** when ascending and last when descending. Other
databases differ, which is why the standard has `NULLS FIRST` / `NULLS LAST` —
supported by SQLite too:

```sql
SELECT name, reorder_level
FROM products
ORDER BY reorder_level DESC NULLS LAST
LIMIT 8;
```

::: lesson m1-limit

`LIMIT` caps the number of rows returned. It is how you answer "top 5" questions
and how you keep exploratory queries from dumping a million rows on screen.

```sql
SELECT name, unit_price
FROM products
ORDER BY unit_price DESC
LIMIT 3;
```

> [!warn]
> `LIMIT` without `ORDER BY` gives you *an* arbitrary set of rows, not *the*
> first ones. "Top N" always means `ORDER BY` **and** `LIMIT`.

## OFFSET: skipping rows

`OFFSET` skips rows before the limit kicks in — the classic pagination pattern.

```sql
SELECT name, unit_price
FROM products
ORDER BY unit_price DESC
LIMIT 5 OFFSET 5;
```

That is "page 2, five per page". Page *n* (1-based) is
`LIMIT page_size OFFSET (n - 1) * page_size`.

For a stable pagination the sort must be deterministic. If several products
share a price, add a tie-breaker that is unique:

```sql
SELECT product_id, name, unit_price
FROM products
ORDER BY unit_price DESC, product_id
LIMIT 5 OFFSET 10;
```

> Deep pagination (`OFFSET 100000`) is slow: the engine still walks through all
> the skipped rows. Module 10 shows the keyset alternative.

::: lesson m1-style

You now know enough to write real queries. Two habits will save you hours.

## Comment your intent

```sql
-- Products worth the most money sitting in the warehouse
SELECT
  name,
  units_in_stock,
  ROUND(units_in_stock * unit_price, 2) AS stock_value   -- retail value
FROM products
ORDER BY stock_value DESC
LIMIT 5;
```

`--` comments out the rest of the line. `/* … */` comments out a block, and is
handy for temporarily disabling part of a query:

```sql
SELECT name, unit_price /*, units_in_stock */
FROM products
LIMIT 3;
```

## The clause order you must memorise

Every `SELECT` writes its clauses in this order. Leave one out, fine; swap two,
syntax error:

```sql-static
SELECT    columns
FROM      table
WHERE     row filter
GROUP BY  grouping keys
HAVING    group filter
ORDER BY  sorting
LIMIT     row cap
```

The database *executes* them in a different order — roughly `FROM` → `WHERE` →
`GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`. That explains two
things that puzzle every beginner:

- in standard SQL, `WHERE` cannot use an alias defined in `SELECT` — the alias
  does not exist yet (SQLite allows it as an extension; other engines reject it)
- `ORDER BY` **can** use one, everywhere — by then it exists

Module 10 returns to this in detail. For now, remember the picture: filter
first, shape later.

## Build queries in layers

Nobody writes a five-table query in one go. Start with `SELECT * FROM one_table
LIMIT 10;`, check the rows look sane, then add one clause at a time and re-run.
The fastest SQL learners are simply the ones who run the query most often — and
that is exactly what the editor below is for.
