/* Module 5 — Subqueries & CTEs ---------------------------------------- */

export default {
  id: "subqueries",
  number: 5,
  title: "Subqueries & CTEs",
  level: "Intermediate",
  summary:
    "Compose queries out of queries: scalar subqueries, IN and EXISTS, correlation, derived tables and the WITH clause.",
  lessons: [
    {
      id: "m5-scalar",
      title: "Scalar subqueries",
      goal: "Compare rows against a value the database computes for you.",
      keywords: ["subquery", "scalar", "average", "threshold"],
      exercises: [
        {
          id: "m5-scalar-e1",
          prompt:
            "Which products cost **more than the average product**? Return `name` and `unit_price`, dearest first, tie-broken by `product_id`.",
          starter:
            "SELECT name, unit_price\nFROM products\nWHERE unit_price > 0   -- replace 0 with a subquery\nORDER BY unit_price DESC, product_id;",
          solution:
            "SELECT name, unit_price\nFROM products\nWHERE unit_price > (SELECT AVG(unit_price) FROM products)\nORDER BY unit_price DESC, product_id;",
          hints: [
            "`(SELECT AVG(unit_price) FROM products)` is a single value.",
            "A subquery in WHERE goes in brackets.",
          ],
          orderMatters: true,
          requires: [{ re: "SELECT[\\s\\S]*\\(\\s*SELECT", msg: "Compute the threshold with a subquery rather than typing a number." }],
        },
        {
          id: "m5-scalar-e2",
          prompt:
            "Return `name`, `unit_price` and `diff_from_avg` — how far each product's price is from the catalogue average, rounded to 2 dp. Show the 8 furthest above, ordered by `diff_from_avg` descending.",
          starter: "",
          solution:
            "SELECT\n  name,\n  unit_price,\n  ROUND(unit_price - (SELECT AVG(unit_price) FROM products), 2) AS diff_from_avg\nFROM products\nORDER BY diff_from_avg DESC\nLIMIT 8;",
          hints: ["A scalar subquery is allowed in the SELECT list too."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "A scalar subquery in WHERE returns no rows. What happens?",
          options: [
            "The query errors",
            "It behaves as 0",
            "It yields NULL, so the comparison is unknown and no rows match",
            "The subquery is skipped",
          ],
          answer: 2,
          explain: "An empty scalar subquery is NULL, and comparing with NULL is never true.",
        },
      ],
    },

    {
      id: "m5-in",
      title: "IN with a subquery",
      goal: "Filter against a list the database computes — and dodge the NOT IN / NULL trap.",
      keywords: ["in", "not in", "subquery", "null trap"],
      exercises: [
        {
          id: "m5-in-e1",
          prompt:
            "Which customers have returned something? Return `customer_id` and `last_name` for customers with at least one order whose status is `returned`, sorted by `customer_id`. Use `IN` with a subquery.",
          starter: "",
          solution:
            "SELECT customer_id, last_name\nFROM customers\nWHERE customer_id IN (SELECT customer_id FROM orders WHERE status = 'returned')\nORDER BY customer_id;",
          hints: ["The inner query lists customer ids; the outer one filters on them."],
          orderMatters: true,
          requires: [{ re: "IN\\s*\\(\\s*SELECT", msg: "Use IN with a subquery here." }],
        },
        {
          id: "m5-in-e2",
          prompt:
            "How many employees have **never** handled an order? Return one column `employees_with_no_orders`. Careful: `orders.employee_id` contains NULLs, which breaks a naive `NOT IN`.",
          starter:
            "SELECT COUNT(*) AS employees_with_no_orders\nFROM employees\nWHERE employee_id NOT IN (SELECT employee_id FROM orders);",
          solution:
            "SELECT COUNT(*) AS employees_with_no_orders\nFROM employees\nWHERE employee_id NOT IN (\n  SELECT employee_id FROM orders WHERE employee_id IS NOT NULL\n);",
          hints: [
            "The starter returns 0 because the subquery list contains NULL.",
            "Filter the NULLs out of the subquery — or switch to NOT EXISTS.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "`x NOT IN (SELECT col FROM t)` returns nothing at all. The most likely cause is…",
          options: [
            "t is empty",
            "col contains at least one NULL",
            "x is an integer",
            "NOT IN needs brackets",
          ],
          answer: 1,
          explain:
            "One NULL in the list makes every NOT IN comparison unknown. Filter NULLs out or use NOT EXISTS.",
        },
      ],
    },

    {
      id: "m5-exists",
      title: "EXISTS and NOT EXISTS",
      goal: "Ask whether related rows exist — the safest and usually fastest test.",
      keywords: ["exists", "not exists", "anti join", "correlated"],
      exercises: [
        {
          id: "m5-exists-e1",
          prompt:
            "Return `customer_id` and `last_name` for customers with at least one **completed** order, sorted by `customer_id`. Use `EXISTS`.",
          starter: "",
          solution:
            "SELECT c.customer_id, c.last_name\nFROM customers AS c\nWHERE EXISTS (\n  SELECT 1 FROM orders AS o\n  WHERE o.customer_id = c.customer_id AND o.status = 'completed'\n)\nORDER BY c.customer_id;",
          hints: [
            "The inner query refers to the outer row: `o.customer_id = c.customer_id`.",
            "`SELECT 1` is the conventional body.",
          ],
          orderMatters: true,
          requires: [{ re: "\\bEXISTS\\b", msg: "This exercise is about EXISTS." }],
        },
        {
          id: "m5-exists-e2",
          prompt:
            "Return `product_id` and `name` for products that have **never been reviewed**, sorted by `product_id`. Use `NOT EXISTS`.",
          starter: "",
          solution:
            "SELECT p.product_id, p.name\nFROM products AS p\nWHERE NOT EXISTS (\n  SELECT 1 FROM reviews AS r WHERE r.product_id = p.product_id\n)\nORDER BY p.product_id;",
          hints: ["Same shape as EXISTS, negated."],
          orderMatters: true,
          requires: [{ re: "NOT\\s+EXISTS", msg: "Use NOT EXISTS for this one." }],
        },
        {
          id: "m5-exists-e3",
          prompt:
            "Which customers have bought something expensive? Return `customer_id` and `last_name` for customers with an order containing a product priced **over 2000**, sorted by `customer_id`.",
          starter: "",
          solution:
            "SELECT c.customer_id, c.last_name\nFROM customers AS c\nWHERE EXISTS (\n  SELECT 1\n  FROM orders AS o\n  JOIN order_items AS i ON i.order_id = o.order_id\n  JOIN products AS p ON p.product_id = i.product_id\n  WHERE o.customer_id = c.customer_id\n    AND p.unit_price > 2000\n)\nORDER BY c.customer_id;",
          hints: [
            "The subquery can join as many tables as it needs.",
            "Correlate it back to the outer customer with `o.customer_id = c.customer_id`.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "Why is NOT EXISTS preferred over NOT IN for anti-joins?",
          options: [
            "It is shorter to type",
            "It is unaffected by NULLs in the inner result",
            "NOT IN is deprecated",
            "It always returns more rows",
          ],
          answer: 1,
          explain:
            "EXISTS only asks whether a row matched; it never compares a value against NULL.",
        },
      ],
    },

    {
      id: "m5-correlated",
      title: "Correlated subqueries",
      goal: "Compute a per-row value that depends on the row itself.",
      keywords: ["correlated", "per row", "per group average", "lookup"],
      exercises: [
        {
          id: "m5-corr-e1",
          prompt:
            "For each customer return `customer_id`, `last_name` and `orders` — the number of orders they placed — using a **correlated subquery** (no JOIN, no GROUP BY). Show the 10 busiest, ties broken by `customer_id`.",
          starter: "",
          solution:
            "SELECT\n  c.customer_id,\n  c.last_name,\n  (SELECT COUNT(*) FROM orders AS o WHERE o.customer_id = c.customer_id) AS orders\nFROM customers AS c\nORDER BY orders DESC, c.customer_id\nLIMIT 10;",
          hints: [
            "Put the subquery in the SELECT list and correlate it to `c.customer_id`.",
            "Customers with no orders get 0 automatically.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "\\bGROUP\\s+BY\\b", not: true, msg: "Do it with a correlated subquery this time — no GROUP BY." }],
        },
        {
          id: "m5-corr-e2",
          prompt:
            "Which products cost more than the average price **of their own category**? Return `name`, `category_id` and `unit_price`, sorted by `category_id` then `unit_price` descending.",
          starter: "",
          solution:
            "SELECT p.name, p.category_id, p.unit_price\nFROM products AS p\nWHERE p.unit_price > (\n  SELECT AVG(p2.unit_price) FROM products AS p2 WHERE p2.category_id = p.category_id\n)\nORDER BY p.category_id, p.unit_price DESC;",
          hints: [
            "The inner query needs its own alias so it can refer to the outer row.",
            "Correlate on `p2.category_id = p.category_id`.",
          ],
          orderMatters: true,
        },
        {
          id: "m5-corr-e3",
          prompt:
            "For the first 10 orders (by `order_id`), return `order_id` and `items` — the number of line items on that order — using a correlated subquery.",
          starter: "",
          solution:
            "SELECT\n  o.order_id,\n  (SELECT COUNT(*) FROM order_items AS i WHERE i.order_id = o.order_id) AS items\nFROM orders AS o\nORDER BY o.order_id\nLIMIT 10;",
          hints: ["Correlate on `i.order_id = o.order_id`."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "What makes a subquery 'correlated'?",
          options: [
            "It appears in the WHERE clause",
            "It references a column from the outer query",
            "It returns more than one row",
            "It uses an aggregate",
          ],
          answer: 1,
          explain:
            "The reference to the outer row means the subquery is conceptually evaluated per row, rather than once.",
        },
      ],
    },

    {
      id: "m5-derived",
      title: "Derived tables",
      goal: "Use a query as a table so you can aggregate twice or join pre-aggregated data.",
      keywords: ["derived table", "from subquery", "two-level aggregation", "pre-aggregate"],
      exercises: [
        {
          id: "m5-derived-e1",
          prompt:
            "What is the **average number of line items per order**? Return one column `avg_items_per_order`, rounded to 2 dp.",
          starter:
            "SELECT order_id, COUNT(*) AS items\nFROM order_items\nGROUP BY order_id;",
          solution:
            "SELECT ROUND(AVG(items), 2) AS avg_items_per_order\nFROM (\n  SELECT order_id, COUNT(*) AS items\n  FROM order_items\n  GROUP BY order_id\n) AS per_order;",
          hints: [
            "Count per order first, then average those counts.",
            "Wrap the starter query in brackets in the FROM clause and give it an alias.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m5-derived-e2",
          prompt:
            "Join pre-aggregated line items to their order: return `order_id`, `shipping_cost`, `items` and `goods_total` (2 dp) for the 10 orders with the highest goods total, tie-broken by `order_id`.",
          starter: "",
          solution:
            "SELECT o.order_id, o.shipping_cost, li.items, ROUND(li.goods_total, 2) AS goods_total\nFROM orders AS o\nJOIN (\n  SELECT order_id, COUNT(*) AS items,\n         SUM(quantity * unit_price * (1 - discount)) AS goods_total\n  FROM order_items\n  GROUP BY order_id\n) AS li ON li.order_id = o.order_id\nORDER BY goods_total DESC, o.order_id\nLIMIT 10;",
          hints: [
            "Aggregate `order_items` per order inside the FROM clause.",
            "Then join that result to `orders` — one row per order, no fan-out.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m5-derived-e3",
          prompt:
            "Return `max_orders_in_a_day` — the highest number of orders placed on any single date.",
          starter: "",
          solution:
            "SELECT MAX(orders) AS max_orders_in_a_day\nFROM (\n  SELECT order_date, COUNT(*) AS orders\n  FROM orders\n  GROUP BY order_date\n) AS daily;",
          hints: ["Count per day, then take the MAX of those counts."],
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m5-cte",
      title: "CTEs: the WITH clause",
      goal: "Name each step of a query and read it top to bottom.",
      keywords: ["cte", "with", "common table expression", "readability"],
      exercises: [
        {
          id: "m5-cte-e1",
          prompt:
            "Rewrite the 'average items per order' answer using a **CTE** named `per_order`. Return `avg_items_per_order` rounded to 2 dp.",
          starter: "WITH per_order AS (\n  -- count items per order\n)\nSELECT 1;",
          solution:
            "WITH per_order AS (\n  SELECT order_id, COUNT(*) AS items\n  FROM order_items\n  GROUP BY order_id\n)\nSELECT ROUND(AVG(items), 2) AS avg_items_per_order\nFROM per_order;",
          hints: ["`WITH name AS ( … ) SELECT … FROM name`."],
          checkColumnNames: true,
          requires: [{ re: "\\bWITH\\b", msg: "Use a WITH clause for this one." }],
        },
        {
          id: "m5-cte-e2",
          prompt:
            "Using a CTE, band customers by completed-order revenue: `whale` ≥ 8000, `regular` ≥ 3000, else `occasional`. Return `band`, `customers` and `avg_revenue` (2 dp), sorted by `avg_revenue` descending.",
          starter: "",
          solution:
            "WITH customer_revenue AS (\n  SELECT o.customer_id,\n         SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue\n  FROM orders AS o\n  JOIN order_items AS i ON i.order_id = o.order_id\n  WHERE o.status = 'completed'\n  GROUP BY o.customer_id\n)\nSELECT\n  CASE\n    WHEN revenue >= 8000 THEN 'whale'\n    WHEN revenue >= 3000 THEN 'regular'\n    ELSE 'occasional'\n  END AS band,\n  COUNT(*) AS customers,\n  ROUND(AVG(revenue), 2) AS avg_revenue\nFROM customer_revenue\nGROUP BY band\nORDER BY avg_revenue DESC;",
          hints: [
            "First CTE: revenue per customer from completed orders.",
            "Then band and group in the outer query.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "\\bWITH\\b", msg: "Use a WITH clause for this one." }],
        },
      ],
      quiz: [
        {
          q: "Which statement about CTEs is true?",
          options: [
            "A CTE is stored in the database until you drop it",
            "A CTE exists only for the statement it is written in",
            "A CTE is always faster than a subquery",
            "You can only have one CTE per query",
          ],
          answer: 1,
          explain:
            "CTEs are query-scoped names. Performance is usually identical to the equivalent subquery.",
        },
      ],
    },

    {
      id: "m5-cte-chain",
      title: "Chaining CTEs",
      goal: "Build multi-step analyses that stay readable and debuggable.",
      keywords: ["chained cte", "pipeline", "steps", "materialized"],
      exercises: [
        {
          id: "m5-chain-e1",
          prompt:
            "With chained CTEs, produce monthly figures for completed orders in 2025: `month` (`YYYY-MM`), `revenue` (2 dp) and `buyers` (distinct customers). Sort by month.",
          starter: "",
          solution:
            "WITH completed AS (\n  SELECT order_id, customer_id, order_date\n  FROM orders\n  WHERE status = 'completed' AND order_date >= '2025-01-01'\n),\nlines AS (\n  SELECT c.customer_id, c.order_date,\n         i.quantity * i.unit_price * (1 - i.discount) AS line_revenue\n  FROM completed AS c\n  JOIN order_items AS i ON i.order_id = c.order_id\n)\nSELECT\n  substr(order_date, 1, 7) AS month,\n  ROUND(SUM(line_revenue), 2) AS revenue,\n  COUNT(DISTINCT customer_id) AS buyers\nFROM lines\nGROUP BY month\nORDER BY month;",
          hints: [
            "First CTE: the completed 2025 orders. Second: their line items with a revenue column.",
            "Then group by the month slice of the order date.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "\\bWITH\\b", msg: "Use CTEs to build this in steps." }],
        },
        {
          id: "m5-chain-e2",
          prompt:
            "Share of revenue: return `name`, `revenue` (2 dp) and `pct_of_total` (2 dp) for the top 10 products, using a CTE for per-product revenue and referencing it twice.",
          starter: "",
          solution:
            "WITH product_revenue AS (\n  SELECT product_id, SUM(quantity * unit_price * (1 - discount)) AS revenue\n  FROM order_items\n  GROUP BY product_id\n)\nSELECT\n  p.name,\n  ROUND(r.revenue, 2) AS revenue,\n  ROUND(100.0 * r.revenue / (SELECT SUM(revenue) FROM product_revenue), 2) AS pct_of_total\nFROM product_revenue AS r\nJOIN products AS p ON p.product_id = r.product_id\nORDER BY revenue DESC, p.name\nLIMIT 10;",
          hints: [
            "The denominator is a scalar subquery over the same CTE.",
            "Remember `100.0` to avoid integer division.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m5-checkpoint",
      title: "Checkpoint: composing queries",
      goal: "Pick the right composition tool for each question.",
      keywords: ["practice", "checkpoint", "composition"],
      exercises: [
        {
          id: "m5-cp-e1",
          prompt:
            "**Above-average customers.** Return `last_name` and `revenue` (2 dp) for customers whose completed-order revenue exceeds the average customer revenue. Top 10 by revenue, tie-broken by `last_name`.",
          starter: "",
          solution:
            "WITH revenue AS (\n  SELECT o.customer_id,\n         SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue\n  FROM orders AS o\n  JOIN order_items AS i ON i.order_id = o.order_id\n  WHERE o.status = 'completed'\n  GROUP BY o.customer_id\n)\nSELECT c.last_name, ROUND(r.revenue, 2) AS revenue\nFROM revenue AS r\nJOIN customers AS c ON c.customer_id = r.customer_id\nWHERE r.revenue > (SELECT AVG(revenue) FROM revenue)\nORDER BY revenue DESC, c.last_name\nLIMIT 10;",
          hints: [
            "One CTE for per-customer revenue, then compare each row to the CTE's own average.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m5-cp-e2",
          prompt:
            "**Dormant stock.** Return `product_id`, `name` and `units_in_stock` for products that are in stock (`units_in_stock > 0`) but have **no line items in 2025**. Sort by `units_in_stock` descending, then `product_id`.",
          starter: "",
          solution:
            "SELECT p.product_id, p.name, p.units_in_stock\nFROM products AS p\nWHERE p.units_in_stock > 0\n  AND NOT EXISTS (\n    SELECT 1\n    FROM order_items AS i\n    JOIN orders AS o ON o.order_id = i.order_id\n    WHERE i.product_id = p.product_id\n      AND o.order_date >= '2025-01-01'\n  )\nORDER BY p.units_in_stock DESC, p.product_id;",
          hints: [
            "NOT EXISTS with a join inside it.",
            "The date filter belongs inside the subquery, not outside.",
          ],
          orderMatters: true,
        },
        {
          id: "m5-cp-e3",
          prompt:
            "**Category leaders.** For every category, return `category` and `top_product` — the name of its most expensive product — plus that `unit_price`. Sort by `category`. (One row per category that has products.)",
          starter: "",
          solution:
            "SELECT\n  c.name AS category,\n  (SELECT p.name FROM products AS p\n    WHERE p.category_id = c.category_id\n    ORDER BY p.unit_price DESC, p.product_id LIMIT 1) AS top_product,\n  (SELECT MAX(p.unit_price) FROM products AS p WHERE p.category_id = c.category_id) AS unit_price\nFROM categories AS c\nWHERE EXISTS (SELECT 1 FROM products AS p WHERE p.category_id = c.category_id)\nORDER BY category;",
          hints: [
            "A correlated subquery with `ORDER BY … LIMIT 1` pulls the top row per category.",
            "Use EXISTS to skip categories with no products.",
            "Window functions (Module 8) offer a neater way to do this.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },
  ],
};
