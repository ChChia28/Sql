/* Module 4 — Joins ----------------------------------------------------- */

export default {
  id: "joins",
  number: 4,
  title: "Joins",
  level: "Intermediate",
  summary:
    "Put related tables back together: inner and outer joins, self joins, anti-joins, the fan-out trap, and set operators.",
  lessons: [
    {
      id: "m4-why",
      title: "Why tables are split up",
      goal: "Read a schema, spot foreign keys, and understand what a join does to your row count.",
      keywords: ["normalisation", "foreign key", "relationship", "grain", "alias"],
      exercises: [
        {
          id: "m4-why-e1",
          prompt:
            "Join orders to customers: return `order_id`, `order_date` and the customer's `last_name` for the 20 oldest orders, sorted by `order_id`.",
          starter:
            "SELECT o.order_id, o.order_date\nFROM orders AS o\n-- add the join to customers\nORDER BY o.order_id\nLIMIT 20;",
          solution:
            "SELECT o.order_id, o.order_date, c.last_name\nFROM orders AS o\nJOIN customers AS c ON c.customer_id = o.customer_id\nORDER BY o.order_id\nLIMIT 20;",
          hints: [
            "The link is `orders.customer_id = customers.customer_id`.",
            "Give each table a short alias and qualify every column.",
          ],
          orderMatters: true,
        },
        {
          id: "m4-why-e2",
          prompt:
            "Return `product_id`, product `name` and the supplier's `country` for every product that has a supplier. Sort by `product_id`.",
          starter: "",
          solution:
            "SELECT p.product_id, p.name, s.country\nFROM products AS p\nJOIN suppliers AS s ON s.supplier_id = p.supplier_id\nORDER BY p.product_id;",
          hints: ["`products.supplier_id` points at `suppliers.supplier_id`."],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "A customer with 4 orders is joined to the orders table. How many rows does that customer produce?",
          options: ["1", "4", "5", "It depends on the join type only"],
          answer: 1,
          explain:
            "One row per match. A join multiplies rows whenever the right side has several matching rows.",
        },
      ],
    },

    {
      id: "m4-inner",
      title: "INNER JOIN",
      goal: "Match rows across tables with ON, and filter the combined result.",
      keywords: ["inner join", "on", "using", "natural join", "alias"],
      exercises: [
        {
          id: "m4-inner-e1",
          prompt:
            "Return the product `name` and its supplier's `name` (aliased `supplier`) for products supplied from **Japan**. Sort by product name.",
          starter: "",
          solution:
            "SELECT p.name, s.name AS supplier\nFROM products AS p\nJOIN suppliers AS s ON s.supplier_id = p.supplier_id\nWHERE s.country = 'Japan'\nORDER BY p.name;",
          hints: [
            "Join first, then filter on the supplier's country in WHERE.",
            "Both tables have a `name` column — alias one of them.",
          ],
          orderMatters: true,
        },
        {
          id: "m4-inner-e2",
          prompt:
            "Return `order_id`, `quantity` and the product `name` for the line items of order **1042**, sorted by `item_no`.",
          starter: "",
          solution:
            "SELECT i.order_id, i.quantity, p.name\nFROM order_items AS i\nJOIN products AS p ON p.product_id = i.product_id\nWHERE i.order_id = 1042\nORDER BY i.item_no;",
          hints: ["`order_items.product_id = products.product_id`."],
          orderMatters: true,
        },
        {
          id: "m4-inner-e3",
          prompt:
            "Return `name` (product) and `category` (the category's name) for every product in a category whose name contains **Guitar**. Sort by product name.",
          starter: "",
          solution:
            "SELECT p.name, c.name AS category\nFROM products AS p\nJOIN categories AS c ON c.category_id = p.category_id\nWHERE c.name LIKE '%Guitar%'\nORDER BY p.name;",
          hints: ["Join products to categories, then apply the LIKE to the category name."],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "What does `FROM a JOIN b` without an ON clause produce in SQLite?",
          options: [
            "A syntax error",
            "A cross join — every row of a paired with every row of b",
            "An inner join on all identically named columns",
            "Only matching rows, guessed from the foreign keys",
          ],
          answer: 1,
          explain:
            "SQLite allows a missing ON and gives you the cartesian product. The query runs; the answer is nonsense.",
        },
      ],
    },

    {
      id: "m4-left",
      title: "LEFT JOIN and anti-joins",
      goal: "Keep unmatched rows, find missing data, and avoid destroying an outer join with WHERE.",
      keywords: ["left join", "outer join", "anti join", "is null", "missing rows"],
      exercises: [
        {
          id: "m4-left-e1",
          prompt:
            "Which customers have **never placed an order**? Return `customer_id`, `first_name` and `last_name`, sorted by `customer_id`.",
          starter:
            "SELECT c.customer_id, c.first_name, c.last_name\nFROM customers AS c\nLEFT JOIN orders AS o ON o.customer_id = c.customer_id;",
          solution:
            "SELECT c.customer_id, c.first_name, c.last_name\nFROM customers AS c\nLEFT JOIN orders AS o ON o.customer_id = c.customer_id\nWHERE o.order_id IS NULL\nORDER BY c.customer_id;",
          hints: [
            "After a LEFT JOIN, unmatched rows have NULL in every right-hand column.",
            "`WHERE o.order_id IS NULL` keeps exactly those.",
          ],
          orderMatters: true,
        },
        {
          id: "m4-left-e2",
          prompt:
            "Which products have **never been sold**? Return `product_id` and `name`, sorted by `product_id`. Use a LEFT JOIN against `order_items`.",
          starter: "",
          solution:
            "SELECT p.product_id, p.name\nFROM products AS p\nLEFT JOIN order_items AS i ON i.product_id = p.product_id\nWHERE i.product_id IS NULL\nORDER BY p.product_id;",
          hints: ["Same anti-join shape as the previous exercise."],
          orderMatters: true,
        },
        {
          id: "m4-left-e3",
          prompt:
            "Count **completed** orders per customer while keeping customers who have none. Return `customer_id` and `completed_orders` for the 10 customers with the fewest (ties broken by `customer_id`). The status filter must not remove customers from the result.",
          starter:
            "SELECT c.customer_id, COUNT(o.order_id) AS completed_orders\nFROM customers AS c\nLEFT JOIN orders AS o ON o.customer_id = c.customer_id\nWHERE o.status = 'completed'\nGROUP BY c.customer_id\nORDER BY completed_orders, c.customer_id\nLIMIT 10;",
          solution:
            "SELECT c.customer_id, COUNT(o.order_id) AS completed_orders\nFROM customers AS c\nLEFT JOIN orders AS o\n       ON o.customer_id = c.customer_id\n      AND o.status = 'completed'\nGROUP BY c.customer_id\nORDER BY completed_orders, c.customer_id\nLIMIT 10;",
          hints: [
            "A condition on the optional table belongs in `ON`, not `WHERE`.",
            "`COUNT(o.order_id)` gives 0 for customers with no matching orders.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Why does moving `o.status = 'completed'` from ON to WHERE break a LEFT JOIN?",
          options: [
            "WHERE cannot reference joined tables",
            "The NULL rows invented by the LEFT JOIN fail the WHERE test and are dropped",
            "It does not — the two are identical",
            "Because status is indexed",
          ],
          answer: 1,
          explain:
            "NULL = 'completed' is unknown, so the unmatched rows disappear and the LEFT JOIN quietly becomes an INNER JOIN.",
        },
      ],
    },

    {
      id: "m4-multi",
      title: "Joining several tables",
      goal: "Chain three or more joins and stay in control of the grain.",
      keywords: ["multi table join", "chain", "grain", "order items"],
      exercises: [
        {
          id: "m4-multi-e1",
          prompt:
            "For order **1042**, return `order_id`, the customer's `last_name` (as `customer`), the product `name` (as `product`) and `quantity` — one row per line item, sorted by `item_no`.",
          starter: "",
          solution:
            "SELECT o.order_id, c.last_name AS customer, p.name AS product, i.quantity\nFROM orders AS o\nJOIN customers AS c ON c.customer_id = o.customer_id\nJOIN order_items AS i ON i.order_id = o.order_id\nJOIN products AS p ON p.product_id = i.product_id\nWHERE o.order_id = 1042\nORDER BY i.item_no;",
          hints: [
            "Three joins: orders → customers, orders → order_items, order_items → products.",
            "The grain of the result is one line item.",
          ],
          orderMatters: true,
        },
        {
          id: "m4-multi-e2",
          prompt:
            "Return `product` (name), `category` (category name) and `supplier` (supplier name) for every product, **including products with no supplier**. Sort by `product_id`.",
          starter: "",
          solution:
            "SELECT p.name AS product, c.name AS category, s.name AS supplier\nFROM products AS p\nJOIN categories AS c ON c.category_id = p.category_id\nLEFT JOIN suppliers AS s ON s.supplier_id = p.supplier_id\nORDER BY p.product_id;",
          hints: [
            "Every product has a category (inner join is fine), but the supplier is optional.",
            "Mix JOIN and LEFT JOIN in the same query.",
          ],
          orderMatters: true,
        },
        {
          id: "m4-multi-e3",
          prompt:
            "Which sales reps handled orders from **Germany**? Return distinct `employee_id`, `last_name` and the count of such orders as `german_orders`, sorted by `german_orders` descending then `employee_id`.",
          starter: "",
          solution:
            "SELECT e.employee_id, e.last_name, COUNT(*) AS german_orders\nFROM orders AS o\nJOIN employees AS e ON e.employee_id = o.employee_id\nJOIN customers AS c ON c.customer_id = o.customer_id\nWHERE c.country = 'Germany'\nGROUP BY e.employee_id, e.last_name\nORDER BY german_orders DESC, e.employee_id;",
          hints: [
            "Join orders to employees and to customers, filter on the customer's country.",
            "Group by the employee.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m4-self",
      title: "Self joins",
      goal: "Relate rows to other rows in the same table — managers, referrals, pairs.",
      keywords: ["self join", "manager", "hierarchy", "pairs", "referral"],
      exercises: [
        {
          id: "m4-self-e1",
          prompt:
            "Return `employee` (first + space + last name) and `manager` (their manager's first + space + last name) for **every** employee, including the one with no manager. Sort by `employee_id`.",
          starter:
            "SELECT\n  e.first_name || ' ' || e.last_name AS employee,\n  NULL AS manager\nFROM employees AS e\nORDER BY e.employee_id;",
          solution:
            "SELECT\n  e.first_name || ' ' || e.last_name AS employee,\n  m.first_name || ' ' || m.last_name AS manager\nFROM employees AS e\nLEFT JOIN employees AS m ON m.employee_id = e.manager_id\nORDER BY e.employee_id;",
          hints: [
            "Join `employees` to itself with two aliases, e and m.",
            "LEFT JOIN so the CEO (manager_id IS NULL) survives.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m4-self-e2",
          prompt:
            "Which customers were referred by someone? Return `customer_id`, `last_name` and `referrer` (the referring customer's last name), sorted by `customer_id`.",
          starter: "",
          solution:
            "SELECT c.customer_id, c.last_name, r.last_name AS referrer\nFROM customers AS c\nJOIN customers AS r ON r.customer_id = c.referred_by\nORDER BY c.customer_id;",
          hints: [
            "`customers.referred_by` points back at `customers.customer_id`.",
            "An inner join already excludes customers with no referrer.",
          ],
          orderMatters: true,
        },
        {
          id: "m4-self-e3",
          prompt:
            "List pairs of employees who share a manager. Return `manager_id`, `employee_a` and `employee_b` (last names), listing each pair **once** (the employee with the smaller id first). Sort by `manager_id`, `employee_a`, `employee_b`.",
          starter: "",
          solution:
            "SELECT a.manager_id, a.last_name AS employee_a, b.last_name AS employee_b\nFROM employees AS a\nJOIN employees AS b\n  ON b.manager_id = a.manager_id\n AND b.employee_id > a.employee_id\nORDER BY a.manager_id, employee_a, employee_b;",
          hints: [
            "Join on the shared manager_id.",
            "`b.employee_id > a.employee_id` removes self-pairs and mirror duplicates.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "In a self join `FROM employees e JOIN employees m ON m.employee_id = e.manager_id`, what does one result row represent?",
          options: [
            "One employee",
            "One employee together with their manager",
            "One manager together with all their reports",
            "Every possible employee pair",
          ],
          answer: 1,
          explain: "Each row pairs a child row with its parent row from the same table.",
        },
      ],
    },

    {
      id: "m4-cross",
      title: "CROSS JOIN and cartesian products",
      goal: "Use a deliberate cross join to build grids — and recognise an accidental one.",
      keywords: ["cross join", "cartesian product", "grid", "combinations"],
      exercises: [
        {
          id: "m4-cross-e1",
          prompt:
            "How many supplier/category combinations exist in total? Return a single column `pairs` using a CROSS JOIN of `suppliers` and `categories`.",
          starter: "",
          solution: "SELECT COUNT(*) AS pairs FROM suppliers CROSS JOIN categories;",
          hints: ["No ON clause — that is the point.", "12 suppliers × 20 categories."],
          checkColumnNames: true,
          requires: [{ re: "CROSS\\s+JOIN", msg: "Write it with an explicit CROSS JOIN." }],
        },
        {
          id: "m4-cross-e2",
          prompt:
            "Build a complete status grid for 2025: every combination of `month` (`2025-01` … `2025-06`) and `status` in ('completed', 'cancelled'), with `orders` counted (0 where there were none). Sort by month, then status.\n\nStart from the months that exist in the data and cross join the two statuses.",
          starter: "",
          solution:
            "SELECT m.month, s.status, COUNT(o.order_id) AS orders\nFROM (SELECT DISTINCT substr(order_date, 1, 7) AS month FROM orders WHERE order_date >= '2025-01-01') AS m\nCROSS JOIN (SELECT 'completed' AS status UNION ALL SELECT 'cancelled') AS s\nLEFT JOIN orders AS o\n       ON substr(o.order_date, 1, 7) = m.month\n      AND o.status = s.status\nGROUP BY m.month, s.status\nORDER BY m.month, s.status;",
          hints: [
            "Get the month list with a subquery of DISTINCT substr(order_date, 1, 7).",
            "Make the two statuses with `SELECT 'completed' AS status UNION ALL SELECT 'cancelled'`.",
            "LEFT JOIN the orders onto that grid so empty cells count 0.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Your join of a 1,000-row table and a 50-row table returns exactly 50,000 rows. What is the most likely cause?",
          options: [
            "Perfectly matched keys",
            "A missing or always-true join condition — an accidental cross join",
            "A LEFT JOIN",
            "Duplicate primary keys",
          ],
          answer: 1,
          explain:
            "1,000 × 50 is the cartesian product. A suspiciously round multiple of the table sizes is the classic symptom.",
        },
      ],
    },

    {
      id: "m4-agg",
      title: "Aggregating across joins",
      goal: "Group joined data correctly, and recognise double counting caused by fan-out.",
      keywords: ["fan-out", "double counting", "group by join", "count distinct", "grain"],
      exercises: [
        {
          id: "m4-agg-e1",
          prompt:
            "Revenue by product name: return `product`, `units_sold` and `revenue` (2 dp) for the top 10 products by revenue, tie-broken by `product`.",
          starter: "",
          solution:
            "SELECT\n  p.name AS product,\n  SUM(i.quantity) AS units_sold,\n  ROUND(SUM(i.quantity * i.unit_price * (1 - i.discount)), 2) AS revenue\nFROM order_items AS i\nJOIN products AS p ON p.product_id = i.product_id\nGROUP BY p.product_id, p.name\nORDER BY revenue DESC, product\nLIMIT 10;",
          hints: ["Group by the product id and name, aggregate the line items."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m4-agg-e2",
          prompt:
            "Per category, return `category`, `orders` (the number of **distinct** orders containing a product from it) and `revenue` (2 dp), for completed orders only. Sort by revenue descending, then category.",
          starter: "",
          solution:
            "SELECT\n  c.name AS category,\n  COUNT(DISTINCT o.order_id) AS orders,\n  ROUND(SUM(i.quantity * i.unit_price * (1 - i.discount)), 2) AS revenue\nFROM order_items AS i\nJOIN orders AS o ON o.order_id = i.order_id\nJOIN products AS p ON p.product_id = i.product_id\nJOIN categories AS c ON c.category_id = p.category_id\nWHERE o.status = 'completed'\nGROUP BY c.category_id, c.name\nORDER BY revenue DESC, category;",
          hints: [
            "Four tables: order_items → orders, order_items → products → categories.",
            "The join repeats an order per line item — use COUNT(DISTINCT o.order_id).",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m4-agg-e3",
          prompt:
            "**Spot the double count.** Return one row with `shipping_correct` — the true total of `orders.shipping_cost` (2 dp) — for orders that have at least one line item. Joining to `order_items` inflates it, so find a way that does not.",
          starter:
            "SELECT ROUND(SUM(o.shipping_cost), 2) AS shipping_correct\nFROM orders AS o\nJOIN order_items AS i ON i.order_id = o.order_id;",
          solution:
            "SELECT ROUND(SUM(shipping_cost), 2) AS shipping_correct\nFROM orders\nWHERE order_id IN (SELECT order_id FROM order_items);",
          hints: [
            "The join multiplies each order by its number of line items.",
            "Filter with `WHERE order_id IN (SELECT order_id FROM order_items)` instead of joining.",
            "Aggregating a DISTINCT list of orders is the general fix.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "After `orders JOIN order_items`, `SUM(o.shipping_cost)` is too high. Why?",
          options: [
            "Shipping cost is stored per item",
            "The join repeats each order once per line item, so its shipping cost is added several times",
            "SUM cannot be used after a join",
            "Because of NULL discounts",
          ],
          answer: 1,
          explain:
            "That is fan-out. Aggregate each table at its own grain (a CTE or subquery), or use DISTINCT-safe techniques.",
        },
      ],
    },

    {
      id: "m4-sets",
      title: "UNION, INTERSECT, EXCEPT",
      goal: "Stack result sets vertically and compare them.",
      keywords: ["union", "union all", "intersect", "except", "set operators"],
      exercises: [
        {
          id: "m4-sets-e1",
          prompt:
            "Build one contact list: `kind` (`customer` or `employee`), `first_name`, `last_name` from both tables, sorted by `kind`, `last_name`, `first_name`. Keep every row (no de-duplication).",
          starter: "",
          solution:
            "SELECT 'customer' AS kind, first_name, last_name FROM customers\nUNION ALL\nSELECT 'employee', first_name, last_name FROM employees\nORDER BY kind, last_name, first_name;",
          hints: [
            "Both SELECTs need the same number of columns.",
            "Only the first SELECT's column names matter; ORDER BY goes at the very end.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "UNION\\s+ALL", msg: "Use UNION ALL — duplicates should be kept." }],
        },
        {
          id: "m4-sets-e2",
          prompt:
            "Which products have been **sold but never reviewed**? Return `product_id`, sorted ascending, using `EXCEPT`.",
          starter: "",
          solution:
            "SELECT product_id FROM order_items\nEXCEPT\nSELECT product_id FROM reviews\nORDER BY product_id;",
          hints: ["EXCEPT keeps rows from the first query that are absent from the second."],
          orderMatters: true,
          requires: [{ re: "\\bEXCEPT\\b", msg: "This exercise asks for EXCEPT." }],
        },
        {
          id: "m4-sets-e3",
          prompt:
            "Which products appear in **both** `order_items` and `reviews`? Return `product_id` sorted ascending, using `INTERSECT`.",
          starter: "",
          solution:
            "SELECT product_id FROM order_items\nINTERSECT\nSELECT product_id FROM reviews\nORDER BY product_id;",
          hints: ["INTERSECT keeps rows present in both result sets (duplicates removed)."],
          orderMatters: true,
          requires: [{ re: "\\bINTERSECT\\b", msg: "This exercise asks for INTERSECT." }],
        },
      ],
      quiz: [
        {
          q: "When should you prefer UNION ALL over UNION?",
          options: [
            "Never — UNION is always safer",
            "Whenever duplicates are impossible or wanted; it skips the de-duplication work",
            "Only with exactly two queries",
            "When the two queries have different column counts",
          ],
          answer: 1,
          explain:
            "UNION must sort or hash every row to remove duplicates. If you know there are none, UNION ALL is free.",
        },
      ],
    },

    {
      id: "m4-checkpoint",
      title: "Checkpoint: multi-table questions",
      goal: "Answer questions that need three or four tables and careful grain control.",
      keywords: ["practice", "checkpoint", "joins"],
      exercises: [
        {
          id: "m4-cp-e1",
          prompt:
            "**Customer value.** Return `customer_id`, `last_name` and `revenue` (2 dp, from completed orders only) for the top 10 customers by revenue, tie-broken by `customer_id`.",
          starter: "",
          solution:
            "SELECT c.customer_id, c.last_name,\n  ROUND(SUM(i.quantity * i.unit_price * (1 - i.discount)), 2) AS revenue\nFROM customers AS c\nJOIN orders AS o ON o.customer_id = c.customer_id AND o.status = 'completed'\nJOIN order_items AS i ON i.order_id = o.order_id\nGROUP BY c.customer_id, c.last_name\nORDER BY revenue DESC, c.customer_id\nLIMIT 10;",
          hints: [
            "customers → orders → order_items.",
            "The status filter can live in the ON clause or in WHERE — with inner joins both work.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m4-cp-e2",
          prompt:
            "**Quiet categories.** Return `category` and `products` (how many products it holds) for categories whose products have **never** been sold, sorted by category name. Include categories with no products at all.",
          starter: "",
          solution:
            "SELECT c.name AS category, COUNT(p.product_id) AS products\nFROM categories AS c\nLEFT JOIN products AS p ON p.category_id = c.category_id\nWHERE NOT EXISTS (\n  SELECT 1\n  FROM products AS p2\n  JOIN order_items AS i ON i.product_id = p2.product_id\n  WHERE p2.category_id = c.category_id\n)\nGROUP BY c.category_id, c.name\nORDER BY category;",
          hints: [
            "Start from categories and LEFT JOIN products so empty categories survive.",
            "A category qualifies when no product of that category appears in order_items.",
            "`NOT EXISTS (…)` is the cleanest test — Module 5 covers it in depth.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m4-cp-e3",
          prompt:
            "**Rep scoreboard.** For every sales employee (department `Sales`), return `employee_id`, `last_name`, `orders` (orders they handled, 0 if none) and `revenue` (2 dp, 0 if none). Sort by `revenue` descending, then `employee_id`.",
          starter: "",
          solution:
            "SELECT\n  e.employee_id,\n  e.last_name,\n  COUNT(DISTINCT o.order_id) AS orders,\n  ROUND(COALESCE(SUM(i.quantity * i.unit_price * (1 - i.discount)), 0), 2) AS revenue\nFROM employees AS e\nLEFT JOIN orders AS o ON o.employee_id = e.employee_id\nLEFT JOIN order_items AS i ON i.order_id = o.order_id\nWHERE e.department = 'Sales'\nGROUP BY e.employee_id, e.last_name\nORDER BY revenue DESC, e.employee_id;",
          hints: [
            "Two LEFT JOINs keep reps with no orders.",
            "`COUNT(DISTINCT o.order_id)` avoids counting an order once per line item.",
            "Wrap the SUM in COALESCE so 'no sales' shows as 0.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },
  ],
};
