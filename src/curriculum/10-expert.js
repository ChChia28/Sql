/* Module 10 — Expert Track --------------------------------------------- */

export default {
  id: "expert",
  number: 10,
  title: "Expert Track",
  level: "Expert",
  summary:
    "How the engine really runs your query: execution order, query plans, index design, sargability, schema design, concurrency, anti-patterns, portability — and four capstone problems.",
  lessons: [
    {
      id: "m10-execution-order",
      title: "How a query is actually evaluated",
      goal: "Use the logical processing order to explain and fix any clause-level error.",
      keywords: ["execution order", "logical order", "alias", "having", "evaluation"],
      exercises: [
        {
          id: "m10-order-e1",
          prompt:
            "The starter runs in SQLite but is rejected by PostgreSQL, MySQL and SQL Server, because `WHERE` is evaluated before the `SELECT` list exists. Make it portable: return `name` and `sale_price` for products whose discounted price is under 100, sorted by `sale_price` then `product_id`, without referring to the alias in `WHERE`.",
          starter:
            "SELECT name, ROUND(unit_price * 0.9, 2) AS sale_price\nFROM products\nWHERE sale_price < 100\nORDER BY sale_price, product_id;",
          solution:
            "SELECT name, ROUND(unit_price * 0.9, 2) AS sale_price\nFROM products\nWHERE unit_price * 0.9 < 100\nORDER BY sale_price, product_id;",
          hints: [
            "WHERE runs before the SELECT list, so in standard SQL the alias does not exist yet.",
            "Repeat the expression in WHERE (ORDER BY may keep using the alias).",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [
            { re: "WHERE\\s+unit_price", msg: "Repeat the expression in WHERE instead of using the alias." },
          ],
        },
        {
          id: "m10-order-e2",
          prompt:
            "Return `customer_id` and `orders` for customers with **8 or more non-cancelled orders**, most orders first, tie-broken by `customer_id`, limit 5. Put each condition in the clause that can actually evaluate it.",
          starter: "",
          solution:
            "SELECT customer_id, COUNT(*) AS orders\nFROM orders\nWHERE status <> 'cancelled'\nGROUP BY customer_id\nHAVING COUNT(*) >= 8\nORDER BY orders DESC, customer_id\nLIMIT 5;",
          hints: ["Row filter → WHERE. Group filter → HAVING."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Why can't `WHERE` filter on `ROW_NUMBER() OVER (…)`?",
          options: [
            "Window functions are not allowed in SELECT either",
            "Window functions are evaluated after WHERE — wrap the query in a CTE and filter outside",
            "ROW_NUMBER needs an index",
            "It can, if you add parentheses",
          ],
          answer: 1,
          explain:
            "Evaluation order: FROM → WHERE → GROUP BY → HAVING → SELECT → windows → ORDER BY → LIMIT.",
        },
      ],
    },

    {
      id: "m10-explain",
      title: "Reading a query plan",
      goal: "Ask the engine what it intends to do, and understand the answer.",
      keywords: ["explain", "query plan", "scan", "search", "temp b-tree", "covering index"],
      exercises: [
        {
          id: "m10-explain-e1",
          prompt:
            "Show the query plan for `SELECT * FROM orders WHERE customer_id = 42;` — return the plan itself, not the rows.",
          starter: "SELECT * FROM orders WHERE customer_id = 42;",
          solution: "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 42;",
          hints: [
            "Prefix the statement with `EXPLAIN QUERY PLAN`.",
            "The plan mentions `idx_orders_customer` — an index lookup, not a scan.",
          ],
          requires: [{ re: "EXPLAIN\\s+QUERY\\s+PLAN", msg: "Use EXPLAIN QUERY PLAN." }],
        },
        {
          id: "m10-explain-e2",
          prompt:
            "Show the query plan for `SELECT * FROM products ORDER BY unit_price DESC LIMIT 10;`. Read the output: it has to build a temporary B-tree to sort.",
          starter: "",
          solution:
            "EXPLAIN QUERY PLAN SELECT * FROM products ORDER BY unit_price DESC LIMIT 10;",
          hints: ["Same prefix; look for `USE TEMP B-TREE FOR ORDER BY`."],
          requires: [{ re: "EXPLAIN\\s+QUERY\\s+PLAN", msg: "Use EXPLAIN QUERY PLAN." }],
        },
      ],
      quiz: [
        {
          q: "`SCAN orders` in a query plan means…",
          options: [
            "the query is broken",
            "every row of orders is read and tested",
            "an index is being used",
            "the result will be sorted",
          ],
          answer: 1,
          explain:
            "A scan is fine on a small table and expensive on a large one — especially inside a join, where it may repeat.",
        },
      ],
    },

    {
      id: "m10-indexes",
      title: "Index design",
      goal: "Add the right index for a query, including composite, covering and expression indexes.",
      keywords: ["index", "composite index", "covering index", "expression index", "foreign key"],
      exercises: [
        {
          id: "m10-idx-e1",
          prompt:
            "Create a composite index named `idx_orders_cust_date` on `orders(customer_id, order_date)` — the right column order for `WHERE customer_id = ? ORDER BY order_date`.",
          starter: "",
          solution: "CREATE INDEX idx_orders_cust_date ON orders(customer_id, order_date);",
          check:
            "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_orders_cust_date';",
          hints: [
            "Equality column first, then the sort column.",
            "`CREATE INDEX name ON table(col_a, col_b);`",
          ],
        },
        {
          id: "m10-idx-e2",
          prompt:
            "Create an index named `idx_products_cat_price` on `products(category_id, unit_price)` so that `SELECT category_id, unit_price FROM products WHERE category_id = ?` can be answered from the index alone.",
          starter: "",
          solution: "CREATE INDEX idx_products_cat_price ON products(category_id, unit_price);",
          check:
            "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_products_cat_price';",
          hints: [
            "A covering index holds every column the query touches.",
            "Afterwards the plan says `USING COVERING INDEX`.",
          ],
        },
        {
          id: "m10-idx-e3",
          prompt:
            "Case-insensitive lookups on surnames are slow. Create an expression index named `idx_customers_lower_last` over `LOWER(last_name)` on `customers`.",
          starter: "",
          solution: "CREATE INDEX idx_customers_lower_last ON customers(LOWER(last_name));",
          check:
            "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_customers_lower_last';",
          hints: ["An index may be built over an expression, not just a column."],
        },
      ],
      quiz: [
        {
          q: "You have an index on `(country, city)`. Which query cannot use it?",
          options: [
            "WHERE country = 'USA'",
            "WHERE country = 'USA' AND city = 'Austin'",
            "WHERE city = 'Austin'",
            "WHERE country = 'USA' ORDER BY city",
          ],
          answer: 2,
          explain:
            "A composite index is sorted by its first column. Searching the second alone is like finding a first name in a phone book sorted by surname.",
        },
      ],
    },

    {
      id: "m10-sargable",
      title: "Sargable predicates and pagination",
      goal: "Write filters an index can use, and paginate without OFFSET.",
      keywords: ["sargable", "index usage", "keyset pagination", "seek method", "or", "union"],
      exercises: [
        {
          id: "m10-sarg-e1",
          prompt:
            "Rewrite this so an index on `order_date` could be used: count the orders placed in 2025. Return one column `orders_2025` — **without** calling a function on `order_date`.",
          starter:
            "SELECT COUNT(*) AS orders_2025\nFROM orders\nWHERE strftime('%Y', order_date) = '2025';",
          solution:
            "SELECT COUNT(*) AS orders_2025\nFROM orders\nWHERE order_date >= '2025-01-01' AND order_date < '2026-01-01';",
          hints: [
            "Turn the function call into a half-open range on the bare column.",
            "`>= '2025-01-01' AND < '2026-01-01'`",
          ],
          checkColumnNames: true,
          requires: [
            { re: "strftime|substr\\s*\\(\\s*order_date", not: true, msg: "Keep the column bare — no function calls on order_date." },
          ],
        },
        {
          id: "m10-sarg-e2",
          prompt:
            "Keyset pagination: return the next 5 products after `product_id` 40 — columns `product_id`, `name`, `unit_price`, ordered by `product_id`. Do not use OFFSET.",
          starter: "",
          solution:
            "SELECT product_id, name, unit_price\nFROM products\nWHERE product_id > 40\nORDER BY product_id\nLIMIT 5;",
          hints: [
            "Filter on the last key you saw instead of skipping rows.",
            "`WHERE product_id > 40 ORDER BY product_id LIMIT 5`",
          ],
          orderMatters: true,
          requires: [{ re: "\\bOFFSET\\b", not: true, msg: "That is the OFFSET approach — page by key instead." }],
        },
        {
          id: "m10-sarg-e3",
          prompt:
            "Replace an `OR` across two different columns with a set operation: return `order_id` for orders belonging to customer 12 **or** handled by employee 5, sorted ascending, limit 10. Each branch should be able to use its own index.",
          starter:
            "SELECT order_id FROM orders WHERE customer_id = 12 OR employee_id = 5 ORDER BY order_id LIMIT 10;",
          solution:
            "SELECT order_id FROM orders WHERE customer_id = 12\nUNION\nSELECT order_id FROM orders WHERE employee_id = 5\nORDER BY order_id\nLIMIT 10;",
          hints: [
            "Two queries, combined with UNION (which also removes the overlap).",
            "One ORDER BY at the very end.",
          ],
          orderMatters: true,
          requires: [{ re: "\\bUNION\\b", msg: "Combine the two branches with UNION." }],
        },
      ],
    },

    {
      id: "m10-design",
      title: "Schema design and normalisation",
      goal: "Apply 1NF–3NF, know when to denormalise, and prove a denormalised copy still agrees.",
      keywords: ["normalisation", "1nf", "2nf", "3nf", "denormalisation", "keys", "history"],
      exercises: [
        {
          id: "m10-design-e1",
          prompt:
            "`order_items.unit_price` records the price at the time of sale. Find the drift: return `order_id`, product `name`, `price_when_sold` and `price_today` where they differ, sorted by `order_id` then `name`, limit 15.",
          starter: "",
          solution:
            "SELECT i.order_id, p.name, i.unit_price AS price_when_sold, p.unit_price AS price_today\nFROM order_items AS i\nJOIN products AS p ON p.product_id = i.product_id\nWHERE i.unit_price <> p.unit_price\nORDER BY i.order_id, p.name\nLIMIT 15;",
          hints: ["Join the line item to the product and compare the two prices."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m10-design-e2",
          prompt:
            "**Reconciliation.** For each order, compare what was charged with what was paid: return `order_id`, `order_total` (goods + shipping, 2 dp) and `paid` (2 dp) for orders where the two differ by more than 1.00, sorted by `order_id`, limit 15.",
          starter: "",
          solution:
            "WITH goods AS (\n  SELECT order_id, SUM(quantity * unit_price * (1 - discount)) AS goods_total\n  FROM order_items\n  GROUP BY order_id\n),\npaid AS (\n  SELECT order_id, SUM(amount) AS paid FROM payments GROUP BY order_id\n)\nSELECT\n  o.order_id,\n  ROUND(g.goods_total + o.shipping_cost, 2) AS order_total,\n  ROUND(p.paid, 2) AS paid\nFROM orders AS o\nJOIN goods AS g ON g.order_id = o.order_id\nJOIN paid AS p ON p.order_id = o.order_id\nWHERE ABS(g.goods_total + o.shipping_cost - p.paid) > 1.0\nORDER BY o.order_id\nLIMIT 15;",
          hints: [
            "Aggregate each side at its own grain in a CTE — never join both children at once.",
            "Compare with `ABS(a - b) > 1.0` so rounding noise is ignored.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Storing `supplier_country` in `products` would break which rule?",
          options: [
            "1NF — more than one value per cell",
            "3NF — a non-key column depending on another non-key column",
            "Nothing; it is good practice",
            "The primary key rule",
          ],
          answer: 1,
          explain:
            "The country depends on the supplier, not on the product. Copy it and the two will disagree eventually.",
        },
        {
          q: "Why is `order_items.unit_price` NOT a normalisation violation?",
          options: [
            "Because prices never change",
            "Because it records a different fact: the price at the time of sale",
            "Because it is indexed",
            "It is a violation, but an accepted one",
          ],
          answer: 1,
          explain: "Historical facts must be stored; recomputing them from today's data would be wrong.",
        },
      ],
    },

    {
      id: "m10-concurrency",
      title: "Transactions and concurrency",
      goal: "Avoid lost updates, keep transactions short, and write retry-safe statements.",
      keywords: ["isolation", "lost update", "optimistic concurrency", "deadlock", "idempotent"],
      exercises: [
        {
          id: "m10-conc-e1",
          prompt:
            "Sell one unit of product 1 **atomically**: decrement `units_in_stock` in the database (not read-then-write), only if there is at least one unit, and return `product_id` and the new `units_in_stock`.",
          starter: "",
          solution:
            "UPDATE products\nSET units_in_stock = units_in_stock - 1\nWHERE product_id = 1 AND units_in_stock >= 1\nRETURNING product_id, units_in_stock;",
          check: "SELECT product_id, units_in_stock FROM products WHERE product_id = 1;",
          hints: [
            "`SET units_in_stock = units_in_stock - 1` avoids the read-modify-write gap.",
            "Add the stock condition to WHERE, and a RETURNING clause.",
          ],
        },
        {
          id: "m10-conc-e2",
          prompt:
            "Make an insert **idempotent**: add category 50 named `Software`, but if it already exists, do nothing. Running your statement twice must not fail or duplicate.",
          starter: "",
          solution:
            "INSERT INTO categories (category_id, name) VALUES (50, 'Software')\nON CONFLICT (category_id) DO NOTHING;\nINSERT INTO categories (category_id, name) VALUES (50, 'Software')\nON CONFLICT (category_id) DO NOTHING;",
          check: "SELECT category_id, name FROM categories WHERE category_id = 50;",
          hints: [
            "`ON CONFLICT (category_id) DO NOTHING`",
            "Run it twice in your answer to prove it is safe.",
          ],
          requires: [{ re: "DO\\s+NOTHING", msg: "Use ON CONFLICT … DO NOTHING." }],
        },
      ],
      quiz: [
        {
          q: "Two sessions read stock = 10, each writes 9. What is this called, and what prevents it?",
          options: [
            "Dirty read; use READ COMMITTED",
            "Lost update; do the arithmetic in the UPDATE, or use a conditional/versioned update",
            "Phantom read; add an index",
            "Deadlock; retry",
          ],
          answer: 1,
          explain:
            "`SET stock = stock - 1` is atomic. Conditional updates plus retries handle the rest.",
        },
      ],
    },

    {
      id: "m10-antipatterns",
      title: "Anti-patterns worth unlearning",
      goal: "Recognise the queries that look fine and behave badly.",
      keywords: ["anti-pattern", "select star", "distinct", "not in", "implicit join"],
      exercises: [
        {
          id: "m10-anti-e1",
          prompt:
            "Rewrite `SELECT DISTINCT c.customer_id, c.last_name FROM customers c JOIN orders o ON o.customer_id = c.customer_id` without `DISTINCT` and without `GROUP BY`. Sort by `customer_id`.",
          starter:
            "SELECT DISTINCT c.customer_id, c.last_name\nFROM customers AS c\nJOIN orders AS o ON o.customer_id = c.customer_id\nORDER BY c.customer_id;",
          solution:
            "SELECT c.customer_id, c.last_name\nFROM customers AS c\nWHERE EXISTS (SELECT 1 FROM orders AS o WHERE o.customer_id = c.customer_id)\nORDER BY c.customer_id;",
          hints: [
            "The join duplicates a customer once per order; EXISTS asks the question without duplicating anything.",
          ],
          orderMatters: true,
          requires: [
            { re: "\\bDISTINCT\\b", not: true, msg: "Solve it without DISTINCT." },
            { re: "\\bGROUP\\s+BY\\b", not: true, msg: "Solve it without GROUP BY." },
          ],
        },
        {
          id: "m10-anti-e2",
          prompt:
            "Fix a NULL-unsafe anti-join: return `employee_id` and `last_name` for employees who have never handled an order, sorted by `employee_id`. Use `NOT EXISTS`.",
          starter:
            "SELECT employee_id, last_name\nFROM employees\nWHERE employee_id NOT IN (SELECT employee_id FROM orders)\nORDER BY employee_id;",
          solution:
            "SELECT e.employee_id, e.last_name\nFROM employees AS e\nWHERE NOT EXISTS (SELECT 1 FROM orders AS o WHERE o.employee_id = e.employee_id)\nORDER BY e.employee_id;",
          hints: [
            "`orders.employee_id` contains NULLs, so NOT IN returns nothing at all.",
            "NOT EXISTS never compares against NULL.",
          ],
          orderMatters: true,
          requires: [{ re: "NOT\\s+EXISTS", msg: "Use NOT EXISTS." }],
        },
      ],
      quiz: [
        {
          q: "When is `SELECT *` genuinely fine?",
          options: [
            "Always",
            "While exploring interactively, or in `EXISTS (SELECT * …)` where nothing is read",
            "Never",
            "Only inside views",
          ],
          answer: 1,
          explain:
            "In application code, name your columns: stable results, less I/O, and covering indexes stay possible.",
        },
      ],
    },

    {
      id: "m10-portability",
      title: "SQLite versus the rest",
      goal: "Know which parts of your SQL will move unchanged to PostgreSQL or MySQL.",
      keywords: ["portability", "postgres", "mysql", "dialect", "standard sql"],
      exercises: [
        {
          id: "m10-port-e1",
          prompt:
            "Write a year-by-year order count whose only SQLite-specific part is the date function: return `year` as an **integer** and `orders`, sorted by year.",
          starter: "",
          solution:
            "SELECT CAST(strftime('%Y', order_date) AS INTEGER) AS year, COUNT(*) AS orders\nFROM orders\nGROUP BY year\nORDER BY year;",
          hints: [
            "`strftime` returns text — CAST it to INTEGER.",
            "`CAST(x AS type)` is standard SQL; `x::type` is PostgreSQL-only.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Which expression concatenates strings in SQLite and PostgreSQL but means OR in MySQL's default mode?",
          options: ["CONCAT(a, b)", "a || b", "a + b", "a & b"],
          answer: 1,
          explain:
            "MySQL treats || as a logical OR unless PIPES_AS_CONCAT is enabled — use CONCAT() when targeting MySQL.",
        },
      ],
    },

    {
      id: "m10-capstone",
      title: "Capstone challenges",
      goal: "Solve realistic, multi-step problems end to end.",
      keywords: ["capstone", "challenge", "practice", "analytics"],
      exercises: [
        {
          id: "m10-cap-e1",
          prompt:
            "**Monthly revenue report (2025).** Return `month`, `revenue` (2 dp), `orders`, `running_revenue` (2 dp) and `pct_change` (1 dp vs the previous month) for completed orders in 2025, sorted by month.",
          starter: "",
          solution:
            "WITH monthly AS (\n  SELECT\n    substr(o.order_date, 1, 7) AS month,\n    SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue,\n    COUNT(DISTINCT o.order_id) AS orders\n  FROM orders AS o\n  JOIN order_items AS i ON i.order_id = o.order_id\n  WHERE o.status = 'completed' AND o.order_date >= '2025-01-01'\n  GROUP BY month\n)\nSELECT\n  month,\n  ROUND(revenue, 2) AS revenue,\n  orders,\n  ROUND(SUM(revenue) OVER (ORDER BY month), 2) AS running_revenue,\n  ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))\n        / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 1) AS pct_change\nFROM monthly\nORDER BY month;",
          hints: [
            "Aggregate per month in a CTE, then apply windows in the outer query.",
            "`COUNT(DISTINCT o.order_id)` because the join fans out per line item.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m10-cap-e2",
          prompt:
            "**Pareto check.** How many products account for the first 80% of all revenue? Return one column `products_for_80pct`.",
          starter: "",
          solution:
            "WITH revenue AS (\n  SELECT product_id, SUM(quantity * unit_price * (1 - discount)) AS rev\n  FROM order_items\n  GROUP BY product_id\n),\ncumulative AS (\n  SELECT\n    product_id,\n    rev,\n    SUM(rev) OVER (ORDER BY rev DESC, product_id) AS running,\n    SUM(rev) OVER () AS total\n  FROM revenue\n)\nSELECT COUNT(*) AS products_for_80pct\nFROM cumulative\nWHERE running - rev < 0.8 * total;",
          hints: [
            "Order products by revenue descending and take a running total.",
            "Count the rows whose running total *before* them is still below 80% — that includes the one that crosses the line.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m10-cap-e3",
          prompt:
            "**Top 3 customers per country.** Return `country`, `customer_id`, `revenue` (2 dp) and `rank_in_country` for the three highest-revenue customers in each country (completed orders only; ignore unknown countries). Sort by `country` then `rank_in_country`.",
          starter: "",
          solution:
            "WITH customer_revenue AS (\n  SELECT\n    c.country,\n    c.customer_id,\n    SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue\n  FROM customers AS c\n  JOIN orders AS o ON o.customer_id = c.customer_id AND o.status = 'completed'\n  JOIN order_items AS i ON i.order_id = o.order_id\n  WHERE c.country IS NOT NULL\n  GROUP BY c.country, c.customer_id\n),\nranked AS (\n  SELECT\n    country,\n    customer_id,\n    revenue,\n    ROW_NUMBER() OVER (PARTITION BY country ORDER BY revenue DESC, customer_id) AS rank_in_country\n  FROM customer_revenue\n)\nSELECT country, customer_id, ROUND(revenue, 2) AS revenue, rank_in_country\nFROM ranked\nWHERE rank_in_country <= 3\nORDER BY country, rank_in_country;",
          hints: [
            "Revenue per customer first, then ROW_NUMBER partitioned by country.",
            "Filter the rank in an outer query.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m10-cap-e4",
          prompt:
            "**Sales org scoreboard.** For every employee in the `Sales` department return `employee_id`, `last_name`, `depth` (levels below the CEO, who is 0), `orders` (distinct orders handled) and `revenue` (2 dp, 0 when none). Sort by `revenue` descending, then `employee_id`. Use a recursive CTE for the depth.",
          starter: "",
          solution:
            "WITH RECURSIVE chain AS (\n  SELECT employee_id, manager_id, 0 AS depth\n  FROM employees\n  WHERE manager_id IS NULL\n  UNION ALL\n  SELECT e.employee_id, e.manager_id, c.depth + 1\n  FROM employees AS e\n  JOIN chain AS c ON e.manager_id = c.employee_id\n),\nsales AS (\n  SELECT\n    e.employee_id,\n    e.last_name,\n    ch.depth,\n    COUNT(DISTINCT o.order_id) AS orders,\n    COALESCE(SUM(i.quantity * i.unit_price * (1 - i.discount)), 0) AS revenue\n  FROM employees AS e\n  JOIN chain AS ch ON ch.employee_id = e.employee_id\n  LEFT JOIN orders AS o ON o.employee_id = e.employee_id\n  LEFT JOIN order_items AS i ON i.order_id = o.order_id\n  WHERE e.department = 'Sales'\n  GROUP BY e.employee_id, e.last_name, ch.depth\n)\nSELECT employee_id, last_name, depth, orders, ROUND(revenue, 2) AS revenue\nFROM sales\nORDER BY revenue DESC, employee_id;",
          hints: [
            "Recursive CTE from the CEO downwards gives each employee a depth.",
            "Join it to the employees, then LEFT JOIN orders and order_items.",
            "COUNT(DISTINCT o.order_id) avoids counting an order once per line item.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },
  ],
};
