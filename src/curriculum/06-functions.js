/* Module 6 — Types & Functions ---------------------------------------- */

export default {
  id: "functions",
  number: 6,
  title: "Types & Functions",
  level: "Intermediate",
  summary:
    "Storage classes and CAST, text and number functions, real date arithmetic, NULL helpers and querying JSON columns.",
  lessons: [
    {
      id: "m6-types",
      title: "Types, affinity and CAST",
      goal: "Understand SQLite's storage classes and convert values deliberately.",
      keywords: ["type", "affinity", "cast", "typeof", "integer division"],
      exercises: [
        {
          id: "m6-types-e1",
          prompt:
            "Return `product_id`, `reorder_level` and `reorder_type` (the result of `typeof(reorder_level)`) for the first 10 products by id.",
          starter: "",
          solution:
            "SELECT product_id, reorder_level, typeof(reorder_level) AS reorder_type\nFROM products\nORDER BY product_id\nLIMIT 10;",
          hints: ["`typeof(x)` reports the storage class of the value in that row."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-types-e2",
          prompt:
            "Return `name`, `unit_price`, `truncated` (the price cast to an integer) and `rounded` (the price rounded to 0 decimals) for the 10 dearest products, tie-broken by `product_id`.",
          starter: "",
          solution:
            "SELECT\n  name,\n  unit_price,\n  CAST(unit_price AS INTEGER) AS truncated,\n  ROUND(unit_price, 0) AS rounded\nFROM products\nORDER BY unit_price DESC, product_id\nLIMIT 10;",
          hints: ["CAST truncates towards zero; ROUND rounds. That is the point of the exercise."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "In SQLite, what does `SELECT 5 < '3';` return?",
          options: ["0 (false)", "1 (true)", "NULL", "An error"],
          answer: 1,
          explain:
            "Storage classes order as NULL < numbers < text < blob, so any number is less than any string.",
        },
        {
          q: "Why does `SELECT 3 / 4;` return 0?",
          options: [
            "A rounding bug",
            "Both operands are integers, so the division is integer division",
            "SQLite cannot divide",
            "It returns 0.75 — the claim is false",
          ],
          answer: 1,
          explain: "Force a real: `3 * 1.0 / 4`, `3 / 4.0`, or CAST one side.",
        },
      ],
    },

    {
      id: "m6-text",
      title: "Text functions",
      goal: "Slice, clean and format strings.",
      keywords: ["substr", "instr", "replace", "trim", "upper", "lower", "printf", "length"],
      exercises: [
        {
          id: "m6-text-e1",
          prompt:
            "Return `email`, `local_part` (everything before the `@`) and `domain` (everything after it) for the first 10 customers by id.",
          starter: "SELECT email FROM customers ORDER BY customer_id LIMIT 10;",
          solution:
            "SELECT\n  email,\n  SUBSTR(email, 1, INSTR(email, '@') - 1) AS local_part,\n  SUBSTR(email, INSTR(email, '@') + 1) AS domain\nFROM customers\nORDER BY customer_id\nLIMIT 10;",
          hints: [
            "`INSTR(email, '@')` gives the position of the @ sign.",
            "`SUBSTR(s, start)` with no length runs to the end of the string.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-text-e2",
          prompt:
            "Return `name` and `slug` — the product name lower-cased with spaces replaced by hyphens — for the first 10 products by id.",
          starter: "",
          solution:
            "SELECT name, REPLACE(LOWER(name), ' ', '-') AS slug\nFROM products\nORDER BY product_id\nLIMIT 10;",
          hints: ["Nest the functions: `REPLACE(LOWER(name), ' ', '-')`."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-text-e3",
          prompt:
            "Return `name` and `price_text` — the unit price formatted with exactly 2 decimals as text — for the 5 dearest products, tie-broken by `product_id`.",
          starter: "",
          solution:
            "SELECT name, printf('%.2f', unit_price) AS price_text\nFROM products\nORDER BY unit_price DESC, product_id\nLIMIT 5;",
          hints: ["`printf('%.2f', value)` formats a number as text."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m6-numbers",
      title: "Numbers and rounding",
      goal: "Round money correctly, compute percentages, and build numeric buckets.",
      keywords: ["round", "abs", "percentage", "floating point", "bucket"],
      exercises: [
        {
          id: "m6-num-e1",
          prompt:
            "Return `status`, `orders` and `pct` — each status's share of all orders as a percentage rounded to 2 dp. Sort by `orders` descending, then `status`.",
          starter: "",
          solution:
            "SELECT\n  status,\n  COUNT(*) AS orders,\n  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 2) AS pct\nFROM orders\nGROUP BY status\nORDER BY orders DESC, status;",
          hints: [
            "The denominator is a scalar subquery over all orders.",
            "`100.0` keeps the arithmetic in floating point.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-num-e2",
          prompt:
            "Bucket products into 500-wide price bands: return `price_bucket` (0, 500, 1000, …) and `products`, sorted by bucket.",
          starter: "",
          solution:
            "SELECT (CAST(unit_price AS INTEGER) / 500) * 500 AS price_bucket, COUNT(*) AS products\nFROM products\nGROUP BY price_bucket\nORDER BY price_bucket;",
          hints: [
            "Integer division then multiplication rounds down to a multiple of 500.",
            "CAST the price to an integer first.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m6-dates",
      title: "Dates and times",
      goal: "Format, extract and shift dates with date(), strftime() and modifiers.",
      keywords: ["date", "strftime", "julianday", "modifier", "start of month"],
      exercises: [
        {
          id: "m6-dates-e1",
          prompt:
            "Return `year`, `month` (both as 4- and 2-character text via `strftime`) and `orders` for every year/month in the data, sorted by year then month.",
          starter: "",
          solution:
            "SELECT\n  strftime('%Y', order_date) AS year,\n  strftime('%m', order_date) AS month,\n  COUNT(*) AS orders\nFROM orders\nGROUP BY year, month\nORDER BY year, month;",
          hints: ["`strftime('%Y', col)` and `strftime('%m', col)`."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-dates-e2",
          prompt:
            "For the 10 oldest orders (by `order_id`), return `order_id`, `order_date`, `month_start` (first day of that month) and `month_end` (last day of that month).",
          starter: "",
          solution:
            "SELECT\n  order_id,\n  order_date,\n  date(order_date, 'start of month') AS month_start,\n  date(order_date, 'start of month', '+1 month', '-1 day') AS month_end\nFROM orders\nORDER BY order_id\nLIMIT 10;",
          hints: [
            "`date(x, 'start of month')` snaps to the 1st.",
            "Add a month and subtract a day for the last day.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-dates-e3",
          prompt:
            "How many orders were placed on each weekday? Return `weekday` (`strftime('%w', …)`, 0 = Sunday) and `orders`, sorted by weekday.",
          starter: "",
          solution:
            "SELECT strftime('%w', order_date) AS weekday, COUNT(*) AS orders\nFROM orders\nGROUP BY weekday\nORDER BY weekday;",
          hints: ["`%w` gives the day of week as a single digit."],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Which expression gives the last day of the month containing `d`?",
          options: [
            "date(d, '+1 month')",
            "date(d, 'start of month', '+1 month', '-1 day')",
            "date(d, 'end of month')",
            "strftime('%d', d)",
          ],
          answer: 1,
          explain: "SQLite has no 'end of month' modifier; this three-step chain is the idiom.",
        },
      ],
    },

    {
      id: "m6-date-math",
      title: "Date arithmetic",
      goal: "Measure durations, compute ages, and bucket by recency.",
      keywords: ["julianday", "difference", "age", "duration", "recency", "fulfilment"],
      exercises: [
        {
          id: "m6-datemath-e1",
          prompt:
            "Which orders took longest to ship? Return `order_id`, `order_date`, `ship_date` and `days_to_ship` (whole days, as an integer) for the 10 slowest shipped orders, tie-broken by `order_id`.",
          starter: "",
          solution:
            "SELECT\n  order_id,\n  order_date,\n  ship_date,\n  CAST(julianday(ship_date) - julianday(order_date) AS INTEGER) AS days_to_ship\nFROM orders\nWHERE ship_date IS NOT NULL\nORDER BY days_to_ship DESC, order_id\nLIMIT 10;",
          hints: [
            "`julianday()` converts a date to a number of days.",
            "Exclude unshipped orders with `WHERE ship_date IS NOT NULL`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-datemath-e2",
          prompt:
            "Average fulfilment time per status: return `status`, `orders` and `avg_days_to_ship` (2 dp) for shipped orders only, fastest first.",
          starter: "",
          solution:
            "SELECT\n  status,\n  COUNT(*) AS orders,\n  ROUND(AVG(julianday(ship_date) - julianday(order_date)), 2) AS avg_days_to_ship\nFROM orders\nWHERE ship_date IS NOT NULL\nGROUP BY status\nORDER BY avg_days_to_ship;",
          hints: ["AVG over the julianday difference, grouped by status."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-datemath-e3",
          prompt:
            "Treating **2025-06-30** as today, bucket orders by recency: `0-30 days`, `31-90 days`, `91-365 days`, `over a year`. Return `recency` and `orders`, sorted by `orders` descending then `recency`.",
          starter: "",
          solution:
            "SELECT\n  CASE\n    WHEN julianday('2025-06-30') - julianday(order_date) <= 30 THEN '0-30 days'\n    WHEN julianday('2025-06-30') - julianday(order_date) <= 90 THEN '31-90 days'\n    WHEN julianday('2025-06-30') - julianday(order_date) <= 365 THEN '91-365 days'\n    ELSE 'over a year'\n  END AS recency,\n  COUNT(*) AS orders\nFROM orders\nGROUP BY recency\nORDER BY orders DESC, recency;",
          hints: [
            "CASE over the julianday difference, then GROUP BY the alias.",
            "Order the branches from the smallest window upwards.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },

    {
      id: "m6-nullfns",
      title: "NULL helpers",
      goal: "Fill, guard and sort around missing values.",
      keywords: ["coalesce", "ifnull", "nullif", "iif", "division by zero", "nulls last"],
      exercises: [
        {
          id: "m6-null-e1",
          prompt:
            "Return `customer_id`, `best_known_location` (city, else country, else `unknown`) and `acquisition` (`referred` when `referred_by` is set, otherwise `organic`) for the first 12 customers by id.",
          starter: "",
          solution:
            "SELECT\n  customer_id,\n  COALESCE(city, country, 'unknown') AS best_known_location,\n  IIF(referred_by IS NULL, 'organic', 'referred') AS acquisition\nFROM customers\nORDER BY customer_id\nLIMIT 12;",
          hints: [
            "COALESCE takes as many arguments as you like and returns the first non-NULL.",
            "IIF(condition, then, else) is a compact CASE.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-null-e2",
          prompt:
            "Sort products so that those **with** a `reorder_level` come first (highest first) and the NULLs come last. Return `name` and `reorder_level`, limit 15, tie-broken by `product_id`.",
          starter: "",
          solution:
            "SELECT name, reorder_level\nFROM products\nORDER BY reorder_level IS NULL, reorder_level DESC, product_id\nLIMIT 15;",
          hints: [
            "`reorder_level IS NULL` is 0 or 1 — sort by it first.",
            "`ORDER BY reorder_level DESC NULLS LAST` also works in SQLite.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "What is `NULLIF(items, 0)` for?",
          options: [
            "Replacing NULL with 0",
            "Turning a 0 into NULL so a division yields NULL instead of a wrong or failing result",
            "Counting non-zero items",
            "Nothing — it is an alias for COALESCE",
          ],
          answer: 1,
          explain: "NULLIF(a, b) returns NULL when a = b. It is the portable divide-by-zero guard.",
        },
      ],
    },

    {
      id: "m6-json",
      title: "Querying JSON",
      goal: "Read fields, expand arrays and aggregate over JSON documents.",
      keywords: ["json", "json_extract", "json_each", "arrow operator", "json_object"],
      exercises: [
        {
          id: "m6-json-e1",
          prompt:
            "From `product_meta`, return `product_id`, `colour` and `warranty_months` extracted from the JSON `attributes`, for the first 10 products by id.",
          starter: "SELECT product_id, attributes FROM product_meta ORDER BY product_id LIMIT 10;",
          solution:
            "SELECT\n  product_id,\n  attributes ->> '$.colour' AS colour,\n  attributes ->> '$.warranty_months' AS warranty_months\nFROM product_meta\nORDER BY product_id\nLIMIT 10;",
          hints: [
            "`attributes ->> '$.field'` extracts a value, as does `json_extract(attributes, '$.field')`.",
            "The path always starts with `$.`",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-json-e2",
          prompt:
            "How many products come in each colour? Return `colour` and `products`, most common first, tie-broken by colour.",
          starter: "",
          solution:
            "SELECT attributes ->> '$.colour' AS colour, COUNT(*) AS products\nFROM product_meta\nGROUP BY colour\nORDER BY products DESC, colour;",
          hints: ["Group by the extracted value (or its alias)."],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m6-json-e3",
          prompt:
            "The `tags` field is a JSON array. Return `tag` and `products` — how many products carry each tag — most common first, tie-broken by tag. Use `json_each`.",
          starter: "",
          solution:
            "SELECT t.value AS tag, COUNT(*) AS products\nFROM product_meta AS m\nJOIN json_each(m.attributes, '$.tags') AS t\nGROUP BY tag\nORDER BY products DESC, tag;",
          hints: [
            "`json_each(doc, '$.path')` turns an array into rows with a `value` column.",
            "Join it like a table: `JOIN json_each(m.attributes, '$.tags') AS t`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
          requires: [{ re: "json_each", msg: "Expand the array with json_each." }],
        },
        {
          id: "m6-json-e4",
          prompt:
            "Return `product_id` and `name` for every product tagged **bestseller**, sorted by `product_id`.",
          starter: "",
          solution:
            "SELECT p.product_id, p.name\nFROM product_meta AS m\nJOIN products AS p ON p.product_id = m.product_id\nWHERE EXISTS (\n  SELECT 1 FROM json_each(m.attributes, '$.tags') AS t WHERE t.value = 'bestseller'\n)\nORDER BY p.product_id;",
          hints: [
            "EXISTS over json_each keeps one row per product.",
            "Joining json_each directly would also work here because a tag appears at most once per product.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "What is the practical cost of storing data in a JSON column?",
          options: [
            "None — it is exactly as fast as a normal column",
            "Every read parses the document and ordinary indexes do not apply to fields inside it",
            "JSON columns cannot be filtered at all",
            "They use twice the storage",
          ],
          answer: 1,
          explain:
            "Promote hot fields to real columns, or create an expression index over the extracted value.",
        },
      ],
    },
  ],
};
