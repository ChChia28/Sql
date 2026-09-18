## The shape of a SELECT

```sql-static
SELECT    columns, expressions, aggregates
FROM      table
JOIN      other_table ON condition
WHERE     row filter
GROUP BY  grouping keys
HAVING    group filter
WINDOW    named window definitions
ORDER BY  sort keys
LIMIT     n OFFSET m
```

Written in that order; **evaluated** as
`FROM → WHERE → GROUP BY → HAVING → SELECT → window functions → ORDER BY → LIMIT`.

## Filtering

| need | syntax |
| --- | --- |
| equality / inequality | `= <> < <= > >=` |
| combine | `AND`, `OR`, `NOT` (AND binds tighter — use brackets) |
| set membership | `col IN ('a', 'b')`, `col NOT IN (…)` |
| range (inclusive) | `col BETWEEN 10 AND 20` |
| timestamps | `col >= '2025-03-01' AND col < '2025-04-01'` (half-open) |
| text pattern | `col LIKE 'pre%'`, `'%mid%'`, `'_ingle char'` |
| missing value | `col IS NULL`, `col IS NOT NULL` |
| default for NULL | `COALESCE(col, fallback)`, `IFNULL(a, b)` |
| conditional value | `CASE WHEN … THEN … ELSE … END`, `IIF(c, a, b)` |

```sql
SELECT name, unit_price
FROM products
WHERE unit_price BETWEEN 200 AND 500
  AND discontinued = 0
ORDER BY unit_price
LIMIT 10;
```

## Aggregation

| function | notes |
| --- | --- |
| `COUNT(*)` | rows, NULLs included |
| `COUNT(col)` | non-NULL values only |
| `COUNT(DISTINCT col)` | unique non-NULL values |
| `SUM`, `AVG`, `MIN`, `MAX` | ignore NULLs; SUM over no rows is NULL |
| `TOTAL(col)` | SQLite: like SUM but returns 0.0 |
| `group_concat(col, sep)` | values joined into text (PostgreSQL: `string_agg`) |

Conditional aggregation — counting several things in one pass:

```sql
SELECT
  substr(order_date, 1, 4) AS year,
  COUNT(*) AS orders,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'cancelled') / COUNT(*), 1) AS cancel_pct
FROM orders
GROUP BY year
ORDER BY year;
```

`WHERE` filters rows (before grouping); `HAVING` filters groups (after).

## Joins

| join | keeps |
| --- | --- |
| `JOIN` / `INNER JOIN` | rows matching on both sides |
| `LEFT JOIN` | all left rows; NULLs where the right has no match |
| `RIGHT JOIN` | all right rows (SQLite 3.39+) |
| `FULL OUTER JOIN` | unmatched rows from both sides |
| `CROSS JOIN` | every combination |

Anti-join — rows with no match anywhere:

```sql
SELECT p.product_id, p.name
FROM products AS p
WHERE NOT EXISTS (SELECT 1 FROM order_items AS i WHERE i.product_id = p.product_id)
ORDER BY p.product_id;
```

Set operators stack results vertically: `UNION ALL` (keep duplicates),
`UNION` (remove them), `INTERSECT`, `EXCEPT`.

## Subqueries and CTEs

| form | use |
| --- | --- |
| `(SELECT …)` in `SELECT`/`WHERE` | a single value |
| `IN (SELECT …)` | membership (careful with NULLs) |
| `EXISTS (SELECT 1 … WHERE correlated)` | "does a related row exist?" |
| `FROM (SELECT …) AS t` | derived table — aggregate twice |
| `WITH name AS (…)` | named step; reusable, readable |

```sql
WITH customer_revenue AS (
  SELECT o.customer_id,
         SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue
  FROM orders AS o
  JOIN order_items AS i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id
)
SELECT c.last_name, ROUND(r.revenue, 2) AS revenue
FROM customer_revenue AS r
JOIN customers AS c ON c.customer_id = r.customer_id
WHERE r.revenue > (SELECT AVG(revenue) FROM customer_revenue)
ORDER BY revenue DESC
LIMIT 10;
```

## Window functions

```sql-static
function(args) OVER (PARTITION BY … ORDER BY … ROWS BETWEEN … AND …)
```

| function | gives |
| --- | --- |
| `ROW_NUMBER()` | unique position, 1, 2, 3 |
| `RANK()` / `DENSE_RANK()` | ties share a rank (with / without gaps) |
| `LAG(x, n, default)` / `LEAD(…)` | value from a previous / following row |
| `SUM/AVG/COUNT(x) OVER (…)` | aggregate without collapsing rows |
| `NTILE(n)` | bucket number |
| `PERCENT_RANK()`, `CUME_DIST()` | position in the distribution |
| `FIRST_VALUE(x)`, `LAST_VALUE(x)`, `NTH_VALUE(x, n)` | value at a position |

Frames: `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` (running total),
`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` (7-row moving window),
`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` (whole partition).

Top-N per group:

```sql
WITH ranked AS (
  SELECT category_id, name, unit_price,
         ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY unit_price DESC, product_id) AS rn
  FROM products
)
SELECT category_id, name, unit_price FROM ranked WHERE rn <= 2 ORDER BY category_id, rn;
```

## Dates and times

Stored as ISO text: `'2025-03-14'`, `'2025-03-14 09:30:00'`.

| need | SQLite |
| --- | --- |
| today | `date('now')` |
| format / extract | `strftime('%Y-%m', col)`, `%Y %m %d %H %M %S %w %j %W` |
| shift | `date(col, '+7 days')`, `date(col, '-1 month')` |
| month boundaries | `date(col, 'start of month')`, `… , '+1 month', '-1 day'` |
| difference in days | `julianday(a) - julianday(b)` |

```sql
SELECT order_id,
       CAST(julianday(ship_date) - julianday(order_date) AS INTEGER) AS days_to_ship
FROM orders
WHERE ship_date IS NOT NULL
ORDER BY days_to_ship DESC
LIMIT 5;
```

## Text, numbers, JSON

| function | does |
| --- | --- |
| `LENGTH`, `UPPER`, `LOWER`, `TRIM` | basics |
| `SUBSTR(s, start, len)` | slice (1-based) |
| `INSTR(s, needle)` | position, 0 if absent |
| `REPLACE(s, a, b)`, `a \|\| b` | substitute, concatenate |
| `printf('%.2f', x)` | formatted text |
| `ROUND(x, n)`, `ABS`, `CAST(x AS INTEGER)` | numbers (CAST truncates) |
| `json_extract(doc, '$.key')`, `doc ->> '$.key'` | read JSON |
| `json_each(doc, '$.array')` | expand an array into rows |

Integer division truncates: use `100.0 * a / b`.

## Changing data

```sql-static
INSERT INTO t (a, b) VALUES (1, 2), (3, 4);
INSERT INTO t (a, b) SELECT x, y FROM other;
INSERT INTO t (id, v) VALUES (1, 'x')
  ON CONFLICT (id) DO UPDATE SET v = excluded.v;      -- upsert
UPDATE t SET a = a + 1 WHERE id = 7 RETURNING id, a;
DELETE FROM t WHERE created_at < '2024-01-01';
BEGIN; … COMMIT;            -- or ROLLBACK;
```

Always write the `WHERE` clause first, and check it with a `SELECT`.

## Schema

```sql-static
CREATE TABLE t (
  id        INTEGER PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,
  amount    REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
  parent_id INTEGER REFERENCES other(id),
  PRIMARY KEY (a, b)                    -- composite alternative
);
CREATE INDEX idx_t_code ON t(code);
CREATE VIEW v AS SELECT …;
ALTER TABLE t ADD COLUMN note TEXT;
DROP TABLE IF EXISTS t;
```

## Performance quick list

- `EXPLAIN QUERY PLAN <statement>` — read it before optimising anything.
- Index what you filter, join and sort on; composite indexes go
  **equality columns first**, then the range/sort column.
- Keep the column bare: `col >= '2025-01-01'`, not `strftime('%Y', col) = '2025'`.
- Leading wildcards (`LIKE '%x%'`) cannot use an index.
- Page with `WHERE id > :last` instead of a large `OFFSET`.
- Wrap bulk writes in one transaction.
- Aggregate each table at its own grain before joining, to avoid fan-out.

## Dialect differences that bite

| topic | SQLite | PostgreSQL | MySQL |
| --- | --- | --- | --- |
| concat | `\|\|` | `\|\|` | `CONCAT()` |
| now | `datetime('now')` | `now()` | `NOW()` |
| date add | `date(d, '+7 days')` | `d + INTERVAL '7 days'` | `DATE_ADD(d, INTERVAL 7 DAY)` |
| string agg | `group_concat` | `string_agg` | `GROUP_CONCAT` |
| upsert | `ON CONFLICT DO UPDATE` | same | `ON DUPLICATE KEY UPDATE` |
| `RETURNING` | yes | yes | no |
| booleans | 0 / 1 | `boolean` | `TINYINT(1)` |
