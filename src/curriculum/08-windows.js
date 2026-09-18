/* Module 8 — Window Functions ------------------------------------------ */

export default {
  id: "windows",
  number: 8,
  title: "Window Functions",
  level: "Advanced",
  summary:
    "Compute across rows without collapsing them: partitions, rankings, LAG/LEAD, running totals, frames, percentiles and top-N per group.",
  lessons: [
    {
      id: "m8-intro",
      title: "OVER(): aggregates that keep the rows",
      goal: "Turn an aggregate into a window function and understand when it runs.",
      keywords: ["window function", "over", "analytic", "aggregate"],
      exercises: [
        {
          id: "m8-intro-e1",
          prompt:
            "Return `name`, `unit_price`, `avg_price` (the catalogue average, 2 dp, on every row) and `diff_from_avg` (2 dp) for the 10 products furthest above the average. Sort by `diff_from_avg` descending. Use a window function, not a subquery.",
          starter: "SELECT name, unit_price\nFROM products;",
          solution:
            "SELECT\n  name,\n  unit_price,\n  ROUND(AVG(unit_price) OVER (), 2) AS avg_price,\n  ROUND(unit_price - AVG(unit_price) OVER (), 2) AS diff_from_avg\nFROM products\nORDER BY diff_from_avg DESC\nLIMIT 10;",
          hints: ["`AVG(unit_price) OVER ()` puts the overall average on every row."],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "OVER\\s*\\(", msg: "Use a window function (OVER) for this one." }],
        },
      ],
      quiz: [
        {
          q: "What is the difference between `AVG(x)` and `AVG(x) OVER ()`?",
          options: [
            "None",
            "The first collapses the rows into one; the second adds the average to every row",
            "The second only works with ORDER BY",
            "The second is slower but identical in output",
          ],
          answer: 1,
          explain: "A window function computes across rows without grouping them away.",
        },
      ],
    },

    {
      id: "m8-partition",
      title: "PARTITION BY",
      goal: "Restart a window calculation per group, and compute shares of a total.",
      keywords: ["partition by", "group average", "share of total", "percentage"],
      exercises: [
        {
          id: "m8-part-e1",
          prompt:
            "For every product return `category_id`, `name`, `unit_price`, `category_avg` (2 dp) and `vs_category` (price minus category average, 2 dp). Sort by `category_id`, then `unit_price` descending, then `product_id`.",
          starter: "",
          solution:
            "SELECT\n  category_id,\n  name,\n  unit_price,\n  ROUND(AVG(unit_price) OVER (PARTITION BY category_id), 2) AS category_avg,\n  ROUND(unit_price - AVG(unit_price) OVER (PARTITION BY category_id), 2) AS vs_category\nFROM products\nORDER BY category_id, unit_price DESC, product_id;",
          hints: ["`AVG(unit_price) OVER (PARTITION BY category_id)`"],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "PARTITION\\s+BY", msg: "Use PARTITION BY." }],
        },
        {
          id: "m8-part-e2",
          prompt:
            "Return `customer_id`, `order_id`, `order_date` and `orders_by_this_customer` (how many orders that customer has, on every row) for the first 20 rows sorted by `customer_id` then `order_id`.",
          starter: "",
          solution:
            "SELECT\n  customer_id,\n  order_id,\n  order_date,\n  COUNT(*) OVER (PARTITION BY customer_id) AS orders_by_this_customer\nFROM orders\nORDER BY customer_id, order_id\nLIMIT 20;",
          hints: ["`COUNT(*) OVER (PARTITION BY customer_id)`"],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-part-e3",
          prompt:
            "Per category, what share of revenue does each product hold? Using a CTE of product revenue, return `category_id`, `name`, `revenue` (2 dp) and `pct_of_category` (1 dp) for the top 15 rows sorted by revenue descending, tie-broken by name.",
          starter: "",
          solution:
            "WITH product_revenue AS (\n  SELECT p.category_id, p.name,\n         SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue\n  FROM order_items AS i\n  JOIN products AS p ON p.product_id = i.product_id\n  GROUP BY p.category_id, p.name\n)\nSELECT\n  category_id,\n  name,\n  ROUND(revenue, 2) AS revenue,\n  ROUND(100.0 * revenue / SUM(revenue) OVER (PARTITION BY category_id), 1) AS pct_of_category\nFROM product_revenue\nORDER BY revenue DESC, name\nLIMIT 15;",
          hints: [
            "Aggregate in a CTE, then window over the aggregated rows.",
            "The denominator is `SUM(revenue) OVER (PARTITION BY category_id)`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m8-rank",
      title: "ROW_NUMBER, RANK, DENSE_RANK",
      goal: "Rank rows, handle ties deliberately, and solve top-N-per-group.",
      keywords: ["row_number", "rank", "dense_rank", "top n per group", "ties"],
      exercises: [
        {
          id: "m8-rank-e1",
          prompt:
            "Return `name`, `unit_price`, `row_number`, `rank` and `dense_rank` for the 12 most expensive products, all ordered by `unit_price` descending.",
          starter: "",
          solution:
            "SELECT\n  name,\n  unit_price,\n  ROW_NUMBER() OVER (ORDER BY unit_price DESC) AS row_number,\n  RANK() OVER (ORDER BY unit_price DESC) AS rank,\n  DENSE_RANK() OVER (ORDER BY unit_price DESC) AS dense_rank\nFROM products\nORDER BY unit_price DESC\nLIMIT 12;",
          hints: ["All three take an ORDER BY inside OVER."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-rank-e2",
          prompt:
            "**Top-2 per category.** Return `category_id`, `name` and `unit_price` for the two most expensive products in each category (tie-break by `product_id`), sorted by `category_id` then price descending.",
          starter:
            "WITH ranked AS (\n  SELECT category_id, name, unit_price,\n         -- add a ROW_NUMBER here\n  FROM products\n)\nSELECT * FROM ranked;",
          solution:
            "WITH ranked AS (\n  SELECT\n    category_id,\n    name,\n    unit_price,\n    ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY unit_price DESC, product_id) AS rn\n  FROM products\n)\nSELECT category_id, name, unit_price\nFROM ranked\nWHERE rn <= 2\nORDER BY category_id, unit_price DESC;",
          hints: [
            "Rank inside the CTE, filter in the outer query — window functions cannot be used in WHERE.",
            "PARTITION BY category_id, ORDER BY unit_price DESC.",
          ],
          orderMatters: true,
          requires: [{ re: "ROW_NUMBER|RANK", msg: "Use a ranking window function." }],
        },
        {
          id: "m8-rank-e3",
          prompt:
            "**Best customer per country.** Using orders only, return `country`, `customer_id` and `orders` for the customer with the most orders in each country (tie-break by `customer_id`), sorted by `country`. Ignore customers with no country.",
          starter: "",
          solution:
            "WITH per_customer AS (\n  SELECT c.country, c.customer_id, COUNT(*) AS orders\n  FROM orders AS o\n  JOIN customers AS c ON c.customer_id = o.customer_id\n  WHERE c.country IS NOT NULL\n  GROUP BY c.country, c.customer_id\n),\nranked AS (\n  SELECT country, customer_id, orders,\n         ROW_NUMBER() OVER (PARTITION BY country ORDER BY orders DESC, customer_id) AS rn\n  FROM per_customer\n)\nSELECT country, customer_id, orders\nFROM ranked\nWHERE rn = 1\nORDER BY country;",
          hints: [
            "First CTE: orders per customer per country. Second: rank within the country.",
            "Keep only `rn = 1`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Prices 100, 100, 90. What does RANK() give, ordered descending?",
          options: ["1, 2, 3", "1, 1, 2", "1, 1, 3", "1, 2, 2"],
          answer: 2,
          explain: "RANK shares the rank for ties and then skips; DENSE_RANK would give 1, 1, 2.",
        },
      ],
    },

    {
      id: "m8-lag-lead",
      title: "LAG and LEAD",
      goal: "Compare a row with the previous or next one — period-over-period analysis.",
      keywords: ["lag", "lead", "previous", "change", "growth", "gap"],
      exercises: [
        {
          id: "m8-lag-e1",
          prompt:
            "Monthly order counts with the previous month alongside: return `month`, `orders`, `prev_month` and `change` (orders minus previous), sorted by month. Cover all months in the data.",
          starter: "",
          solution:
            "WITH monthly AS (\n  SELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders\n  FROM orders\n  GROUP BY month\n)\nSELECT\n  month,\n  orders,\n  LAG(orders) OVER (ORDER BY month) AS prev_month,\n  orders - LAG(orders) OVER (ORDER BY month) AS change\nFROM monthly\nORDER BY month;",
          hints: [
            "Aggregate per month in a CTE, then LAG over it.",
            "The first row's `prev_month` is NULL — that is correct.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "\\bLAG\\s*\\(", msg: "Use LAG()." }],
        },
        {
          id: "m8-lag-e2",
          prompt:
            "Per customer, how long between orders? Return `customer_id`, `order_id`, `order_date` and `days_since_prev` (whole days, NULL for a customer's first order) for the first 20 rows sorted by `customer_id`, `order_date`, `order_id`.",
          starter: "",
          solution:
            "SELECT\n  customer_id,\n  order_id,\n  order_date,\n  CAST(julianday(order_date)\n       - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id))\n       AS INTEGER) AS days_since_prev\nFROM orders\nORDER BY customer_id, order_date, order_id\nLIMIT 20;",
          hints: [
            "Partition by customer so the lag does not cross customers.",
            "Subtract julianday values and CAST to INTEGER.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-lag-e3",
          prompt:
            "Month-over-month growth: return `month`, `shipping` (2 dp) and `pct_change` (1 dp, NULL for the first month) from total shipping cost per month, sorted by month.",
          starter: "",
          solution:
            "WITH monthly AS (\n  SELECT substr(order_date, 1, 7) AS month, SUM(shipping_cost) AS shipping\n  FROM orders\n  GROUP BY month\n)\nSELECT\n  month,\n  ROUND(shipping, 2) AS shipping,\n  ROUND(100.0 * (shipping - LAG(shipping) OVER (ORDER BY month))\n        / NULLIF(LAG(shipping) OVER (ORDER BY month), 0), 1) AS pct_change\nFROM monthly\nORDER BY month;",
          hints: [
            "(current - previous) / previous * 100.",
            "Guard the denominator with NULLIF(…, 0).",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m8-frames",
      title: "Running totals and frames",
      goal: "Control exactly which neighbouring rows an aggregate sees.",
      keywords: ["running total", "frame", "rows between", "range", "cumulative"],
      exercises: [
        {
          id: "m8-frames-e1",
          prompt:
            "Return `month`, `orders` and `cumulative` (running total of orders from the first month to this one), sorted by month.",
          starter: "",
          solution:
            "WITH monthly AS (\n  SELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders\n  FROM orders\n  GROUP BY month\n)\nSELECT\n  month,\n  orders,\n  SUM(orders) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative\nFROM monthly\nORDER BY month;",
          hints: [
            "`SUM(x) OVER (ORDER BY month)` is already cumulative; spelling the frame out makes it explicit.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-frames-e2",
          prompt:
            "Return `month`, `orders`, `cumulative` and `remaining` (orders in this month and all later months), sorted by month.",
          starter: "",
          solution:
            "WITH monthly AS (\n  SELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders\n  FROM orders\n  GROUP BY month\n)\nSELECT\n  month,\n  orders,\n  SUM(orders) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative,\n  SUM(orders) OVER (ORDER BY month ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) AS remaining\nFROM monthly\nORDER BY month;",
          hints: ["The second frame runs from the current row to the end of the partition."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-frames-e3",
          prompt:
            "Running revenue per customer: return `customer_id`, `order_id`, `order_date`, `order_revenue` (2 dp) and `running_revenue` (2 dp, accumulating per customer by date then order id) — first 25 rows sorted by `customer_id`, `order_date`, `order_id`.",
          starter: "",
          solution:
            "WITH order_revenue AS (\n  SELECT o.customer_id, o.order_id, o.order_date,\n         SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue\n  FROM orders AS o\n  JOIN order_items AS i ON i.order_id = o.order_id\n  GROUP BY o.customer_id, o.order_id, o.order_date\n)\nSELECT\n  customer_id,\n  order_id,\n  order_date,\n  ROUND(revenue, 2) AS order_revenue,\n  ROUND(SUM(revenue) OVER (PARTITION BY customer_id ORDER BY order_date, order_id\n        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2) AS running_revenue\nFROM order_revenue\nORDER BY customer_id, order_date, order_id\nLIMIT 25;",
          hints: [
            "Compute revenue per order in a CTE first.",
            "Then PARTITION BY customer_id ORDER BY order_date, order_id.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "What is the default frame when you write `SUM(x) OVER (ORDER BY d)`?",
          options: [
            "The whole partition",
            "RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW (a running total, ties included)",
            "ROWS BETWEEN 1 PRECEDING AND CURRENT ROW",
            "Only the current row",
          ],
          answer: 1,
          explain:
            "Adding ORDER BY makes the aggregate cumulative, and the default RANGE frame includes all rows tied with the current one.",
        },
      ],
    },

    {
      id: "m8-moving",
      title: "Moving averages",
      goal: "Smooth a time series — and know what a missing day does to your window.",
      keywords: ["moving average", "rolling", "smoothing", "time series"],
      exercises: [
        {
          id: "m8-moving-e1",
          prompt:
            "For daily order counts from 2025-01-01 onwards, return `order_date`, `orders` and `avg_7d` (average over the current and 6 preceding rows, 2 dp) for the first 25 days, sorted by date.",
          starter: "",
          solution:
            "WITH daily AS (\n  SELECT order_date, COUNT(*) AS orders\n  FROM orders\n  WHERE order_date >= '2025-01-01'\n  GROUP BY order_date\n)\nSELECT\n  order_date,\n  orders,\n  ROUND(AVG(orders) OVER (ORDER BY order_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS avg_7d\nFROM daily\nORDER BY order_date\nLIMIT 25;",
          hints: ["`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` covers seven rows including this one."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-moving-e2",
          prompt:
            "Same daily series from 2025-03-01, but a **centred** average: `order_date`, `orders`, `centred_7` (3 preceding through 3 following, 2 dp), first 15 rows by date.",
          starter: "",
          solution:
            "WITH daily AS (\n  SELECT order_date, COUNT(*) AS orders\n  FROM orders\n  WHERE order_date >= '2025-03-01'\n  GROUP BY order_date\n)\nSELECT\n  order_date,\n  orders,\n  ROUND(AVG(orders) OVER (ORDER BY order_date ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING), 2) AS centred_7\nFROM daily\nORDER BY order_date\nLIMIT 15;",
          hints: ["Frames can extend forwards as well as backwards."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Your 7-row moving average over daily data looks wrong around a holiday. Why?",
          options: [
            "ROWS counts rows, not days — days with no data are simply absent",
            "AVG cannot be used in a window",
            "The frame must be RANGE",
            "SQLite limits frames to 5 rows",
          ],
          answer: 0,
          explain:
            "Build a complete date spine (Module 9) and left-join the data, so every day is a row — even the empty ones.",
        },
      ],
    },

    {
      id: "m8-ntile",
      title: "NTILE, PERCENT_RANK, CUME_DIST",
      goal: "Split rows into buckets and locate a row within a distribution.",
      keywords: ["ntile", "percentile", "quartile", "percent_rank", "cume_dist", "distribution"],
      exercises: [
        {
          id: "m8-ntile-e1",
          prompt:
            "Describe the price quartiles: return `quartile` (1–4), `products`, `from_price` and `to_price`, sorted by quartile.",
          starter: "",
          solution:
            "WITH q AS (\n  SELECT unit_price, NTILE(4) OVER (ORDER BY unit_price) AS quartile\n  FROM products\n)\nSELECT quartile, COUNT(*) AS products, MIN(unit_price) AS from_price, MAX(unit_price) AS to_price\nFROM q\nGROUP BY quartile\nORDER BY quartile;",
          hints: ["NTILE in a CTE, then GROUP BY the bucket."],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "NTILE", msg: "Use NTILE()." }],
        },
        {
          id: "m8-ntile-e2",
          prompt:
            "Who are the top 10% of customers by order count? Return `customer_id`, `orders` and `pct_rank` (3 dp) for customers whose `PERCENT_RANK()` over order count is at least 0.9, sorted by orders descending then `customer_id`.",
          starter: "",
          solution:
            "WITH scored AS (\n  SELECT customer_id, COUNT(*) AS orders,\n         PERCENT_RANK() OVER (ORDER BY COUNT(*)) AS pr\n  FROM orders\n  GROUP BY customer_id\n)\nSELECT customer_id, orders, ROUND(pr, 3) AS pct_rank\nFROM scored\nWHERE pr >= 0.9\nORDER BY orders DESC, customer_id;",
          hints: [
            "A window function may be applied on top of an aggregate in the same SELECT.",
            "Filter on the window result in the outer query.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m8-firstlast",
      title: "FIRST_VALUE, LAST_VALUE and named windows",
      goal: "Pull a value from the best (or worst) row of a partition, and keep window definitions DRY.",
      keywords: ["first_value", "last_value", "nth_value", "window clause", "frame"],
      exercises: [
        {
          id: "m8-fv-e1",
          prompt:
            "For every product return `category_id`, `name`, `unit_price` and `priciest_in_category` (the name of the most expensive product in its category, tie-broken by `product_id`). Sort by `category_id`, `unit_price` descending, `product_id`.",
          starter: "",
          solution:
            "SELECT\n  category_id,\n  name,\n  unit_price,\n  FIRST_VALUE(name) OVER (PARTITION BY category_id ORDER BY unit_price DESC, product_id) AS priciest_in_category\nFROM products\nORDER BY category_id, unit_price DESC, product_id;",
          hints: ["FIRST_VALUE reads the first row of the ordered partition."],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "FIRST_VALUE", msg: "Use FIRST_VALUE()." }],
        },
        {
          id: "m8-fv-e2",
          prompt:
            "Same shape, but `cheapest_in_category` using `LAST_VALUE` — remember to widen the frame to the whole partition.",
          starter: "",
          solution:
            "SELECT\n  category_id,\n  name,\n  unit_price,\n  LAST_VALUE(name) OVER (\n    PARTITION BY category_id ORDER BY unit_price DESC, product_id\n    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\n  ) AS cheapest_in_category\nFROM products\nORDER BY category_id, unit_price DESC, product_id;",
          hints: [
            "With the default frame, LAST_VALUE returns the current row.",
            "`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` fixes it.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "LAST_VALUE", msg: "Use LAST_VALUE()." }],
        },
        {
          id: "m8-fv-e3",
          prompt:
            "Use a named `WINDOW` clause: return `name`, `unit_price`, `rn` (row number) and `rnk` (rank) for the 10 dearest products, both windows ordered by `unit_price` descending then `product_id`.",
          starter: "",
          solution:
            "SELECT\n  name,\n  unit_price,\n  ROW_NUMBER() OVER w AS rn,\n  RANK() OVER w AS rnk\nFROM products\nWINDOW w AS (ORDER BY unit_price DESC, product_id)\nORDER BY unit_price DESC, product_id\nLIMIT 10;",
          hints: [
            "`WINDOW w AS (…)` sits after FROM/WHERE and before ORDER BY.",
            "Then write `OVER w`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "\\bWINDOW\\s+\\w+\\s+AS", msg: "Define the window once with a WINDOW clause." }],
        },
      ],
    },

    {
      id: "m8-checkpoint",
      title: "Checkpoint: analytical queries",
      goal: "Combine windows with joins and CTEs the way real analyses do.",
      keywords: ["practice", "checkpoint", "analytics"],
      exercises: [
        {
          id: "m8-cp-e1",
          prompt:
            "**Category best sellers.** Return `category_id`, `best_seller` (product name), `revenue` (2 dp) and `pct_of_category` (1 dp) for the highest-revenue product in each category, sorted by revenue descending.",
          starter: "",
          solution:
            "WITH product_revenue AS (\n  SELECT p.category_id, p.product_id, p.name,\n         SUM(i.quantity * i.unit_price * (1 - i.discount)) AS revenue\n  FROM order_items AS i\n  JOIN products AS p ON p.product_id = i.product_id\n  GROUP BY p.category_id, p.product_id, p.name\n),\nranked AS (\n  SELECT category_id, name, revenue,\n         ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY revenue DESC, product_id) AS rn,\n         SUM(revenue) OVER (PARTITION BY category_id) AS category_revenue\n  FROM product_revenue\n)\nSELECT category_id, name AS best_seller, ROUND(revenue, 2) AS revenue,\n       ROUND(100.0 * revenue / category_revenue, 1) AS pct_of_category\nFROM ranked\nWHERE rn = 1\nORDER BY revenue DESC;",
          hints: [
            "Two CTEs: revenue per product, then rank plus category total.",
            "Keep rn = 1 in the outer query.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-cp-e2",
          prompt:
            "**Second order date.** For customers with at least two orders, return `customer_id`, `first_order`, `second_order` and `days_between` (whole days), sorted by `days_between` descending then `customer_id`, limit 15.",
          starter: "",
          solution:
            "WITH numbered AS (\n  SELECT customer_id, order_date,\n         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS rn\n  FROM orders\n)\nSELECT\n  f.customer_id,\n  f.order_date AS first_order,\n  s.order_date AS second_order,\n  CAST(julianday(s.order_date) - julianday(f.order_date) AS INTEGER) AS days_between\nFROM numbered AS f\nJOIN numbered AS s ON s.customer_id = f.customer_id AND s.rn = 2\nWHERE f.rn = 1\nORDER BY days_between DESC, f.customer_id\nLIMIT 15;",
          hints: [
            "Number each customer's orders, then join row 1 to row 2.",
            "`LAG`/`LEAD` would also work — pick whichever you find clearer.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m8-cp-e3",
          prompt:
            "**Revenue concentration.** Return `product_id`, `revenue` (2 dp), `running_pct` (1 dp — cumulative share of total revenue when products are ordered by revenue descending) for the top 15 products.",
          starter: "",
          solution:
            "WITH product_revenue AS (\n  SELECT product_id, SUM(quantity * unit_price * (1 - discount)) AS revenue\n  FROM order_items\n  GROUP BY product_id\n)\nSELECT\n  product_id,\n  ROUND(revenue, 2) AS revenue,\n  ROUND(100.0 * SUM(revenue) OVER (ORDER BY revenue DESC, product_id\n        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) / SUM(revenue) OVER (), 1) AS running_pct\nFROM product_revenue\nORDER BY revenue DESC, product_id\nLIMIT 15;",
          hints: [
            "Two windows: a cumulative sum ordered by revenue, and a grand total with `OVER ()`.",
            "This is the classic Pareto (80/20) report.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },
  ],
};
