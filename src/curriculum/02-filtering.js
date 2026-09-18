/* Module 2 — Filtering Rows ------------------------------------------- */

export default {
  id: "filtering",
  number: 2,
  title: "Filtering Rows",
  level: "Beginner",
  summary:
    "WHERE, boolean logic, ranges, pattern matching, the truth about NULL, and CASE expressions.",
  lessons: [
    {
      id: "m2-where",
      title: "WHERE: keeping the rows you want",
      goal: "Filter rows with comparison operators, and know why WHERE cannot see your aliases.",
      keywords: ["where", "filter", "comparison", "operators", "equals"],
      exercises: [
        {
          id: "m2-where-e1",
          prompt:
            "List the `name` and `unit_price` of every product that costs **less than 100**.",
          starter: "SELECT name, unit_price\nFROM products;",
          solution: "SELECT name, unit_price FROM products WHERE unit_price < 100;",
          hints: ["`WHERE` goes after `FROM`.", "Numbers are not quoted."],
        },
        {
          id: "m2-where-e2",
          prompt:
            "Which orders were cancelled? Return `order_id` and `customer_id` for orders whose `status` is `cancelled`.",
          starter: "",
          solution: "SELECT order_id, customer_id FROM orders WHERE status = 'cancelled';",
          hints: ["Text values need single quotes.", "`status = 'cancelled'`"],
        },
        {
          id: "m2-where-e3",
          prompt:
            "Return `order_id` and `order_date` for every order placed **on or after 1 June 2025**, oldest first (tie-break `order_id`).",
          starter: "",
          solution:
            "SELECT order_id, order_date FROM orders WHERE order_date >= '2025-06-01' ORDER BY order_date, order_id;",
          hints: [
            "Dates are text in `YYYY-MM-DD` form, so `>=` works directly.",
            "Quote the date like any other string.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "`SELECT unit_price * 0.9 AS sale FROM products WHERE sale < 100;` runs in SQLite but fails in PostgreSQL. Why?",
          options: [
            "PostgreSQL does not allow multiplication in a SELECT list",
            "WHERE is evaluated before the SELECT list, so in standard SQL the alias does not exist yet — SQLite just happens to be lenient",
            "The alias needs double quotes in PostgreSQL",
            "It fails in SQLite too",
          ],
          answer: 1,
          explain:
            "Repeat the expression in WHERE, or wrap the query in a subquery / CTE (Module 5). Then it works everywhere.",
        },
      ],
    },

    {
      id: "m2-boolean",
      title: "AND, OR, NOT",
      goal: "Combine conditions safely — and never get burned by operator precedence.",
      keywords: ["and", "or", "not", "precedence", "parentheses", "boolean"],
      exercises: [
        {
          id: "m2-bool-e1",
          prompt:
            "Find the bargains that are actually available: `name`, `unit_price` and `units_in_stock` for products cheaper than 200 **and** with at least one unit in stock.",
          starter: "SELECT name, unit_price, units_in_stock\nFROM products\nWHERE unit_price < 200;",
          solution:
            "SELECT name, unit_price, units_in_stock FROM products WHERE unit_price < 200 AND units_in_stock > 0;",
          hints: ["Two conditions joined by `AND`."],
        },
        {
          id: "m2-bool-e2",
          prompt:
            "Return `customer_id`, `country` and `loyalty_tier` for **gold** customers based in the USA **or** Canada. Watch your brackets.",
          starter:
            "SELECT customer_id, country, loyalty_tier\nFROM customers\nWHERE country = 'USA' OR country = 'Canada' AND loyalty_tier = 'gold';",
          solution:
            "SELECT customer_id, country, loyalty_tier\nFROM customers\nWHERE (country = 'USA' OR country = 'Canada')\n  AND loyalty_tier = 'gold';",
          hints: [
            "`AND` binds tighter than `OR`, so the starter means USA OR (Canada AND gold).",
            "Wrap the two country tests in parentheses.",
          ],
        },
        {
          id: "m2-bool-e3",
          prompt:
            "Return `name` and `units_in_stock` for products that are **not** discontinued and have **no** stock left.",
          starter: "",
          solution:
            "SELECT name, units_in_stock FROM products WHERE discontinued = 0 AND units_in_stock = 0;",
          hints: [
            "SQLite stores booleans as 1 and 0.",
            "`discontinued = 0` (or `NOT discontinued`) plus a stock test.",
          ],
        },
      ],
      quiz: [
        {
          q: "`WHERE a = 1 OR a = 2 AND b = 3` is equivalent to…",
          options: [
            "(a = 1 OR a = 2) AND b = 3",
            "a = 1 OR (a = 2 AND b = 3)",
            "a = 1 AND a = 2 AND b = 3",
            "it is ambiguous and raises an error",
          ],
          answer: 1,
          explain: "AND has higher precedence than OR. Add brackets and the question disappears.",
        },
      ],
    },

    {
      id: "m2-in-between",
      title: "IN and BETWEEN",
      goal: "Match a set of values and an inclusive range — and avoid the two classic traps.",
      keywords: ["in", "not in", "between", "range", "half-open"],
      exercises: [
        {
          id: "m2-in-e1",
          prompt:
            "Return `customer_id` and `country` for customers based in **Germany, France or Japan**, using a single `IN` list.",
          starter: "",
          solution:
            "SELECT customer_id, country FROM customers WHERE country IN ('Germany', 'France', 'Japan');",
          hints: ["`country IN ('a', 'b', 'c')`"],
          requires: [{ re: "\\bIN\\s*\\(", msg: "Use an IN list rather than chained ORs." }],
        },
        {
          id: "m2-in-e2",
          prompt:
            "Return `name` and `unit_price` for products priced **from 200 to 500 inclusive**, using `BETWEEN`.",
          starter: "",
          solution:
            "SELECT name, unit_price FROM products WHERE unit_price BETWEEN 200 AND 500;",
          hints: ["`BETWEEN low AND high` — low first, both ends included."],
          requires: [{ re: "\\bBETWEEN\\b", msg: "This exercise asks for BETWEEN." }],
        },
        {
          id: "m2-in-e3",
          prompt:
            "Count the payments taken in **March 2025**. Return a single column named `payments_in_march`. `paid_at` is a full timestamp, so use a half-open range rather than `BETWEEN`.",
          starter: "SELECT COUNT(*) AS payments_in_march\nFROM payments;",
          solution:
            "SELECT COUNT(*) AS payments_in_march\nFROM payments\nWHERE paid_at >= '2025-03-01' AND paid_at < '2025-04-01';",
          hints: [
            "`>= '2025-03-01' AND < '2025-04-01'` catches everything on the 31st too.",
            "`BETWEEN '2025-03-01' AND '2025-03-31'` would silently drop the last day.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Why can `x NOT IN (1, 2, NULL)` never return true?",
          options: [
            "NULL is treated as zero",
            "x might be equal to the unknown value, so the result is unknown — and WHERE drops it",
            "NOT IN does not accept NULLs and errors out",
            "It does return true; the claim is false",
          ],
          answer: 1,
          explain:
            "Comparisons with NULL yield unknown. NOT IN needs every comparison to be false, which can never be proven. Use NOT EXISTS instead.",
        },
      ],
    },

    {
      id: "m2-like",
      title: "Pattern matching with LIKE",
      goal: "Search inside text with % and _, and understand case sensitivity.",
      keywords: ["like", "glob", "wildcard", "pattern", "search", "escape"],
      exercises: [
        {
          id: "m2-like-e1",
          prompt: "Return the `name` of every product whose name contains **Mic**.",
          starter: "",
          solution: "SELECT name FROM products WHERE name LIKE '%Mic%';",
          hints: ["`%` matches any run of characters, so put one on each side."],
          requires: [{ re: "\\bLIKE\\b|\\bGLOB\\b", msg: "Use LIKE (or GLOB) for pattern matching." }],
        },
        {
          id: "m2-like-e2",
          prompt:
            "Return `customer_id` and `last_name` for customers whose surname **starts with S**.",
          starter: "",
          solution: "SELECT customer_id, last_name FROM customers WHERE last_name LIKE 'S%';",
          hints: ["No leading wildcard this time: `'S%'`."],
        },
        {
          id: "m2-like-e3",
          prompt:
            "Return `name` and `unit_price` for **cables** — products whose name contains the word *cable* — that cost less than 35.",
          starter: "",
          solution:
            "SELECT name, unit_price FROM products WHERE name LIKE '%Cable%' AND unit_price < 35;",
          hints: [
            "Combine a LIKE with a numeric condition using AND.",
            "SQLite's LIKE ignores case for ASCII, so '%cable%' works too.",
          ],
        },
      ],
      quiz: [
        {
          q: "Which pattern finds names that end in 'Case'?",
          options: ["'Case%'", "'%Case'", "'%Case%'", "'_Case'"],
          answer: 1,
          explain: "A wildcard only at the start anchors the match to the end of the string.",
        },
      ],
    },

    {
      id: "m2-null",
      title: "NULL: the value that isn't",
      goal: "Handle unknown values without silently losing rows.",
      keywords: ["null", "is null", "coalesce", "ifnull", "three-valued logic", "unknown"],
      exercises: [
        {
          id: "m2-null-e1",
          prompt:
            "Which customers have no birth date on file? Return `customer_id` and `first_name`.",
          starter: "SELECT customer_id, first_name\nFROM customers\nWHERE birth_date = NULL;",
          solution:
            "SELECT customer_id, first_name FROM customers WHERE birth_date IS NULL;",
          hints: [
            "`= NULL` is never true — comparisons with NULL are unknown.",
            "Use `IS NULL`.",
          ],
          requires: [{ re: "IS\\s+NULL", msg: "Test for missing values with IS NULL." }],
        },
        {
          id: "m2-null-e2",
          prompt:
            "Find orders that are still waiting to ship: `order_id` and `status` for orders with **no ship date** whose status is **not** `cancelled`.",
          starter: "",
          solution:
            "SELECT order_id, status FROM orders WHERE ship_date IS NULL AND status <> 'cancelled';",
          hints: ["Two conditions: one `IS NULL`, one inequality."],
        },
        {
          id: "m2-null-e3",
          prompt:
            "Return `customer_id` and a column named `country` for **every** customer, showing `unknown` where the country is missing.",
          starter: "SELECT customer_id, country FROM customers;",
          solution:
            "SELECT customer_id, COALESCE(country, 'unknown') AS country FROM customers;",
          hints: [
            "`COALESCE(a, b)` returns b when a is NULL.",
            "Remember to alias the column back to `country`.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m2-null-e4",
          prompt:
            "How many customers are **not** based in the USA — counting those whose country is unknown as well? Return one column named `not_usa`.",
          starter: "SELECT COUNT(*) AS not_usa\nFROM customers\nWHERE country <> 'USA';",
          solution:
            "SELECT COUNT(*) AS not_usa FROM customers WHERE country <> 'USA' OR country IS NULL;",
          hints: [
            "`country <> 'USA'` is unknown — not true — when country is NULL, so those rows are dropped.",
            "Add `OR country IS NULL`.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "What does `SELECT 'Ada ' || NULL;` return?",
          options: ["'Ada '", "'Ada null'", "NULL", "an error"],
          answer: 2,
          explain:
            "NULL propagates through expressions. Wrap nullable parts in COALESCE before concatenating.",
        },
        {
          q: "Which condition keeps rows whose `city` is missing?",
          options: ["city = NULL", "city = ''", "city IS NULL", "NOT city"],
          answer: 2,
          explain: "Only IS NULL (or IS NOT DISTINCT-style `IS`) can test for NULL.",
        },
      ],
    },

    {
      id: "m2-case",
      title: "CASE: if/else inside a query",
      goal: "Map values into categories and use CASE anywhere an expression is allowed.",
      keywords: ["case", "when", "then", "else", "iif", "bucket", "categorise"],
      exercises: [
        {
          id: "m2-case-e1",
          prompt:
            "Return `name`, `unit_price` and a column `price_band`: `premium` at 1500 or more, `mid` from 400 up to 1500, otherwise `budget`.",
          starter:
            "SELECT\n  name,\n  unit_price,\n  CASE\n    -- your branches here\n  END AS price_band\nFROM products;",
          solution:
            "SELECT\n  name,\n  unit_price,\n  CASE\n    WHEN unit_price >= 1500 THEN 'premium'\n    WHEN unit_price >= 400 THEN 'mid'\n    ELSE 'budget'\n  END AS price_band\nFROM products;",
          hints: [
            "Branches are tested top to bottom, so put the highest threshold first.",
            "Finish with `ELSE 'budget' END AS price_band`.",
          ],
          requires: [{ re: "\\bCASE\\b", msg: "This one is about CASE — use it." }],
          checkColumnNames: true,
        },
        {
          id: "m2-case-e2",
          prompt:
            "Return `order_id`, `status` and `lifecycle`: `fulfilled` for completed orders, `in flight` for processing or shipped, `lost` for cancelled or returned.",
          starter: "",
          solution:
            "SELECT\n  order_id,\n  status,\n  CASE status\n    WHEN 'completed' THEN 'fulfilled'\n    WHEN 'processing' THEN 'in flight'\n    WHEN 'shipped' THEN 'in flight'\n    ELSE 'lost'\n  END AS lifecycle\nFROM orders;",
          hints: [
            "Either the simple form (`CASE status WHEN …`) or the searched form works.",
            "Two statuses map to the same label — give each its own WHEN.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m2-case-e3",
          prompt:
            "Return `product_id` and `name` for all products, sorted so that products **with no stock** come first, then everything else by `unit_price` descending, then `product_id`.",
          starter: "",
          solution:
            "SELECT product_id, name\nFROM products\nORDER BY CASE WHEN units_in_stock = 0 THEN 0 ELSE 1 END, unit_price DESC, product_id;",
          hints: [
            "`ORDER BY` accepts expressions, including CASE.",
            "Give out-of-stock rows a smaller sort value than the rest.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "A CASE with no matching WHEN and no ELSE returns…",
          options: ["0", "an empty string", "NULL", "an error"],
          answer: 2,
          explain: "Always add an ELSE unless you genuinely want NULL for unmatched rows.",
        },
      ],
    },

    {
      id: "m2-checkpoint",
      title: "Checkpoint: filtering in practice",
      goal: "Combine everything from Modules 1 and 2 on realistic questions.",
      keywords: ["practice", "checkpoint", "review"],
      exercises: [
        {
          id: "m2-cp-e1",
          prompt:
            "**Restock report.** Return `name`, `units_in_stock` and `unit_price` for products that are still sold (`discontinued = 0`) and have fewer than 10 units in stock. Sort by `units_in_stock` ascending, then `product_id`.",
          starter: "",
          solution:
            "SELECT name, units_in_stock, unit_price\nFROM products\nWHERE discontinued = 0\n  AND units_in_stock < 10\nORDER BY units_in_stock, product_id;",
          hints: ["Two conditions with AND, then a two-key ORDER BY."],
          orderMatters: true,
        },
        {
          id: "m2-cp-e2",
          prompt:
            "**Top customers to call.** Return `customer_id`, `signup_date` and `loyalty_tier` for gold or platinum customers who signed up during 2024. Sort by `signup_date`, then `customer_id`.",
          starter: "",
          solution:
            "SELECT customer_id, signup_date, loyalty_tier\nFROM customers\nWHERE loyalty_tier IN ('gold', 'platinum')\n  AND signup_date >= '2024-01-01'\n  AND signup_date < '2025-01-01'\nORDER BY signup_date, customer_id;",
          hints: [
            "An IN list for the tiers, a date range for the year.",
            "`>= '2024-01-01' AND < '2025-01-01'` is the safe way to say 'during 2024'.",
          ],
          orderMatters: true,
        },
        {
          id: "m2-cp-e3",
          prompt:
            "**Shipping delay watchlist.** Return `order_id`, `order_date`, and a column `ship_state` that reads `not shipped` when `ship_date` is missing and `shipped` otherwise — but only for orders placed in 2025 whose status is not `cancelled`. Sort by `order_id`.",
          starter: "",
          solution:
            "SELECT\n  order_id,\n  order_date,\n  CASE WHEN ship_date IS NULL THEN 'not shipped' ELSE 'shipped' END AS ship_state\nFROM orders\nWHERE order_date >= '2025-01-01'\n  AND status <> 'cancelled'\nORDER BY order_id;",
          hints: [
            "CASE in the SELECT list, filters in WHERE.",
            "`IIF(ship_date IS NULL, 'not shipped', 'shipped')` is a shorter equivalent.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
      ],
    },
  ],
};
