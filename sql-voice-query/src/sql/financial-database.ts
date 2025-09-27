// SmartSQL schema for financial database
export const createTables = async () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_spent DECIMAL(10,2) DEFAULT 0.00
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      launch_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`
  ];
  return statements;
};

// Mock data insertion - only inserts if tables are empty
export const insertMockData = async () => {
  const statements = [
    // Insert customers only if none exist
    `INSERT INTO customers (name, email, join_date, total_spent)
     SELECT 'John Doe', 'john@example.com', '2024-01-15', 1500.00
     WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'john@example.com')`,

    `INSERT INTO customers (name, email, join_date, total_spent)
     SELECT 'Jane Smith', 'jane@example.com', '2024-02-20', 890.50
     WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'jane@example.com')`,

    `INSERT INTO customers (name, email, join_date, total_spent)
     SELECT 'Mike Johnson', 'mike@example.com', '2023-12-10', 2100.75
     WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'mike@example.com')`,

    `INSERT INTO customers (name, email, join_date, total_spent)
     SELECT 'Sarah Wilson', 'sarah@example.com', '2024-03-05', 675.25
     WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'sarah@example.com')`,

    `INSERT INTO customers (name, email, join_date, total_spent)
     SELECT 'David Brown', 'david@example.com', '2024-01-28', 1250.00
     WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'david@example.com')`,

    // Insert products only if none exist
    `INSERT INTO products (name, category, price, launch_date)
     SELECT 'Business Software Pro', 'Software', 299.99, '2023-11-01'
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Business Software Pro')`,

    `INSERT INTO products (name, category, price, launch_date)
     SELECT 'Analytics Dashboard', 'Tools', 149.99, '2024-01-15'
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Analytics Dashboard')`,

    `INSERT INTO products (name, category, price, launch_date)
     SELECT 'Enterprise License', 'Software', 999.99, '2023-10-01'
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Enterprise License')`,

    `INSERT INTO products (name, category, price, launch_date)
     SELECT 'Data Backup Service', 'Services', 49.99, '2024-02-01'
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Data Backup Service')`,

    `INSERT INTO products (name, category, price, launch_date)
     SELECT 'Mobile App Premium', 'Software', 79.99, '2024-03-01'
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mobile App Premium')`,

    // Insert purchases only if customers and products exist and purchase doesn't exist
    `INSERT INTO purchases (customer_id, product_id, amount, purchase_date, quantity)
     SELECT 1, 1, 599.98, '2024-09-25', 2
     WHERE EXISTS (SELECT 1 FROM customers WHERE id = 1)
     AND EXISTS (SELECT 1 FROM products WHERE id = 1)
     AND NOT EXISTS (SELECT 1 FROM purchases WHERE customer_id = 1 AND product_id = 1 AND purchase_date = '2024-09-25')`,

    `INSERT INTO purchases (customer_id, product_id, amount, purchase_date, quantity)
     SELECT 2, 2, 149.99, '2024-09-24', 1
     WHERE EXISTS (SELECT 1 FROM customers WHERE id = 2)
     AND EXISTS (SELECT 1 FROM products WHERE id = 2)
     AND NOT EXISTS (SELECT 1 FROM purchases WHERE customer_id = 2 AND product_id = 2 AND purchase_date = '2024-09-24')`,

    `INSERT INTO purchases (customer_id, product_id, amount, purchase_date, quantity)
     SELECT 3, 3, 999.99, '2024-09-23', 1
     WHERE EXISTS (SELECT 1 FROM customers WHERE id = 3)
     AND EXISTS (SELECT 1 FROM products WHERE id = 3)
     AND NOT EXISTS (SELECT 1 FROM purchases WHERE customer_id = 3 AND product_id = 3 AND purchase_date = '2024-09-23')`,

    `INSERT INTO purchases (customer_id, product_id, amount, purchase_date, quantity)
     SELECT 1, 4, 49.99, '2024-09-20', 1
     WHERE EXISTS (SELECT 1 FROM customers WHERE id = 1)
     AND EXISTS (SELECT 1 FROM products WHERE id = 4)
     AND NOT EXISTS (SELECT 1 FROM purchases WHERE customer_id = 1 AND product_id = 4 AND purchase_date = '2024-09-20')`,

    `INSERT INTO purchases (customer_id, product_id, amount, purchase_date, quantity)
     SELECT 4, 5, 159.98, '2024-09-22', 2
     WHERE EXISTS (SELECT 1 FROM customers WHERE id = 4)
     AND EXISTS (SELECT 1 FROM products WHERE id = 5)
     AND NOT EXISTS (SELECT 1 FROM purchases WHERE customer_id = 4 AND product_id = 5 AND purchase_date = '2024-09-22')`,

    `INSERT INTO purchases (customer_id, product_id, amount, purchase_date, quantity)
     SELECT 5, 1, 299.99, '2024-09-21', 1
     WHERE EXISTS (SELECT 1 FROM customers WHERE id = 5)
     AND EXISTS (SELECT 1 FROM products WHERE id = 1)
     AND NOT EXISTS (SELECT 1 FROM purchases WHERE customer_id = 5 AND product_id = 1 AND purchase_date = '2024-09-21')`,

    // Update customer total_spent based on purchases
    `UPDATE customers SET total_spent = (
       SELECT COALESCE(SUM(amount), 0) FROM purchases WHERE customer_id = customers.id
     ) WHERE EXISTS (SELECT 1 FROM purchases WHERE customer_id = customers.id)`
  ];
  return statements;
};

export interface Customer {
  id: number;
  name: string;
  email: string;
  join_date: Date;
  total_spent: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  launch_date: Date;
}

export interface Purchase {
  id: number;
  customer_id: number;
  product_id: number;
  amount: number;
  purchase_date: Date;
  quantity: number;
}