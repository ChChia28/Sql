/* Module 3 — Aggregation ---------------------------------------------- */

export default {
  id: "aggregation",
  number: 3,
  title: "Aggregation & Grouping",
  level: "Beginner+",
  summary:
    "Turn many rows into answers: COUNT, SUM, AVG, GROUP BY, HAVING and the conditional-aggregation trick every analyst uses daily.",
  lessons: [
    {
      id: "m3-count",
      title: "COUNT: how many?",
      goal: "Know the difference between COUNT(*), COUNT(column) and COUNT(DISTINCT column).",
      keywords: ["count", "count distinct", "aggregate", "summary"],
      exercises: [
        {
          id: "m3-count-e1",
          prompt:
            "How many products have at least one unit in stock? Return a single column named `products_in_stock`.",
          starter: "",
          solution:
            "SELECT COUNT(*) AS products_in_stock FROM products WHERE units_in_stock > 0;",
          hints: ["Filter with WHERE, then count what survives."],
          checkColumnNames: true,
        },
        {
          id: "m3-count-e2",
          prompt:
            "In **one row**, return `total_orders` (all orders), `shipped_orders` (orders that have a ship date) and `statuses` (how many distinct status values exist).",
          starter: "SELECT\n  COUNT(*) AS total_orders\nFROM orders;",
          solution:
            "SELECT\n  COUNT(*) AS total_orders,\n  COUNT(ship_date) AS shipped_orders,\n  COUNT(DISTINCT status) AS statuses\nFROM orders;",
          hints: [
            "`COUNT(column)` skips NULLs — that is how you count shipped orders without a WHERE.",
            "`COUNT(DISTINCT status)` counts unique values.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "`COUNT(city)` on a table of 80 customers returns 76. What does that tell you?",
          options: [
            "Four customers share a city",
            "Four customers have no city recorded (NULL)",
            "Four rows are duplicates",
            "Nothing — COUNT(column) always equals COUNT(*)",
          ],
          answer: 1,
          explain: "COUNT(column) counts non-NULL values, so the gap is the number of NULLs.",
        },
      ],
    },

    {
      id: "m3-aggregates",
      title: "SUM, AVG, MIN, MAX",
      goal: "Summarise numbers, and understand how aggregates treat NULLs and empty sets.",
      keywords: ["sum", "avg", "min", "max", "total", "average", "revenue"],
      exercises: [
        {
          id: "m3-agg-e1",
          prompt:
            "Summarise the catalogue in one row: `avg_price` (average unit price rounded to 2 decimals), `cheapest` and `dearest`.",
          starter: "",
          solution:
            "SELECT\n  ROUND(AVG(unit_price), 2) AS avg_price,\n  MIN(unit_price) AS cheapest,\n  MAX(unit_price) AS dearest\nFROM products;",
          hints: ["Three aggregates in one SELECT list.", "`ROUND(value, 2)`"],
          checkColumnNames: true,
        },
        {
          id: "m3-agg-e2",
          prompt:
            "What has the shop sold in total? From `order_items`, return `units_sold` (sum of quantity) and `revenue` — the sum of `quantity * unit_price * (1 - discount)`, rounded to 2 decimals.",
          starter: "SELECT SUM(quantity) AS units_sold\nFROM order_items;",
          solution:
            "SELECT\n  SUM(quantity) AS units_sold,\n  ROUND(SUM(quantity * unit_price * (1 - discount)), 2) AS revenue\nFROM order_items;",
          hints: [
            "Aggregates accept expressions: `SUM(a * b)`.",
            "Multiply by `(1 - discount)` to apply the discount.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m3-agg-e3",
          prompt:
            "Return `rated_suppliers` (how many suppliers have a rating) and `avg_rating` (their average, rounded to 3 decimals) in one row.",
          starter: "",
          solution:
            "SELECT\n  COUNT(rating) AS rated_suppliers,\n  ROUND(AVG(rating), 3) AS avg_rating\nFROM suppliers;",
          hints: ["Both COUNT(rating) and AVG(rating) ignore the NULL ratings."],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "`SELECT SUM(quantity) FROM order_items WHERE product_id = -1;` returns…",
          options: ["0", "NULL", "an empty result with no rows", "an error"],
          answer: 1,
          explain:
            "One row comes back, holding NULL: there was nothing to add. COUNT would give 0. Use COALESCE(SUM(x), 0) when a report needs a zero.",
        },
      ],
    },

    {
      id: "m3-groupby",
      title: "GROUP BY",
      goal: "Compute one summary row per group, and respect the golden rule of grouping.",
      keywords: ["group by", "groups", "per category", "golden rule"],
      exercises: [
        {
          id: "m3-group-e1",
          prompt:
            "How many orders are in each status? Return `status` and `orders`, most common first, tie-broken by `status` A→Z.",
          starter: "SELECT status\nFROM orders;",
          solution:
            "SELECT status, COUNT(*) AS orders\nFROM orders\nGROUP BY status\nORDER BY orders DESC, status;",
          hints: ["`GROUP BY status`, then `COUNT(*)`.", "Sort by the aliased count."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-group-e2",
          prompt:
            "Count customers per country: `country` and `customers`, largest first, tie-broken by `country`. (The customers with no country form their own group — leave them in.)",
          starter: "",
          solution:
            "SELECT country, COUNT(*) AS customers\nFROM customers\nGROUP BY country\nORDER BY customers DESC, country;",
          hints: ["NULL forms its own group — no special handling needed."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-group-e3",
          prompt:
            "Which products sell in the largest quantities? From `order_items`, return `product_id` and `units_sold` for the top 5, ordered by units sold descending then `product_id`.",
          starter: "",
          solution:
            "SELECT product_id, SUM(quantity) AS units_sold\nFROM order_items\nGROUP BY product_id\nORDER BY units_sold DESC, product_id\nLIMIT 5;",
          hints: ["Group by product, sum the quantity, sort, limit."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Why is `SELECT country, city, COUNT(*) FROM customers GROUP BY country;` a bug?",
          options: [
            "COUNT(*) cannot be used with GROUP BY",
            "`city` is neither grouped nor aggregated, so its value is arbitrary",
            "GROUP BY must come before SELECT",
            "It is not a bug — city is picked from the first row alphabetically",
          ],
          answer: 1,
          explain:
            "SQLite returns an arbitrary city from each group; most other databases reject the query outright. Group by it, or aggregate it.",
        },
      ],
    },

    {
      id: "m3-having",
      title: "HAVING: filtering groups",
      goal: "Filter on aggregate results, and know when WHERE is the better tool.",
      keywords: ["having", "filter groups", "aggregate filter"],
      exercises: [
        {
          id: "m3-having-e1",
          prompt:
            "Which products have sold **40 units or more**? Return `product_id` and `units_sold`, biggest first, tie-broken by `product_id`.",
          starter:
            "SELECT product_id, SUM(quantity) AS units_sold\nFROM order_items\nGROUP BY product_id;",
          solution:
            "SELECT product_id, SUM(quantity) AS units_sold\nFROM order_items\nGROUP BY product_id\nHAVING SUM(quantity) >= 40\nORDER BY units_sold DESC, product_id;",
          hints: [
            "The condition involves an aggregate, so it belongs in HAVING.",
            "HAVING goes after GROUP BY and before ORDER BY.",
          ],
          orderMatters: true,
          requires: [{ re: "\\bHAVING\\b", msg: "Filter the groups with HAVING." }],
        },
        {
          id: "m3-having-e2",
          prompt:
            "Find loyal buyers: `customer_id` and `completed_orders` for customers with **5 or more completed orders**. Sort by `completed_orders` descending, then `customer_id`.",
          starter: "",
          solution:
            "SELECT customer_id, COUNT(*) AS completed_orders\nFROM orders\nWHERE status = 'completed'\nGROUP BY customer_id\nHAVING COUNT(*) >= 5\nORDER BY completed_orders DESC, customer_id;",
          hints: [
            "Filter the rows first (`WHERE status = 'completed'`), then filter the groups.",
            "Row filter → WHERE. Group filter → HAVING.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-having-e3",
          prompt:
            "Which countries have an average shipping cost above 23? Return `ship_country` and `avg_shipping` (rounded to 2 dp), highest first, tie-broken by country. Ignore orders with no ship country.",
          starter: "",
          solution:
            "SELECT ship_country, ROUND(AVG(shipping_cost), 2) AS avg_shipping\nFROM orders\nWHERE ship_country IS NOT NULL\nGROUP BY ship_country\nHAVING AVG(shipping_cost) > 23\nORDER BY avg_shipping DESC, ship_country;",
          hints: [
            "`WHERE ship_country IS NOT NULL` removes the unknown group before grouping.",
            "Round in the SELECT list, but test the raw average in HAVING.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "`WHERE COUNT(*) > 5` produces 'misuse of aggregate function COUNT()'. Why?",
          options: [
            "COUNT needs a column argument",
            "WHERE runs before groups exist, so there is nothing to count yet",
            "Only SUM may be used in WHERE",
            "The parentheses are wrong",
          ],
          answer: 1,
          explain: "Group-level conditions belong in HAVING, which runs after GROUP BY.",
        },
      ],
    },

    {
      id: "m3-group-expressions",
      title: "Grouping by expressions",
      goal: "Build monthly reports and custom buckets by grouping on computed values.",
      keywords: ["group by expression", "month", "substr", "bucket", "price band"],
      exercises: [
        {
          id: "m3-expr-e1",
          prompt:
            "Monthly order volume for 2025: return `month` (as `YYYY-MM`) and `orders`, sorted by month. Only include orders placed in 2025.",
          starter:
            "SELECT substr(order_date, 1, 7) AS month\nFROM orders;",
          solution:
            "SELECT substr(order_date, 1, 7) AS month, COUNT(*) AS orders\nFROM orders\nWHERE order_date >= '2025-01-01'\nGROUP BY month\nORDER BY month;",
          hints: [
            "`substr(order_date, 1, 7)` keeps the year and month.",
            "Group by the same expression (or by its alias).",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-expr-e2",
          prompt:
            "Bucket the catalogue: return `price_band` (`premium` ≥ 1500, `mid` ≥ 400, else `budget`), `products` and `avg_price` (2 dp). Sort by `avg_price` descending.",
          starter: "",
          solution:
            "SELECT\n  CASE\n    WHEN unit_price >= 1500 THEN 'premium'\n    WHEN unit_price >= 400 THEN 'mid'\n    ELSE 'budget'\n  END AS price_band,\n  COUNT(*) AS products,\n  ROUND(AVG(unit_price), 2) AS avg_price\nFROM products\nGROUP BY price_band\nORDER BY avg_price DESC;",
          hints: [
            "Put the CASE in the SELECT list and group by its alias.",
            "Order the branches from the highest threshold down.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Which question needs two levels of aggregation (a subquery)?",
          options: [
            "Total revenue per product",
            "The average number of line items per order",
            "The number of orders per status",
            "The highest unit price in the catalogue",
          ],
          answer: 1,
          explain:
            "You must first count items per order, then average those counts — two aggregation steps, so the first one goes in a subquery or CTE.",
        },
      ],
    },

    {
      id: "m3-conditional",
      title: "Conditional aggregation",
      goal: "Count and sum several conditions side by side in a single pass.",
      keywords: ["conditional aggregation", "sum case", "filter clause", "pivot", "rate"],
      exercises: [
        {
          id: "m3-cond-e1",
          prompt:
            "One row, three numbers: `orders`, `completed` and `cancelled`. Use conditional aggregation rather than three separate queries.",
          starter: "SELECT COUNT(*) AS orders\nFROM orders;",
          solution:
            "SELECT\n  COUNT(*) AS orders,\n  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,\n  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled\nFROM orders;",
          hints: [
            "`SUM(CASE WHEN … THEN 1 ELSE 0 END)` counts matching rows.",
            "`COUNT(*) FILTER (WHERE …)` is the modern equivalent and also works here.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m3-cond-e2",
          prompt:
            "Per month of 2025, return `month` (`YYYY-MM`), `orders`, and `completed_pct` — the percentage of that month's orders that are completed, rounded to 1 decimal. Sort by month.",
          starter: "",
          solution:
            "SELECT\n  substr(order_date, 1, 7) AS month,\n  COUNT(*) AS orders,\n  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) AS completed_pct\nFROM orders\nWHERE order_date >= '2025-01-01'\nGROUP BY month\nORDER BY month;",
          hints: [
            "Multiply by `100.0` (not 100) so you do not get integer division.",
            "Divide the conditional count by `COUNT(*)`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-cond-e3",
          prompt:
            "In one row: `customers_who_ordered` (distinct customers with any order) and `customers_who_returned` (distinct customers with at least one `returned` order).",
          starter: "",
          solution:
            "SELECT\n  COUNT(DISTINCT customer_id) AS customers_who_ordered,\n  COUNT(DISTINCT CASE WHEN status = 'returned' THEN customer_id END) AS customers_who_returned\nFROM orders;",
          hints: [
            "A CASE with no ELSE yields NULL for non-matching rows.",
            "COUNT ignores NULLs, so only the matching customers are counted.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Why does `100 * completed / total` often return 0 in SQLite?",
          options: [
            "Because completed is NULL",
            "Because integer division truncates — use 100.0 to force floating point",
            "Because ROUND is missing",
            "Because the multiplication happens after the division",
          ],
          answer: 1,
          explain: "Integer ÷ integer = integer. `100.0 * a / b` (or CAST) keeps the fraction.",
        },
      ],
    },

    {
      id: "m3-groupconcat",
      title: "Lists, extremes and empty sets",
      goal: "Use group_concat, MIN/MAX as earliest/latest, and handle aggregates over no rows.",
      keywords: ["group_concat", "string_agg", "min", "max", "coalesce", "empty set"],
      exercises: [
        {
          id: "m3-gc-e1",
          prompt:
            "Per customer, return `customer_id`, `orders`, `first_order` (earliest order date) and `last_order` (latest). Show only the 10 busiest customers, ordered by `orders` descending then `customer_id`.",
          starter: "",
          solution:
            "SELECT\n  customer_id,\n  COUNT(*) AS orders,\n  MIN(order_date) AS first_order,\n  MAX(order_date) AS last_order\nFROM orders\nGROUP BY customer_id\nORDER BY orders DESC, customer_id\nLIMIT 10;",
          hints: ["MIN/MAX work on the text dates because the format sorts chronologically."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-gc-e2",
          prompt:
            "Which products appear in many different orders? Return `product_id`, `orders` (distinct order count) and `units_sold`, for products appearing in **20 or more** distinct orders. Sort by `orders` descending, then `product_id`.",
          starter: "",
          solution:
            "SELECT\n  product_id,\n  COUNT(DISTINCT order_id) AS orders,\n  SUM(quantity) AS units_sold\nFROM order_items\nGROUP BY product_id\nHAVING COUNT(DISTINCT order_id) >= 20\nORDER BY orders DESC, product_id;",
          hints: ["`COUNT(DISTINCT order_id)` inside both the SELECT list and HAVING."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-gc-e3",
          prompt:
            "A report must never show an empty cell. Return `total_qty` for `product_id = -1` (a product that does not exist) as **0** rather than NULL.",
          starter:
            "SELECT SUM(quantity) AS total_qty\nFROM order_items\nWHERE product_id = -1;",
          solution:
            "SELECT COALESCE(SUM(quantity), 0) AS total_qty\nFROM order_items\nWHERE product_id = -1;",
          hints: ["SUM over no rows is NULL.", "Wrap it: `COALESCE(SUM(quantity), 0)`."],
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m3-checkpoint",
      title: "Checkpoint: reporting questions",
      goal: "Answer realistic business questions with the full aggregation toolkit.",
      keywords: ["practice", "checkpoint", "reporting"],
      exercises: [
        {
          id: "m3-cp-e1",
          prompt:
            "**Busy months.** For 2025, return `month` (`YYYY-MM`), `orders` and `avg_shipping` (2 dp) for months with **more than 20 orders**, sorted by month.",
          starter: "",
          solution:
            "SELECT\n  substr(order_date, 1, 7) AS month,\n  COUNT(*) AS orders,\n  ROUND(AVG(shipping_cost), 2) AS avg_shipping\nFROM orders\nWHERE order_date >= '2025-01-01'\nGROUP BY month\nHAVING COUNT(*) > 20\nORDER BY month;",
          hints: ["WHERE for the year, HAVING for the count."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-cp-e2",
          prompt:
            "**Best sellers by money.** From `order_items`, return the top 5 `product_id` by `revenue` (`quantity * unit_price * (1 - discount)`, rounded to 2 dp), along with `units_sold`. Sort by revenue descending, then `product_id`.",
          starter: "",
          solution:
            "SELECT\n  product_id,\n  ROUND(SUM(quantity * unit_price * (1 - discount)), 2) AS revenue,\n  SUM(quantity) AS units_sold\nFROM order_items\nGROUP BY product_id\nORDER BY revenue DESC, product_id\nLIMIT 5;",
          hints: ["Same grouping as before, different expression inside SUM."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m3-cp-e3",
          prompt:
            "**Where the money ships.** For each `ship_country` with at least 10 completed orders, return `ship_country`, `completed_orders` and `shipping_total` (2 dp). Sort by `shipping_total` descending, then country.",
          starter: "",
          solution:
            "SELECT\n  ship_country,\n  COUNT(*) AS completed_orders,\n  ROUND(SUM(shipping_cost), 2) AS shipping_total\nFROM orders\nWHERE status = 'completed' AND ship_country IS NOT NULL\nGROUP BY ship_country\nHAVING COUNT(*) >= 10\nORDER BY shipping_total DESC, ship_country;",
          hints: [
            "Two row filters in WHERE, one group filter in HAVING.",
            "Exclude the NULL country group explicitly.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },
  ],
};
