::: lesson m7-insert

Everything so far has been read-only. Now you will change data — safely, because
**every exercise runs against a private, throwaway copy of the database**. Break
whatever you like; the next query starts from a pristine copy.

## INSERT … VALUES

```sql
INSERT INTO suppliers (name, country, city, lead_time_days, rating)
VALUES ('Fjord Audio', 'Norway', 'Bergen', 16, 4.2);

SELECT * FROM suppliers WHERE country = 'Norway';
```

Name the columns explicitly. `INSERT INTO suppliers VALUES (…)` relies on column
order and breaks the day somebody adds a column.

Columns you omit get their `DEFAULT`, or NULL. `supplier_id` is an
`INTEGER PRIMARY KEY`, so SQLite fills it in automatically (it is an alias for
the internal rowid).

## Several rows at once

```sql
INSERT INTO categories (category_id, name, parent_id) VALUES
  (50, 'Software', NULL),
  (51, 'Notation Software', 50),
  (52, 'DAWs', 50);

SELECT * FROM categories WHERE category_id >= 50;
```

One statement, one pass, one transaction — far faster than three statements.

## INSERT … SELECT

Rows can come from a query instead of literals:

```sql
CREATE TABLE vip_customers (
  customer_id INTEGER PRIMARY KEY,
  full_name   TEXT NOT NULL,
  tier        TEXT NOT NULL
);

INSERT INTO vip_customers (customer_id, full_name, tier)
SELECT customer_id, first_name || ' ' || last_name, loyalty_tier
FROM customers
WHERE loyalty_tier IN ('gold', 'platinum');

SELECT COUNT(*) AS vips FROM vip_customers;
```

## What comes back

`INSERT` returns no rows, so run a `SELECT` afterwards to see what happened —
or ask for it directly with `RETURNING` (covered later in this module).

> [!warn]
> An `INSERT` that violates a constraint — a duplicate primary key, a NOT NULL
> column left empty, a foreign key pointing nowhere — fails and changes nothing.
> That is a feature: the database protects the data even when the application
> has a bug.

::: lesson m7-update

`UPDATE` changes values in rows that already exist.

```sql
UPDATE products
SET unit_price = unit_price * 1.10
WHERE category_id = 30;

SELECT product_id, name, unit_price FROM products WHERE category_id = 30;
```

The shape is `UPDATE table SET col = value [, col2 = value2] WHERE condition`.

## The rule that saves careers

**Write the `WHERE` clause first.** An `UPDATE` without one rewrites every row
in the table, and there is no undo outside a transaction.

A good habit: write it as a `SELECT` first, check the rows are the ones you
mean, then swap `SELECT …` for `UPDATE … SET …`.

```sql
SELECT product_id, name, unit_price FROM products WHERE discontinued = 1;
```

## Updating several columns

```sql
UPDATE orders
SET status = 'shipped',
    ship_date = '2025-07-01'
WHERE status = 'processing'
  AND order_date < '2025-03-01';

SELECT COUNT(*) AS now_shipped FROM orders WHERE ship_date = '2025-07-01';
```

## Values from other tables

A correlated subquery can pull the new value from elsewhere:

```sql
UPDATE products
SET units_in_stock = units_in_stock + (
  SELECT COALESCE(SUM(quantity), 0)
  FROM order_items
  WHERE order_items.product_id = products.product_id
    AND order_id = 1001
)
WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = 1001);

SELECT product_id, units_in_stock FROM products
WHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = 1001);
```

That is a restock after cancelling an order. Note the `WHERE` on the outer
`UPDATE`: without it, every other product would have its stock set to
`units_in_stock + 0` — harmless here, but the same pattern with a different
expression would be a disaster.

> SQLite also supports `UPDATE … FROM` (like PostgreSQL) for joining the source
> of the new values, which is often clearer than a correlated subquery.

::: lesson m7-delete

```sql
DELETE FROM reviews
WHERE rating = 1 AND comment IS NULL;

SELECT COUNT(*) AS remaining FROM reviews;
```

Same warning, louder: `DELETE FROM reviews;` empties the table.

## Deleting through a relationship

```sql
DELETE FROM order_items
WHERE order_id IN (
  SELECT order_id FROM orders WHERE status = 'cancelled'
);

SELECT COUNT(*) AS items_left FROM order_items;
```

Order matters when foreign keys are enforced: remove the children before the
parents, or the delete fails.

```sql
SELECT COUNT(*) AS cancelled_orders FROM orders WHERE status = 'cancelled';
```

## Soft deletes

Production systems often do not delete at all. They add a flag —
`discontinued`, `deleted_at`, `is_active` — and filter it out in queries. You
keep history, you can undo, and referencing rows do not break. The cost is that
every query must remember the filter (a view helps, see later in this module).

> [!warn]
> `TRUNCATE` does not exist in SQLite; `DELETE FROM t` is the equivalent.
> Whatever the engine, run the `SELECT` version first. Every experienced
> engineer has a story about the day they did not.

::: lesson m7-create

`CREATE TABLE` defines a new table's columns, their types and the rules the data
must obey.

```sql
CREATE TABLE gift_cards (
  card_id     INTEGER PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,
  balance     REAL    NOT NULL DEFAULT 0 CHECK (balance >= 0),
  customer_id INTEGER REFERENCES customers(customer_id),
  issued_on   TEXT    NOT NULL DEFAULT (date('now')),
  expires_on  TEXT
);

INSERT INTO gift_cards (code, balance, customer_id, expires_on)
VALUES ('GC-1001', 50.0, 1, '2026-12-31');

SELECT * FROM gift_cards;
```

## The constraint toolbox

| constraint | meaning |
| --- | --- |
| `PRIMARY KEY` | unique, not null, identifies the row |
| `NOT NULL` | a value is required |
| `UNIQUE` | no two rows may share this value |
| `DEFAULT expr` | value used when the column is omitted |
| `CHECK (condition)` | the row is rejected unless the condition holds |
| `REFERENCES t(col)` | foreign key: the value must exist in t |

Constraints are documentation the database *enforces*. Every rule you leave to
application code is a rule that will eventually be broken by a script, an
import, or a colleague.

```sql-error
CREATE TABLE gift_cards (
  card_id INTEGER PRIMARY KEY,
  balance REAL NOT NULL CHECK (balance >= 0)
);
INSERT INTO gift_cards (balance) VALUES (-5);
```

Run that and read the error: the CHECK constraint refused a negative balance.

## Choosing types in SQLite

`INTEGER`, `REAL`, `TEXT`, `BLOB` — and `NUMERIC` for anything else. There is no
native date or boolean: use `TEXT` in ISO format for dates and `INTEGER` 0/1 for
booleans, exactly as this database does.

`IF NOT EXISTS` makes creation idempotent, which matters in setup scripts:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  happened_at TEXT NOT NULL DEFAULT (datetime('now')),
  message TEXT NOT NULL
);
INSERT INTO audit_log (message) VALUES ('table ready');
SELECT message FROM audit_log;
```

::: lesson m7-keys

## Primary keys

A primary key uniquely identifies a row. In SQLite, `INTEGER PRIMARY KEY` is
special: it *is* the table's rowid, and it auto-assigns when you omit it.

A **composite** primary key spans several columns — `order_items` is keyed by
`(order_id, item_no)`, because item 1 exists on every order:

```sql
SELECT order_id, item_no, product_id FROM order_items ORDER BY order_id LIMIT 5;
```

Natural key (an email, a country code) or surrogate key (an autoincrementing
id)? Surrogate keys win when the "natural" value can change — and people do
change their email address.

## Foreign keys

A foreign key says *this value must exist over there*:

```sql-static
customer_id INTEGER NOT NULL REFERENCES customers(customer_id)
```

With enforcement on (this app enables it on every connection), the database
rejects an order for a customer who does not exist:

```sql-error
INSERT INTO orders (customer_id, order_date, status)
VALUES (99999, '2025-07-01', 'processing');
```

Read the error — `FOREIGN KEY constraint failed` — then try a real customer id
and watch it succeed.

You can also declare what happens when the parent goes away:
`ON DELETE CASCADE` (delete the children too), `ON DELETE SET NULL`, or the
default `NO ACTION` (refuse).

## Indexes, briefly

An index is a sorted structure that lets the engine find rows without scanning
the table:

```sql
CREATE INDEX idx_customers_country ON customers(country);

SELECT country, COUNT(*) FROM customers WHERE country = 'Germany' GROUP BY country;
```

Indexes make reads faster and writes slower, and they cost storage. Primary keys
and `UNIQUE` constraints create one automatically. Module 10 covers when they
help and how to tell.

::: lesson m7-alter-views

## ALTER TABLE

SQLite supports a useful subset:

```sql
ALTER TABLE suppliers ADD COLUMN contact_email TEXT;
ALTER TABLE suppliers RENAME COLUMN lead_time_days TO lead_days;

SELECT supplier_id, name, lead_days, contact_email FROM suppliers LIMIT 3;
```

`ADD COLUMN`, `RENAME COLUMN`, `RENAME TO` and `DROP COLUMN` are available.
Changing a column's type or constraints is not: the standard recipe is to create
a new table, copy the rows with `INSERT … SELECT`, drop the old one and rename.

## DROP

```sql
CREATE TABLE scratch (id INTEGER PRIMARY KEY, note TEXT);
DROP TABLE scratch;
SELECT COUNT(*) AS scratch_tables FROM sqlite_master WHERE name = 'scratch';
```

`DROP TABLE IF EXISTS scratch;` avoids an error when it is already gone.

## Views: a saved query that behaves like a table

```sql
CREATE VIEW active_products AS
SELECT product_id, name, category_id, unit_price, units_in_stock
FROM products
WHERE discontinued = 0;

SELECT COUNT(*) AS active FROM active_products;
```

A view stores no data — it runs its query every time you select from it. Use
views to:

- hide a complicated join behind a friendly name
- guarantee that everybody applies the same filter (`WHERE deleted_at IS NULL`)
- expose a subset of columns

```sql
CREATE VIEW order_totals AS
SELECT
  o.order_id,
  o.customer_id,
  o.status,
  ROUND(SUM(i.quantity * i.unit_price * (1 - i.discount)), 2) AS goods_total
FROM orders AS o
JOIN order_items AS i ON i.order_id = o.order_id
GROUP BY o.order_id, o.customer_id, o.status;

SELECT * FROM order_totals ORDER BY goods_total DESC LIMIT 5;
```

## CREATE TABLE AS SELECT

To snapshot a result (a real table, with real data, that does not update
itself):

```sql
CREATE TABLE monthly_snapshot AS
SELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders
FROM orders
GROUP BY month;

SELECT * FROM monthly_snapshot ORDER BY month LIMIT 5;
```

::: lesson m7-transactions

A transaction groups statements so that **all** of them happen, or **none**.

```sql
BEGIN;
  UPDATE products SET units_in_stock = units_in_stock - 1 WHERE product_id = 1;
  INSERT INTO orders (customer_id, order_date, status, shipping_cost)
  VALUES (1, '2025-07-01', 'processing', 9.99);
COMMIT;

SELECT units_in_stock FROM products WHERE product_id = 1;
```

If the power fails between the two statements, the database comes back with
neither applied — never with stock decremented for an order that does not exist.

## ROLLBACK

```sql
BEGIN;
  DELETE FROM reviews;
  SELECT COUNT(*) AS during_transaction FROM reviews;
ROLLBACK;

SELECT COUNT(*) AS after_rollback FROM reviews;
```

Inside the transaction the table looks empty; after the rollback every row is
back. This is the safest way to try a dangerous statement: `BEGIN`, run it,
inspect, then `COMMIT` or `ROLLBACK`.

## ACID, in one line each

- **Atomicity** — all statements in the transaction, or none.
- **Consistency** — constraints hold before and after.
- **Isolation** — concurrent transactions do not see each other's half-done work.
- **Durability** — once committed, it survives a crash.

## Savepoints

Nested checkpoints inside a transaction:

```sql
BEGIN;
  INSERT INTO categories (category_id, name) VALUES (60, 'Temporary');
  SAVEPOINT before_risky;
    INSERT INTO categories (category_id, name) VALUES (61, 'Also temporary');
  ROLLBACK TO before_risky;
COMMIT;

SELECT category_id, name FROM categories WHERE category_id >= 60;
```

Category 60 survives; 61 does not.

> Performance note: each statement outside a transaction is its own implicit
> transaction with its own disk sync. Wrapping 10,000 inserts in one `BEGIN … 
> COMMIT` can be orders of magnitude faster.

::: lesson m7-upsert

## INSERT … ON CONFLICT (upsert)

"Insert this row, or update it if it is already there" used to take three
statements and a race condition. Now:

```sql
INSERT INTO categories (category_id, name, parent_id)
VALUES (10, 'Guitars & Basses', 1)
ON CONFLICT (category_id) DO UPDATE
SET name = excluded.name;

SELECT category_id, name FROM categories WHERE category_id = 10;
```

`excluded` is the pseudo-table holding the row you *tried* to insert. The
conflict target (`(category_id)`) must be a primary key or unique constraint.

`DO NOTHING` ignores the clash instead:

```sql
INSERT INTO categories (category_id, name) VALUES (10, 'Ignored')
ON CONFLICT (category_id) DO NOTHING;

SELECT category_id, name FROM categories WHERE category_id = 10;
```

A counter-style upsert, using the existing value:

```sql
CREATE TABLE tag_counts (tag TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0);

INSERT INTO tag_counts (tag, hits) VALUES ('pro', 1)
ON CONFLICT (tag) DO UPDATE SET hits = hits + 1;
INSERT INTO tag_counts (tag, hits) VALUES ('pro', 1)
ON CONFLICT (tag) DO UPDATE SET hits = hits + 1;

SELECT * FROM tag_counts;
```

## RETURNING

`RETURNING` makes a write statement give rows back — the generated id, the new
values, whatever you ask for:

```sql
INSERT INTO suppliers (name, country, lead_time_days)
VALUES ('Fjord Audio', 'Norway', 16)
RETURNING supplier_id, name;
```

It works with `UPDATE` and `DELETE` too, which is the tidiest way to see exactly
what a statement touched:

```sql
UPDATE products SET units_in_stock = units_in_stock + 5
WHERE units_in_stock = 0
RETURNING product_id, name, units_in_stock;
```

::: lesson m7-checkpoint

Writing data safely comes down to a short ritual:

1. **Select first.** Run the `WHERE` clause as a `SELECT` and look at the rows.
2. **Wrap it.** `BEGIN;` … inspect … `COMMIT;` or `ROLLBACK;`.
3. **Let constraints help.** A `CHECK` or foreign key that stops a bad write is
   cheaper than the afternoon you would spend repairing the data.
4. **Prefer one statement to many.** Multi-row inserts, `INSERT … SELECT`, and
   upserts are faster and atomic by construction.

A worked example — archive cancelled orders into a new table, then clean up,
all or nothing:

```sql
CREATE TABLE cancelled_archive (
  order_id    INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  order_date  TEXT NOT NULL,
  archived_at TEXT NOT NULL DEFAULT (date('now'))
);

BEGIN;
  INSERT INTO cancelled_archive (order_id, customer_id, order_date)
  SELECT order_id, customer_id, order_date
  FROM orders
  WHERE status = 'cancelled';

  DELETE FROM order_items
  WHERE order_id IN (SELECT order_id FROM cancelled_archive);

  DELETE FROM orders
  WHERE order_id IN (SELECT order_id FROM cancelled_archive);
COMMIT;

SELECT
  (SELECT COUNT(*) FROM cancelled_archive) AS archived,
  (SELECT COUNT(*) FROM orders WHERE status = 'cancelled') AS still_here;
```

Children before parents, everything inside one transaction, and a verification
query at the end.
