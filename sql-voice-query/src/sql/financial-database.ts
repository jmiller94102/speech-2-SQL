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