import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "crm_saas",
  password: process.env.PGPASSWORD || "crm2n_saas_2026",
  database: process.env.PGDATABASE || "crm_saas",
  max: 10,
});

export const q = (text: string, params?: any[]) => pool.query(text, params);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  segment TEXT,
  last_purchase TEXT,
  total_spent NUMERIC DEFAULT 0,
  orders_count INT DEFAULT 0,
  manager TEXT,
  status TEXT DEFAULT 'Ativo',
  is_vip BOOLEAN DEFAULT FALSE,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  service TEXT,
  estimated_value NUMERIC DEFAULT 0,
  stage TEXT DEFAULT 'NOVO',
  priority TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  client_name TEXT,
  company TEXT,
  channel TEXT,
  last_message TEXT,
  last_message_time TEXT,
  unread_count INT DEFAULT 0,
  stage TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT,
  text TEXT,
  timestamp TEXT,
  status TEXT,
  seq SERIAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_orders (
  id TEXT PRIMARY KEY,
  client_name TEXT,
  product_description TEXT,
  stage TEXT,
  due_date TEXT,
  status_badge TEXT,
  quality_status TEXT DEFAULT 'PENDENTE',
  quality_note TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_files (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES production_orders(id) ON DELETE CASCADE,
  name TEXT,
  size TEXT,
  type TEXT,
  url TEXT,
  uploaded_at TEXT,
  status TEXT DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  code TEXT,
  client_name TEXT,
  company TEXT,
  status TEXT,
  total_geral NUMERIC DEFAULT 0,
  date TEXT,
  due_date TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  kind TEXT DEFAULT 'fatura',
  code TEXT,
  client_name TEXT,
  status TEXT DEFAULT 'Pendente',
  total NUMERIC DEFAULT 0,
  date TEXT,
  due_date TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT,
  completed BOOLEAN DEFAULT FALSE,
  due_date TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  time_ago TEXT,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  leads_count INT DEFAULT 0,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_settings (
  id INT PRIMARY KEY DEFAULT 1,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications_log (
  id SERIAL PRIMARY KEY,
  channel TEXT,
  target TEXT,
  subject TEXT,
  body TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

export async function initSchema() {
  await q(SCHEMA);
}
