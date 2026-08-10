import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "crm_saas",
  password: process.env.PGPASSWORD || "crm2n_saas_2026",
  database: process.env.PGDATABASE || "crm_saas",
  max: 20,
});

export const q = (text: string, params?: any[]) => pool.query(text, params);

/** Sequential, permanent, human-readable IDs: CUS-000001, PED-2026-000123, etc. */
export async function genId(prefix: string, seqName: string): Promise<string> {
  if (seqName.includes("YYYY")) {
    const year = new Date().getFullYear();
    const { rows } = await q(
      `INSERT INTO sequences (name, value) VALUES ($1, 1)
       ON CONFLICT (name) DO UPDATE SET value = sequences.value + 1
       RETURNING value`,
      [seqName.replace("YYYY", String(year))]
    );
    return `${prefix}-${year}-${String(rows[0].value).padStart(6, "0")}`;
  }
  const { rows } = await q(
    `INSERT INTO sequences (name, value) VALUES ($1, 1)
     ON CONFLICT (name) DO UPDATE SET value = sequences.value + 1
     RETURNING value`,
    [seqName]
  );
  return `${prefix}-${String(rows[0].value).padStart(6, "0")}`;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS sequences (
  name TEXT PRIMARY KEY,
  value INT NOT NULL DEFAULT 0
);

-- ============ IDENTIDADE ============
CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nif TEXT,
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  company_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nif TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_companies (
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE CASCADE,
  company_id TEXT REFERENCES companies(company_id) ON DELETE CASCADE,
  role TEXT DEFAULT 'contacto',
  PRIMARY KEY (customer_id, company_id)
);

-- ============ COMUNICAÇÃO ============
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  channel TEXT,
  last_message TEXT,
  last_message_time TEXT,
  unread_count INT DEFAULT 0,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  sender TEXT,
  text TEXT,
  timestamp TEXT,
  status TEXT,
  seq SERIAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ PEDIDO (entidade central) ============
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES conversations(conversation_id) ON DELETE SET NULL,
  quote_id TEXT,
  invoice_id TEXT,
  payment_id TEXT,
  production_id TEXT,
  file_ids TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'NOVO',
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ ORÇAMENTOS ============
CREATE TABLE IF NOT EXISTS quotes (
  quote_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  code TEXT,
  client_name TEXT,
  company TEXT,
  status TEXT DEFAULT 'Rascunho',
  total_geral NUMERIC DEFAULT 0,
  date TEXT,
  due_date TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ DOCUMENTOS / FACTURAÇÃO ============
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  document_type TEXT,
  document_number TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'Emitido',
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ PAGAMENTOS / CONTA CORRENTE ============
CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  amount NUMERIC DEFAULT 0,
  method TEXT,
  status TEXT DEFAULT 'Pendente',
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_statements (
  id SERIAL PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  order_id TEXT,
  ref_type TEXT,
  ref_id TEXT,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ PRODUÇÃO ============
CREATE TABLE IF NOT EXISTS production_orders (
  production_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  product_description TEXT,
  stage TEXT DEFAULT 'PEDIDO',
  due_date TEXT,
  status_badge TEXT,
  quality_status TEXT DEFAULT 'PENDENTE',
  quality_note TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_files (
  file_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  production_id TEXT REFERENCES production_orders(production_id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(company_id) ON DELETE SET NULL,
  name TEXT,
  mime_type TEXT,
  size TEXT,
  storage_url TEXT,
  uploaded_at TEXT,
  uploaded_by TEXT,
  status TEXT DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ SUPORTE (mantido) ============
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(order_id) ON DELETE SET NULL,
  title TEXT,
  completed BOOLEAN DEFAULT FALSE,
  due_date TEXT,
  doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  title TEXT, subtitle TEXT, time_ago TEXT, type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY, title TEXT, subtitle TEXT, type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY, name TEXT, description TEXT, is_active BOOLEAN DEFAULT TRUE,
  leads_count INT DEFAULT 0, doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_settings (
  id INT PRIMARY KEY DEFAULT 1, doc JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications_log (
  id SERIAL PRIMARY KEY, channel TEXT, target TEXT, subject TEXT, body TEXT, status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Legacy tables kept for backward compatibility (will be migrated/removed later)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, phone TEXT, email TEXT, segment TEXT,
  last_purchase TEXT, total_spent NUMERIC DEFAULT 0, orders_count INT DEFAULT 0, manager TEXT,
  status TEXT DEFAULT 'Ativo', is_vip BOOLEAN DEFAULT FALSE, doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY, title TEXT, company TEXT, service TEXT, estimated_value NUMERIC DEFAULT 0,
  stage TEXT DEFAULT 'NOVO', priority TEXT, doc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

export async function initSchema() {
  await q(SCHEMA);
}
