/* Module 7 — Changing Data & Schema ------------------------------------ */

export default {
  id: "changing-data",
  number: 7,
  title: "Changing Data & Schema",
  level: "Intermediate+",
  summary:
    "INSERT, UPDATE, DELETE, table design and constraints, views, transactions, upserts and RETURNING — practised on a disposable copy of the database.",
  lessons: [
    {
      id: "m7-insert",
      title: "INSERT",
      goal: "Add rows one at a time, in batches, and straight from a query.",
      keywords: ["insert", "values", "insert select", "batch"],
      exercises: [
        {
          id: "m7-insert-e1",
          prompt:
            "Add a supplier: name `Fjord Audio`, country `Norway`, city `Bergen`, `lead_time_days` 16, `rating` 4.2. Let SQLite assign the id.",
          starter:
            "INSERT INTO suppliers (name, country, city, lead_time_days, rating)\nVALUES (...);",
          solution:
            "INSERT INTO suppliers (name, country, city, lead_time_days, rating)\nVALUES ('Fjord Audio', 'Norway', 'Bergen', 16, 4.2);",
          check:
            "SELECT name, country, city, lead_time_days, rating FROM suppliers WHERE country = 'Norway';",
          hints: [
            "List the columns you are filling, then the matching values.",
            "Omit `supplier_id` — an INTEGER PRIMARY KEY fills itself in.",
          ],
        },
        {
          id: "m7-insert-e2",
          prompt:
            "In **one statement**, add three categories: (50, `Software`, no parent), (51, `Notation Software`, parent 50) and (52, `DAWs`, parent 50).",
          starter: "",
          solution:
            "INSERT INTO categories (category_id, name, parent_id) VALUES\n  (50, 'Software', NULL),\n  (51, 'Notation Software', 50),\n  (52, 'DAWs', 50);",
          check: "SELECT category_id, name, parent_id FROM categories WHERE category_id >= 50 ORDER BY category_id;",
          hints: ["Separate the value tuples with commas.", "Use NULL for the missing parent."],
        },
        {
          id: "m7-insert-e3",
          prompt:
            "A table `vip_customers (customer_id, full_name, tier)` needs filling from `customers`: every gold or platinum customer, with `full_name` as first name, a space, last name. Create the table and populate it with `INSERT … SELECT`.",
          starter:
            "CREATE TABLE vip_customers (\n  customer_id INTEGER PRIMARY KEY,\n  full_name   TEXT NOT NULL,\n  tier        TEXT NOT NULL\n);\n\n-- now fill it",
          solution:
            "CREATE TABLE vip_customers (\n  customer_id INTEGER PRIMARY KEY,\n  full_name   TEXT NOT NULL,\n  tier        TEXT NOT NULL\n);\n\nINSERT INTO vip_customers (customer_id, full_name, tier)\nSELECT customer_id, first_name || ' ' || last_name, loyalty_tier\nFROM customers\nWHERE loyalty_tier IN ('gold', 'platinum');",
          check: "SELECT customer_id, full_name, tier FROM vip_customers ORDER BY customer_id;",
          hints: [
            "`INSERT INTO t (cols) SELECT …` — no VALUES keyword.",
            "The SELECT list must line up with the column list.",
          ],
        },
      ],
      quiz: [
        {
          q: "Why name the columns in an INSERT instead of relying on their order?",
          options: [
            "It is faster",
            "The statement keeps working when a column is added or reordered",
            "SQLite requires it",
            "It allows more rows per statement",
          ],
          answer: 1,
          explain: "Positional inserts silently break the day the table changes shape.",
        },
      ],
    },

    {
      id: "m7-update",
      title: "UPDATE",
      goal: "Change existing rows deliberately — and never forget the WHERE clause.",
      keywords: ["update", "set", "where", "correlated update"],
      exercises: [
        {
          id: "m7-update-e1",
          prompt:
            "Cables have gone up: raise `unit_price` by 10% for every product in category 30. (Leave everything else untouched.)",
          starter: "UPDATE products\nSET unit_price = unit_price\nWHERE 1 = 0;",
          solution:
            "UPDATE products\nSET unit_price = unit_price * 1.10\nWHERE category_id = 30;",
          check:
            "SELECT product_id, ROUND(unit_price, 4) AS unit_price FROM products ORDER BY product_id;",
          hints: [
            "`SET unit_price = unit_price * 1.10`",
            "Restrict it with `WHERE category_id = 30` — the check compares every product's price.",
          ],
        },
        {
          id: "m7-update-e2",
          prompt:
            "Mark every product with no stock **and** no reorder level as discontinued (`discontinued = 1`).",
          starter: "",
          solution:
            "UPDATE products\nSET discontinued = 1\nWHERE units_in_stock = 0 AND reorder_level IS NULL;",
          check: "SELECT product_id, discontinued FROM products ORDER BY product_id;",
          hints: ["Two conditions — and remember `IS NULL`, not `= NULL`."],
        },
        {
          id: "m7-update-e3",
          prompt:
            "Gold customers get promoted: set `loyalty_tier` to `platinum` for every customer who has placed **5 or more completed orders** and is currently `gold`.",
          starter: "",
          solution:
            "UPDATE customers\nSET loyalty_tier = 'platinum'\nWHERE loyalty_tier = 'gold'\n  AND customer_id IN (\n    SELECT customer_id FROM orders WHERE status = 'completed'\n    GROUP BY customer_id HAVING COUNT(*) >= 5\n  );",
          check: "SELECT customer_id, loyalty_tier FROM customers ORDER BY customer_id;",
          hints: [
            "The set of qualifying customers comes from a GROUP BY … HAVING subquery.",
            "Keep the `loyalty_tier = 'gold'` condition so silver customers are not promoted.",
          ],
        },
      ],
      quiz: [
        {
          q: "What is the safest way to check an UPDATE before running it?",
          options: [
            "Run it and see",
            "Run the same WHERE clause as a SELECT first (or wrap the UPDATE in BEGIN … ROLLBACK)",
            "Add LIMIT 1",
            "Take a backup afterwards",
          ],
          answer: 1,
          explain:
            "Look at the rows you are about to change. A transaction gives you an undo button if you still get it wrong.",
        },
      ],
    },

    {
      id: "m7-delete",
      title: "DELETE",
      goal: "Remove rows, respect foreign keys, and know when to soft-delete instead.",
      keywords: ["delete", "cascade", "soft delete", "referential integrity"],
      exercises: [
        {
          id: "m7-delete-e1",
          prompt: "Delete every review with a rating of 1 that has no comment.",
          starter: "",
          solution: "DELETE FROM reviews WHERE rating = 1 AND comment IS NULL;",
          check: "SELECT COUNT(*) AS reviews, SUM(rating) AS rating_total FROM reviews;",
          hints: ["Two conditions, one of them `IS NULL`."],
        },
        {
          id: "m7-delete-e2",
          prompt:
            "Remove the line items belonging to **cancelled** orders (leave the orders themselves alone).",
          starter: "",
          solution:
            "DELETE FROM order_items\nWHERE order_id IN (SELECT order_id FROM orders WHERE status = 'cancelled');",
          check:
            "SELECT (SELECT COUNT(*) FROM order_items) AS items, (SELECT COUNT(*) FROM orders) AS orders;",
          hints: ["Pick the order ids with a subquery, then delete from the child table."],
        },
      ],
      quiz: [
        {
          q: "With foreign keys enforced, deleting a parent row that still has children…",
          options: [
            "deletes the children automatically",
            "fails, unless the foreign key declares ON DELETE CASCADE",
            "sets the children's key to NULL",
            "is always allowed",
          ],
          answer: 1,
          explain:
            "The default is NO ACTION: the database refuses. CASCADE and SET NULL are opt-in behaviours.",
        },
      ],
    },

    {
      id: "m7-create",
      title: "CREATE TABLE and constraints",
      goal: "Design a table whose rules the database enforces for you.",
      keywords: ["create table", "constraint", "check", "unique", "default", "not null"],
      exercises: [
        {
          id: "m7-create-e1",
          prompt:
            "Create a `gift_cards` table with: `card_id` integer primary key; `code` text, required and unique; `balance` real, required, default 0, never negative; `customer_id` referencing `customers`; `issued_on` text, required. Then insert one card: code `GC-1001`, balance 50, customer 1, issued on `2025-07-01`.",
          starter: "CREATE TABLE gift_cards (\n  -- your columns here\n);",
          solution:
            "CREATE TABLE gift_cards (\n  card_id     INTEGER PRIMARY KEY,\n  code        TEXT    NOT NULL UNIQUE,\n  balance     REAL    NOT NULL DEFAULT 0 CHECK (balance >= 0),\n  customer_id INTEGER REFERENCES customers(customer_id),\n  issued_on   TEXT    NOT NULL\n);\n\nINSERT INTO gift_cards (code, balance, customer_id, issued_on)\nVALUES ('GC-1001', 50, 1, '2025-07-01');",
          check: "SELECT card_id, code, balance, customer_id, issued_on FROM gift_cards ORDER BY card_id;",
          hints: [
            "`CHECK (balance >= 0)` enforces the 'never negative' rule.",
            "`REFERENCES customers(customer_id)` declares the foreign key.",
          ],
        },
        {
          id: "m7-create-e2",
          prompt:
            "Create `stock_alerts (alert_id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(product_id), noticed_on TEXT NOT NULL, note TEXT)` and fill it with one row per product that is out of stock and not discontinued, using `noticed_on = '2025-07-01'` and a NULL note.",
          starter: "",
          solution:
            "CREATE TABLE stock_alerts (\n  alert_id   INTEGER PRIMARY KEY,\n  product_id INTEGER NOT NULL REFERENCES products(product_id),\n  noticed_on TEXT NOT NULL,\n  note       TEXT\n);\n\nINSERT INTO stock_alerts (product_id, noticed_on, note)\nSELECT product_id, '2025-07-01', NULL\nFROM products\nWHERE units_in_stock = 0 AND discontinued = 0;",
          check: "SELECT product_id, noticed_on, note FROM stock_alerts ORDER BY product_id;",
          hints: [
            "Create the table first, then INSERT … SELECT into it.",
            "A literal (`'2025-07-01'`) is fine in a SELECT list.",
          ],
        },
      ],
      quiz: [
        {
          q: "Why put a CHECK constraint in the table rather than validating in application code?",
          options: [
            "It is faster to type",
            "The database enforces it against every writer — imports, scripts and other apps included",
            "CHECK constraints make queries faster",
            "Application code cannot do comparisons",
          ],
          answer: 1,
          explain:
            "Application validation protects one code path. A constraint protects the data itself.",
        },
      ],
    },

    {
      id: "m7-keys",
      title: "Keys and indexes",
      goal: "Choose primary keys, declare relationships, and add your first index.",
      keywords: ["primary key", "foreign key", "composite key", "index", "surrogate key"],
      exercises: [
        {
          id: "m7-keys-e1",
          prompt:
            "Create a junction table `product_tags (product_id, tag)` where the pair is the primary key and `product_id` references `products`. Then tag products 1 and 2 with `featured`.",
          starter: "",
          solution:
            "CREATE TABLE product_tags (\n  product_id INTEGER NOT NULL REFERENCES products(product_id),\n  tag        TEXT    NOT NULL,\n  PRIMARY KEY (product_id, tag)\n);\n\nINSERT INTO product_tags (product_id, tag) VALUES (1, 'featured'), (2, 'featured');",
          check: "SELECT product_id, tag FROM product_tags ORDER BY product_id, tag;",
          hints: [
            "A composite key is declared as a table constraint: `PRIMARY KEY (a, b)`.",
            "That also prevents the same tag being attached twice.",
          ],
        },
        {
          id: "m7-keys-e2",
          prompt:
            "Add an index called `idx_products_category` on `products(category_id)`, then confirm it exists.",
          starter: "",
          solution:
            "CREATE INDEX idx_products_category ON products(category_id);",
          check:
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_products_category';",
          hints: ["`CREATE INDEX name ON table(column);`"],
        },
      ],
      quiz: [
        {
          q: "`order_items` uses `PRIMARY KEY (order_id, item_no)`. Why not just `item_no`?",
          options: [
            "Because item_no is text",
            "Because item numbers restart on every order, so only the pair is unique",
            "Because composite keys are faster",
            "Because order_id is a foreign key",
          ],
          answer: 1,
          explain: "Every order has an item 1. Uniqueness only exists for the combination.",
        },
      ],
    },

    {
      id: "m7-alter-views",
      title: "ALTER, DROP and views",
      goal: "Evolve a schema and hide complexity behind a named query.",
      keywords: ["alter table", "add column", "drop", "view", "create table as"],
      exercises: [
        {
          id: "m7-alter-e1",
          prompt:
            "Add a nullable text column `contact_email` to `suppliers`, then set it to `orders@fjord.example` for the supplier whose name is `Nordwind Instruments`.",
          starter: "",
          solution:
            "ALTER TABLE suppliers ADD COLUMN contact_email TEXT;\n\nUPDATE suppliers SET contact_email = 'orders@fjord.example'\nWHERE name = 'Nordwind Instruments';",
          check: "SELECT supplier_id, name, contact_email FROM suppliers ORDER BY supplier_id;",
          hints: ["`ALTER TABLE t ADD COLUMN c TYPE;` then a normal UPDATE."],
        },
        {
          id: "m7-alter-e2",
          prompt:
            "Create a view `active_products` exposing `product_id`, `name`, `category_id`, `unit_price` and `units_in_stock` for products that are not discontinued.",
          starter: "",
          solution:
            "CREATE VIEW active_products AS\nSELECT product_id, name, category_id, unit_price, units_in_stock\nFROM products\nWHERE discontinued = 0;",
          check: "SELECT product_id, name, category_id, unit_price, units_in_stock FROM active_products ORDER BY product_id;",
          hints: ["`CREATE VIEW name AS SELECT …`", "A view stores the query, not the rows."],
        },
        {
          id: "m7-alter-e3",
          prompt:
            "Snapshot monthly order counts into a real table called `monthly_snapshot` with columns `month` and `orders`, using `CREATE TABLE … AS SELECT`.",
          starter: "",
          solution:
            "CREATE TABLE monthly_snapshot AS\nSELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders\nFROM orders\nGROUP BY month;",
          check: "SELECT month, orders FROM monthly_snapshot ORDER BY month;",
          hints: ["`CREATE TABLE t AS SELECT …` copies both structure and rows."],
        },
      ],
      quiz: [
        {
          q: "What is the difference between a view and a CREATE TABLE AS SELECT?",
          options: [
            "None",
            "A view re-runs its query every time; CTAS stores a snapshot that does not update",
            "A view is faster in every case",
            "CTAS cannot be indexed",
          ],
          answer: 1,
          explain:
            "Views are always current but cost the query each time; snapshots are cheap to read but go stale.",
        },
      ],
    },

    {
      id: "m7-transactions",
      title: "Transactions",
      goal: "Group statements so they all happen or none do — and use ROLLBACK as an undo button.",
      keywords: ["transaction", "begin", "commit", "rollback", "acid", "savepoint"],
      exercises: [
        {
          id: "m7-tx-e1",
          prompt:
            "In a single transaction: insert an order for customer 1 dated `2025-07-01` with status `processing` and shipping cost 9.99, and reduce `units_in_stock` for product 1 by one. Commit it.",
          starter: "BEGIN;\n  -- two statements\nCOMMIT;",
          solution:
            "BEGIN;\n  INSERT INTO orders (customer_id, order_date, status, shipping_cost)\n  VALUES (1, '2025-07-01', 'processing', 9.99);\n\n  UPDATE products SET units_in_stock = units_in_stock - 1 WHERE product_id = 1;\nCOMMIT;",
          check:
            "SELECT (SELECT COUNT(*) FROM orders WHERE order_date = '2025-07-01') AS new_orders, (SELECT units_in_stock FROM products WHERE product_id = 1) AS stock;",
          hints: ["`BEGIN;` … statements … `COMMIT;`"],
        },
        {
          id: "m7-tx-e2",
          prompt:
            "Show that ROLLBACK really undoes work: inside a transaction, delete **all** reviews, then roll back. The reviews table must be untouched afterwards.",
          starter: "",
          solution: "BEGIN;\n  DELETE FROM reviews;\nROLLBACK;",
          check: "SELECT COUNT(*) AS reviews FROM reviews;",
          hints: ["`BEGIN; DELETE FROM reviews; ROLLBACK;`", "Nothing survives the rollback."],
          requires: [{ re: "\\bROLLBACK\\b", msg: "The point of this exercise is the ROLLBACK." }],
        },
      ],
      quiz: [
        {
          q: "Wrapping 10,000 INSERTs in one transaction is usually much faster because…",
          options: [
            "the statements are combined into one",
            "one commit means one durability sync instead of 10,000",
            "indexes are disabled inside transactions",
            "it skips constraint checks",
          ],
          answer: 1,
          explain:
            "Outside a transaction every statement commits on its own, and each commit has to reach disk.",
        },
      ],
    },

    {
      id: "m7-upsert",
      title: "Upserts and RETURNING",
      goal: "Insert-or-update in one statement, and get rows back from a write.",
      keywords: ["upsert", "on conflict", "excluded", "returning", "do nothing"],
      exercises: [
        {
          id: "m7-upsert-e1",
          prompt:
            "Rename category 10 to `Guitars & Basses` using an **upsert**: insert `(10, 'Guitars & Basses', 1)` and, on a conflict on `category_id`, update the name to the value you tried to insert.",
          starter: "",
          solution:
            "INSERT INTO categories (category_id, name, parent_id)\nVALUES (10, 'Guitars & Basses', 1)\nON CONFLICT (category_id) DO UPDATE SET name = excluded.name;",
          check: "SELECT category_id, name, parent_id FROM categories WHERE category_id = 10;",
          hints: [
            "`ON CONFLICT (column) DO UPDATE SET …`",
            "`excluded.name` is the value from the row you attempted to insert.",
          ],
          requires: [{ re: "ON\\s+CONFLICT", msg: "Use ON CONFLICT — that is what makes it an upsert." }],
        },
        {
          id: "m7-upsert-e2",
          prompt:
            "Create `tag_counts (tag TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0)` and record three hits for the tag `pro` by running the same counter upsert three times.",
          starter: "",
          solution:
            "CREATE TABLE tag_counts (tag TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0);\n\nINSERT INTO tag_counts (tag, hits) VALUES ('pro', 1)\nON CONFLICT (tag) DO UPDATE SET hits = hits + 1;\nINSERT INTO tag_counts (tag, hits) VALUES ('pro', 1)\nON CONFLICT (tag) DO UPDATE SET hits = hits + 1;\nINSERT INTO tag_counts (tag, hits) VALUES ('pro', 1)\nON CONFLICT (tag) DO UPDATE SET hits = hits + 1;",
          check: "SELECT tag, hits FROM tag_counts ORDER BY tag;",
          hints: [
            "The first insert creates the row; the next two hit the conflict clause.",
            "`SET hits = hits + 1` reads the existing value.",
          ],
        },
        {
          id: "m7-upsert-e3",
          prompt:
            "Restock everything that is out of stock — add 5 units — and have the statement **return** `product_id`, `name` and the new `units_in_stock` for the rows it changed.",
          starter: "",
          solution:
            "UPDATE products SET units_in_stock = units_in_stock + 5\nWHERE units_in_stock = 0\nRETURNING product_id, name, units_in_stock;",
          check: "SELECT product_id, units_in_stock FROM products ORDER BY product_id;",
          hints: ["Append `RETURNING col, col, col` to the UPDATE."],
          requires: [{ re: "\\bRETURNING\\b", msg: "Add a RETURNING clause." }],
        },
      ],
    },

    {
      id: "m7-checkpoint",
      title: "Checkpoint: safe changes",
      goal: "Perform a multi-step data migration correctly and atomically.",
      keywords: ["practice", "checkpoint", "migration", "archive"],
      exercises: [
        {
          id: "m7-cp-e1",
          prompt:
            "**Archive and clean up.** Create `cancelled_archive (order_id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL, order_date TEXT NOT NULL)`, copy every cancelled order into it, then delete those orders' line items and the orders themselves — all inside one transaction.",
          starter:
            "CREATE TABLE cancelled_archive (\n  order_id    INTEGER PRIMARY KEY,\n  customer_id INTEGER NOT NULL,\n  order_date  TEXT NOT NULL\n);\n\nBEGIN;\n  -- copy, then delete children, then parents\nCOMMIT;",
          solution:
            "CREATE TABLE cancelled_archive (\n  order_id    INTEGER PRIMARY KEY,\n  customer_id INTEGER NOT NULL,\n  order_date  TEXT NOT NULL\n);\n\nBEGIN;\n  INSERT INTO cancelled_archive (order_id, customer_id, order_date)\n  SELECT order_id, customer_id, order_date FROM orders WHERE status = 'cancelled';\n\n  DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM cancelled_archive);\n  DELETE FROM orders WHERE order_id IN (SELECT order_id FROM cancelled_archive);\nCOMMIT;",
          check:
            "SELECT (SELECT COUNT(*) FROM cancelled_archive) AS archived, (SELECT COUNT(*) FROM orders) AS orders_left, (SELECT COUNT(*) FROM order_items) AS items_left;",
          hints: [
            "Copy first — once the orders are gone you cannot find them again.",
            "Delete children before parents, or the foreign key will stop you.",
          ],
        },
        {
          id: "m7-cp-e2",
          prompt:
            "**Price correction.** Every product supplied by a supplier in `Sweden` was mispriced: reduce those products' `unit_price` by 5%, rounded to 2 decimals.",
          starter: "",
          solution:
            "UPDATE products\nSET unit_price = ROUND(unit_price * 0.95, 2)\nWHERE supplier_id IN (SELECT supplier_id FROM suppliers WHERE country = 'Sweden');",
          check: "SELECT product_id, unit_price FROM products ORDER BY product_id;",
          hints: [
            "Pick the supplier ids with a subquery.",
            "Round inside the SET expression so the stored value is clean.",
          ],
        },
      ],
    },
  ],
};
