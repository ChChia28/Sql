/* Module 1 — First Queries -------------------------------------------- */

export default {
  id: "first-queries",
  number: 1,
  title: "First Queries",
  level: "Beginner",
  summary:
    "What a table is, how to ask for columns, and how to sort and trim a result. Everything else builds on these six keywords.",
  lessons: [
    {
      id: "m1-tables",
      title: "Tables, rows and columns",
      goal: "Understand how a relational database stores data, and run your first SELECT.",
      keywords: ["table", "row", "column", "primary key", "foreign key", "select", "count"],
      exercises: [
        {
          id: "m1-tables-e1",
          prompt: "Return **every column and every row** of the `suppliers` table.",
          starter: "SELECT\nFROM suppliers;",
          solution: "SELECT * FROM suppliers;",
          hints: [
            "`*` is the shorthand for 'all columns'.",
            "The shape is `SELECT <columns> FROM <table>;`",
          ],
        },
        {
          id: "m1-tables-e2",
          prompt:
            "How many customers are in the database? Return a **single row with a single column** holding the count.",
          starter: "SELECT ... FROM customers;",
          solution: "SELECT COUNT(*) FROM customers;",
          hints: [
            "`COUNT(*)` counts rows.",
            "You do not need anything after the table name.",
          ],
        },
      ],
      quiz: [
        {
          q: "What does one row in the `orders` table represent?",
          options: [
            "One customer",
            "One order placed by a customer",
            "One product that was sold",
            "One day of sales",
          ],
          answer: 1,
          explain:
            "A table holds one kind of thing, one per row. The individual products on an order live in a second table, order_items.",
        },
        {
          q: "`orders.customer_id` is best described as…",
          options: [
            "the primary key of orders",
            "a foreign key pointing at customers.customer_id",
            "a duplicate of customers.customer_id that should be removed",
            "an index",
          ],
          answer: 1,
          explain:
            "The primary key of orders is order_id. customer_id points at another table's primary key, which makes it a foreign key.",
        },
      ],
    },

    {
      id: "m1-select",
      title: "SELECT: choosing columns",
      goal: "Name the columns you want, in the order you want them.",
      keywords: ["select", "columns", "projection", "case sensitivity"],
      exercises: [
        {
          id: "m1-select-e1",
          prompt:
            "List the `name` and `unit_price` of every product — those two columns, in that order.",
          starter: "SELECT\nFROM products;",
          solution: "SELECT name, unit_price FROM products;",
          hints: ["Separate column names with a comma.", "No comma before `FROM`."],
        },
        {
          id: "m1-select-e2",
          prompt:
            "For every customer, return `email`, `first_name` and `last_name` — in that order.",
          starter: "",
          solution: "SELECT email, first_name, last_name FROM customers;",
          hints: [
            "The result columns appear in the order you write them, not the order they sit in the table.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "Which of these is a syntax error?",
          options: [
            "select NAME, unit_price from Products;",
            "SELECT name, unit_price, FROM products;",
            "SELECT unit_price, name FROM products;",
            "SELECT * FROM products;",
          ],
          answer: 1,
          explain:
            "The trailing comma after unit_price leaves SQLite expecting another column. Keywords and identifiers are case-insensitive, so the first one is ugly but legal.",
        },
      ],
    },

    {
      id: "m1-expressions",
      title: "Expressions and aliases",
      goal: "Compute new columns and give them readable names with AS.",
      keywords: ["alias", "as", "expression", "arithmetic", "concatenation", "round"],
      exercises: [
        {
          id: "m1-expr-e1",
          prompt:
            "Return one column called `full_name` for every customer: first name, a space, then last name.",
          starter: "SELECT first_name, last_name\nFROM customers;",
          solution: "SELECT first_name || ' ' || last_name AS full_name FROM customers;",
          hints: [
            "`||` concatenates text.",
            "The space is a string literal in single quotes: `' '`.",
            "Name the result with `AS full_name`.",
          ],
          checkColumnNames: true,
        },
        {
          id: "m1-expr-e2",
          prompt:
            "For every product return `name`, and a second column `stock_value` = units in stock × unit price, **rounded to 2 decimal places**.",
          starter: "SELECT name, units_in_stock, unit_price\nFROM products;",
          solution:
            "SELECT name, ROUND(units_in_stock * unit_price, 2) AS stock_value FROM products;",
          hints: [
            "`ROUND(value, 2)` rounds to two decimals.",
            "Multiply with `*` directly in the SELECT list.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "In SQLite, what does `'Gold' = \"Gold\"` compare?",
          options: [
            "Two identical text values — it is true",
            "A text value against an identifier (column name) — it is a trap",
            "Nothing, it is always a syntax error",
            "Two numbers",
          ],
          answer: 1,
          explain:
            "Single quotes make a text literal; double quotes name an identifier. SQLite falls back to treating an unknown identifier as text, which hides bugs that break elsewhere.",
        },
      ],
    },

    {
      id: "m1-distinct",
      title: "DISTINCT: unique values",
      goal: "Collapse duplicate rows, and understand that DISTINCT applies to the whole row.",
      keywords: ["distinct", "unique", "count distinct"],
      exercises: [
        {
          id: "m1-distinct-e1",
          prompt: "Which loyalty tiers exist in `customers`? Return each one exactly once.",
          starter: "SELECT loyalty_tier FROM customers;",
          solution: "SELECT DISTINCT loyalty_tier FROM customers;",
          hints: ["`DISTINCT` goes straight after `SELECT`."],
          requires: [{ re: "\\bDISTINCT\\b", msg: "Use DISTINCT for this one." }],
        },
        {
          id: "m1-distinct-e2",
          prompt:
            "How many **different countries** do our suppliers operate from? Return a single value named `country_count`.",
          starter: "",
          solution: "SELECT COUNT(DISTINCT country) AS country_count FROM suppliers;",
          hints: [
            "`DISTINCT` can live inside `COUNT()`.",
            "`COUNT(DISTINCT country)` counts unique non-NULL values.",
          ],
          checkColumnNames: true,
        },
      ],
      quiz: [
        {
          q: "`SELECT DISTINCT country, city FROM customers` returns…",
          options: [
            "distinct countries, with one city picked at random",
            "distinct country/city combinations",
            "distinct countries and separately distinct cities",
            "an error — DISTINCT takes one column",
          ],
          answer: 1,
          explain: "DISTINCT always applies to the entire row that SELECT produces.",
        },
      ],
    },

    {
      id: "m1-order",
      title: "ORDER BY: sorting results",
      goal: "Control row order, sort by several keys, and know where NULLs land.",
      keywords: ["order by", "asc", "desc", "sorting", "nulls last"],
      exercises: [
        {
          id: "m1-order-e1",
          prompt:
            "Show the **5 cheapest** products: `name` and `unit_price`, cheapest first. Break ties with `product_id` ascending.",
          starter: "SELECT name, unit_price\nFROM products;",
          solution:
            "SELECT name, unit_price FROM products ORDER BY unit_price ASC, product_id ASC LIMIT 5;",
          hints: [
            "Sort ascending with `ORDER BY unit_price` (ASC is the default).",
            "Cut the result down with `LIMIT 5`.",
          ],
          orderMatters: true,
        },
        {
          id: "m1-order-e2",
          prompt:
            "Return `customer_id`, `country` and `last_name` for all customers, sorted by `country` A→Z, then `last_name` A→Z, then `customer_id` ascending.",
          starter: "",
          solution:
            "SELECT customer_id, country, last_name FROM customers ORDER BY country, last_name, customer_id;",
          hints: [
            "Extra sort keys go after a comma and break ties, left to right.",
            "The customers with no country recorded sort first in SQLite — that is expected.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "Why can `ORDER BY` use a SELECT alias everywhere, while `WHERE` cannot in most databases?",
          options: [
            "It is an arbitrary rule of the SQL standard",
            "WHERE runs before the SELECT list is computed; ORDER BY runs after it",
            "Aliases only exist in sorting contexts",
            "WHERE can use aliases in every database",
          ],
          answer: 1,
          explain:
            "Execution order is roughly FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. By the time ORDER BY runs, the alias exists.",
        },
      ],
    },

    {
      id: "m1-limit",
      title: "LIMIT and OFFSET",
      goal: "Answer top-N questions and page through results.",
      keywords: ["limit", "offset", "pagination", "top n"],
      exercises: [
        {
          id: "m1-limit-e1",
          prompt:
            "Return the **3rd and 4th most expensive** products (`name`, `unit_price`). Sort by price descending, tie-broken by `product_id` ascending.",
          starter: "SELECT name, unit_price\nFROM products\nORDER BY unit_price DESC, product_id;",
          solution:
            "SELECT name, unit_price FROM products ORDER BY unit_price DESC, product_id LIMIT 2 OFFSET 2;",
          hints: [
            "Skip the first two rows, then take two.",
            "`LIMIT 2 OFFSET 2`.",
          ],
          orderMatters: true,
        },
        {
          id: "m1-limit-e2",
          prompt:
            "Who joined most recently? Return `customer_id` and `signup_date` for the 10 newest customers, newest first, tie-broken by `customer_id` ascending.",
          starter: "",
          solution:
            "SELECT customer_id, signup_date FROM customers ORDER BY signup_date DESC, customer_id ASC LIMIT 10;",
          hints: [
            "Dates are stored as text in `YYYY-MM-DD`, so sorting them alphabetically sorts them chronologically.",
            "Newest first means `DESC`.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "`SELECT name FROM products LIMIT 5;` returns…",
          options: [
            "the 5 cheapest products",
            "the first 5 products added to the table",
            "5 arbitrary products — without ORDER BY the choice is not defined",
            "an error",
          ],
          answer: 2,
          explain:
            "Row order is not guaranteed without ORDER BY. It may look stable today and change when an index or the data changes.",
        },
      ],
    },

    {
      id: "m1-style",
      title: "Comments, style and clause order",
      goal: "Write queries other people (and future you) can read — and memorise the clause order.",
      keywords: ["comments", "style", "clause order", "logical order", "formatting"],
      exercises: [
        {
          id: "m1-style-e1",
          prompt:
            "The 5 products with the **most units in stock**: return `name`, `units_in_stock`, and `stock_value` (units × price, rounded to 2 dp). Sort by units in stock descending, tie-broken by `product_id` ascending.",
          starter: "-- build it one clause at a time, running as you go\nSELECT name, units_in_stock\nFROM products;",
          solution:
            "SELECT name, units_in_stock, ROUND(units_in_stock * unit_price, 2) AS stock_value\nFROM products\nORDER BY units_in_stock DESC, product_id\nLIMIT 5;",
          hints: [
            "Start from the plain SELECT, add ORDER BY, then LIMIT.",
            "The computed column needs an alias: `AS stock_value`.",
          ],
          orderMatters: true,
          checkColumnNames: true,
        },
        {
          id: "m1-style-e2",
          prompt:
            "Pagination practice: return **page 3** of the customer list with 10 customers per page. Columns `customer_id`, `last_name`, `first_name`; sort by `last_name`, then `first_name`, then `customer_id`.",
          starter: "",
          solution:
            "SELECT customer_id, last_name, first_name\nFROM customers\nORDER BY last_name, first_name, customer_id\nLIMIT 10 OFFSET 20;",
          hints: [
            "Page 3 with page size 10 skips the first 20 rows.",
            "`LIMIT 10 OFFSET 20`.",
          ],
          orderMatters: true,
        },
      ],
      quiz: [
        {
          q: "Which clause order is valid SQL?",
          options: [
            "SELECT … FROM … ORDER BY … WHERE …",
            "SELECT … FROM … WHERE … ORDER BY … LIMIT …",
            "FROM … SELECT … WHERE …",
            "SELECT … WHERE … FROM …",
          ],
          answer: 1,
          explain:
            "Written order is fixed: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT. Execution order differs, but what you type must follow this sequence.",
        },
      ],
    },
  ],
};
