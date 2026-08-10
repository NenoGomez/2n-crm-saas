import { Router } from "express";
import { q, genId } from "../db";

const r = Router();

/* ----------------------------- helpers ----------------------------- */
const wrap =
  (fn: (req: any, res: any) => Promise<any>) =>
  async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (e) {
      console.error("[orders]", req.method, req.path, (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  };

const today = () => new Date().toISOString().slice(0, 10);

/** ABC LDA -> ABC_LDA ; strips accents/punctuation, uppercase */
export function sanitizeName(name: string): string {
  return String(name || "CLIENTE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "CLIENTE";
}

/** ABC_LDA_PED-2026-000123_FAT-2026-000091 */
export function buildDocNumber(companyOrName: string, orderId: string, docId: string): string {
  return [sanitizeName(companyOrName), orderId, docId].filter(Boolean).join("_");
}

/** Resolve or create a customer: match by phone, then nif, then name. */
async function resolveCustomer(c: any): Promise<string | null> {
  if (!c) return null;
  if (typeof c === "string") return c;
  if (c.customer_id) return c.customer_id;
  if (!c.name && !c.phone && !c.nif) return null;
  let found: any;
  if (c.phone) found = (await q(`SELECT customer_id FROM customers WHERE phone=$1 LIMIT 1`, [c.phone])).rows[0];
  if (!found && c.nif) found = (await q(`SELECT customer_id FROM customers WHERE nif=$1 LIMIT 1`, [c.nif])).rows[0];
  if (!found && c.name) found = (await q(`SELECT customer_id FROM customers WHERE lower(name)=lower($1) LIMIT 1`, [c.name])).rows[0];
  if (found) {
    await q(
      `UPDATE customers SET name=COALESCE($2,name), phone=COALESCE($3,phone),
         email=COALESCE($4,email), nif=COALESCE($5,nif) WHERE customer_id=$1`,
      [found.customer_id, c.name || null, c.phone || null, c.email || null, c.nif || null]
    );
    return found.customer_id;
  }
  const id = await genId("CUS", "customers");
  await q(
    `INSERT INTO customers (customer_id,name,phone,email,nif,status) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, c.name || c.phone || id, c.phone || null, c.email || null, c.nif || null, c.status || "Ativo"]
  );
  return id;
}

/** Resolve or create a company: match by nif, then name. */
async function resolveCompany(co: any): Promise<string | null> {
  if (!co) return null;
  if (typeof co === "string") {
    if (/^COM-/.test(co)) return co;
    co = { name: co };
  }
  if (co.company_id) return co.company_id;
  if (!co.name && !co.nif) return null;
  let found: any;
  if (co.nif) found = (await q(`SELECT company_id FROM companies WHERE nif=$1 LIMIT 1`, [co.nif])).rows[0];
  if (!found && co.name) found = (await q(`SELECT company_id FROM companies WHERE lower(name)=lower($1) LIMIT 1`, [co.name])).rows[0];
  if (found) return found.company_id;
  const id = await genId("COM", "companies");
  await q(`INSERT INTO companies (company_id,name,nif) VALUES ($1,$2,$3)`, [id, co.name || id, co.nif || null]);
  return id;
}

async function linkCustomerCompany(customerId: string | null, companyId: string | null, role = "contacto") {
  if (!customerId || !companyId) return;
  await q(
    `INSERT INTO customer_companies (customer_id,company_id,role) VALUES ($1,$2,$3)
     ON CONFLICT (customer_id, company_id) DO NOTHING`,
    [customerId, companyId, role]
  );
}

async function getOrder(orderId: string) {
  const { rows } = await q(`SELECT * FROM orders WHERE order_id=$1`, [orderId]);
  return rows[0] || null;
}

/** Display label for document naming: company name, else customer name. */
async function labelFor(order: any): Promise<string> {
  if (order?.company_id) {
    const { rows } = await q(`SELECT name FROM companies WHERE company_id=$1`, [order.company_id]);
    if (rows[0]?.name) return rows[0].name;
  }
  if (order?.customer_id) {
    const { rows } = await q(`SELECT name FROM customers WHERE customer_id=$1`, [order.customer_id]);
    if (rows[0]?.name) return rows[0].name;
  }
  return "CLIENTE";
}

/** Append a conta-corrente entry with running balance for the customer. */
async function addStatement(opts: {
  customer_id?: string | null;
  company_id?: string | null;
  order_id?: string | null;
  ref_type: string;
  ref_id: string;
  debit?: number;
  credit?: number;
}) {
  const debit = Number(opts.debit || 0);
  const credit = Number(opts.credit || 0);
  const { rows } = await q(
    `SELECT COALESCE(balance,0) AS balance FROM account_statements
     WHERE customer_id IS NOT DISTINCT FROM $1 ORDER BY id DESC LIMIT 1`,
    [opts.customer_id || null]
  );
  const prev = Number(rows[0]?.balance || 0);
  const balance = prev + debit - credit;
  const ins = await q(
    `INSERT INTO account_statements (customer_id,company_id,order_id,ref_type,ref_id,debit,credit,balance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [opts.customer_id || null, opts.company_id || null, opts.order_id || null, opts.ref_type, opts.ref_id, debit, credit, balance]
  );
  return ins.rows[0];
}

/* ------------------------------ ORDERS ------------------------------ */

// GET /api/orders
r.get("/", wrap(async (_req, res) => {
  const { rows } = await q(`
    SELECT o.*,
           c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
           co.name AS company_name, co.nif AS company_nif,
           qt.quote_id AS q_id, qt.status AS quote_status, qt.total_geral AS quote_total,
           iv.invoice_id AS i_id, iv.status AS invoice_status, iv.total AS invoice_total, iv.kind AS invoice_kind,
           pr.production_id AS p_id, pr.stage AS production_stage,
           pay.payment_id AS pay_id, pay.amount AS payment_amount, pay.status AS payment_status
      FROM orders o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN companies co ON co.company_id = o.company_id
      LEFT JOIN LATERAL (SELECT * FROM quotes WHERE order_id=o.order_id ORDER BY created_at DESC LIMIT 1) qt ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM invoices WHERE order_id=o.order_id ORDER BY created_at DESC LIMIT 1) iv ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM production_orders WHERE order_id=o.order_id ORDER BY created_at DESC LIMIT 1) pr ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM payments WHERE order_id=o.order_id ORDER BY created_at DESC LIMIT 1) pay ON TRUE
     ORDER BY o.created_at DESC`);
  res.json(rows.map((o: any) => ({
    ...(o.doc || {}),
    order_id: o.order_id,
    customer_id: o.customer_id,
    company_id: o.company_id,
    conversation_id: o.conversation_id,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    company_name: o.company_name,
    status: o.status,
    file_ids: o.file_ids || [],
    quote_id: o.quote_id || o.q_id || null,
    quote_status: o.quote_status || null,
    quote_total: o.quote_total != null ? Number(o.quote_total) : null,
    invoice_id: o.invoice_id || o.i_id || null,
    invoice_kind: o.invoice_kind || null,
    invoice_status: o.invoice_status || null,
    invoice_total: o.invoice_total != null ? Number(o.invoice_total) : null,
    production_id: o.production_id || o.p_id || null,
    production_stage: o.production_stage || null,
    payment_id: o.payment_id || o.pay_id || null,
    payment_amount: o.payment_amount != null ? Number(o.payment_amount) : null,
    payment_status: o.payment_status || null,
    created_at: o.created_at,
  })));
}));

// POST /api/orders
r.post("/", wrap(async (req, res) => {
  const b = req.body || {};
  const customer_id = await resolveCustomer(b.customer || b.customer_id || null);
  const company_id = await resolveCompany(b.company || b.company_id || null);
  await linkCustomerCompany(customer_id, company_id);

  const order_id = b.order_id || (await genId("PED", "orders-YYYY"));
  const doc = b.doc || { description: b.description || null, source: b.source || null };
  await q(
    `INSERT INTO orders (order_id,customer_id,company_id,conversation_id,status,doc)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (order_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,
       company_id=EXCLUDED.company_id, conversation_id=EXCLUDED.conversation_id, doc=EXCLUDED.doc`,
    [order_id, customer_id, company_id, b.conversation_id || null, b.status || "NOVO", JSON.stringify(doc)]
  );
  if (b.conversation_id) {
    await q(
      `UPDATE conversations SET customer_id=COALESCE($2,customer_id), company_id=COALESCE($3,company_id)
       WHERE conversation_id=$1`,
      [b.conversation_id, customer_id, company_id]
    );
  }
  res.json({ order_id, customer_id, company_id, status: b.status || "NOVO" });
}));

// GET /api/orders/:id  (full aggregate)
r.get("/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const order = await getOrder(id);
  if (!order) return res.status(404).json({ error: "order not found" });

  const [cust, comp, conv, quotes, invoices, payments, prod, files, docs, stmt] = await Promise.all([
    order.customer_id ? q(`SELECT * FROM customers WHERE customer_id=$1`, [order.customer_id]) : Promise.resolve({ rows: [] } as any),
    order.company_id ? q(`SELECT * FROM companies WHERE company_id=$1`, [order.company_id]) : Promise.resolve({ rows: [] } as any),
    order.conversation_id ? q(`SELECT * FROM conversations WHERE conversation_id=$1`, [order.conversation_id]) : Promise.resolve({ rows: [] } as any),
    q(`SELECT * FROM quotes WHERE order_id=$1 ORDER BY created_at ASC`, [id]),
    q(`SELECT * FROM invoices WHERE order_id=$1 ORDER BY created_at ASC`, [id]),
    q(`SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at ASC`, [id]),
    q(`SELECT * FROM production_orders WHERE order_id=$1 ORDER BY created_at ASC`, [id]),
    q(`SELECT * FROM production_files WHERE order_id=$1 ORDER BY created_at ASC`, [id]),
    q(`SELECT * FROM documents WHERE order_id=$1 ORDER BY created_at ASC`, [id]),
    q(`SELECT * FROM account_statements WHERE order_id=$1 ORDER BY id ASC`, [id]),
  ]);

  res.json({
    order: { ...(order.doc || {}), ...order },
    customer: cust.rows[0] || null,
    company: comp.rows[0] || null,
    conversation: conv.rows[0] || null,
    quotes: quotes.rows,
    quote: quotes.rows[quotes.rows.length - 1] || null,
    invoices: invoices.rows,
    invoice: invoices.rows[invoices.rows.length - 1] || null,
    payments: payments.rows,
    payment: payments.rows[payments.rows.length - 1] || null,
    production: prod.rows[0] || null,
    files: files.rows,
    documents: docs.rows,
    account_statements: stmt.rows,
  });
}));

// PUT /api/orders/:id
r.put("/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const order = await getOrder(id);
  if (!order) return res.status(404).json({ error: "order not found" });
  const b = req.body || {};

  const sets: string[] = [];
  const vals: any[] = [id];
  const set = (col: string, val: any) => { vals.push(val); sets.push(`${col}=$${vals.length}`); };

  for (const col of ["status", "quote_id", "invoice_id", "payment_id", "production_id", "conversation_id", "customer_id", "company_id"]) {
    if (b[col] !== undefined) set(col, b[col]);
  }
  if (b.doc !== undefined) set("doc", JSON.stringify({ ...(order.doc || {}), ...b.doc }));
  if (b.file_ids !== undefined || b.file_id !== undefined) {
    const incoming: string[] = b.file_id ? [b.file_id] : (Array.isArray(b.file_ids) ? b.file_ids : []);
    const merged = Array.from(new Set([...(order.file_ids || []), ...incoming]));
    set("file_ids", merged);
  }
  if (!sets.length) return res.json({ ...order });

  const { rows } = await q(`UPDATE orders SET ${sets.join(", ")} WHERE order_id=$1 RETURNING *`, vals);
  res.json(rows[0]);
}));

/* ------------------------------ QUOTES ------------------------------ */

// POST /api/orders/:id/quote
r.post("/:id/quote", wrap(async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  const b = req.body || {};
  const quote_id = await genId("ORC", "quotes-YYYY");
  const label = await labelFor(order);
  const total = Number(b.total_geral ?? b.total ?? 0);
  const { rows } = await q(
    `INSERT INTO quotes (quote_id,order_id,customer_id,company_id,code,client_name,company,status,total_geral,date,due_date,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [quote_id, order.order_id, order.customer_id, order.company_id,
     b.code || quote_id, b.client_name || label, b.company || label,
     b.status || "Rascunho", total, b.date || today(), b.due_date || null,
     JSON.stringify(b.doc || { items: b.items || [] })]
  );
  await q(`UPDATE orders SET quote_id=$2 WHERE order_id=$1`, [order.order_id, quote_id]);
  res.json(rows[0]);
}));

// PUT /api/orders/:id/quote/:qid
r.put("/:id/quote/:qid", wrap(async (req, res) => {
  const b = req.body || {};
  const cur = (await q(`SELECT * FROM quotes WHERE quote_id=$1 AND order_id=$2`, [req.params.qid, req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: "quote not found" });
  const { rows } = await q(
    `UPDATE quotes SET status=COALESCE($3,status), total_geral=COALESCE($4,total_geral),
       due_date=COALESCE($5,due_date), client_name=COALESCE($6,client_name), code=COALESCE($7,code),
       doc=$8 WHERE quote_id=$1 AND order_id=$2 RETURNING *`,
    [req.params.qid, req.params.id, b.status ?? null,
     b.total_geral ?? b.total ?? null, b.due_date ?? null, b.client_name ?? null, b.code ?? null,
     JSON.stringify({ ...(cur.doc || {}), ...(b.doc || {}) })]
  );
  res.json(rows[0]);
}));

/* ----------------------------- INVOICES ----------------------------- */
const INVOICE_SEQ: Record<string, [string, string]> = {
  fatura: ["FAT", "invoices-YYYY"],
  recibo: ["REC", "recibos-YYYY"],
  guia: ["GR", "guias-YYYY"],
};

// POST /api/orders/:id/invoice   body: { kind: fatura|recibo|guia, total, ... }
r.post("/:id/invoice", wrap(async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  const b = req.body || {};
  const kind = String(b.kind || "fatura").toLowerCase();
  const [prefix, seq] = INVOICE_SEQ[kind] || INVOICE_SEQ.fatura;
  const invoice_id = await genId(prefix, seq);
  const label = await labelFor(order);
  const total = Number(b.total ?? 0);

  // TODO(AGT): integrar comunicação com a AGT (Administração Geral Tributária)
  // — assinatura digital do documento, hash encadeado e submissão SAF-T(AO).
  // Ponto de integração: aqui, após persistir a factura e antes de devolver a resposta.

  const { rows } = await q(
    `INSERT INTO invoices (invoice_id,order_id,customer_id,company_id,kind,code,client_name,status,total,date,due_date,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [invoice_id, order.order_id, order.customer_id, order.company_id, kind,
     b.code || invoice_id, b.client_name || label, b.status || "Pendente", total,
     b.date || today(), b.due_date || null, JSON.stringify(b.doc || { items: b.items || [] })]
  );
  await q(`UPDATE orders SET invoice_id=$2 WHERE order_id=$1`, [order.order_id, invoice_id]);

  // conta corrente: factura = débito do cliente (recibo/guia não debitam)
  if (kind === "fatura" && total > 0) {
    await addStatement({
      customer_id: order.customer_id, company_id: order.company_id, order_id: order.order_id,
      ref_type: "invoice", ref_id: invoice_id, debit: total, credit: 0,
    });
  }
  res.json(rows[0]);
}));

// PUT /api/orders/:id/invoice/:iid
r.put("/:id/invoice/:iid", wrap(async (req, res) => {
  const b = req.body || {};
  const cur = (await q(`SELECT * FROM invoices WHERE invoice_id=$1 AND order_id=$2`, [req.params.iid, req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: "invoice not found" });
  const { rows } = await q(
    `UPDATE invoices SET status=COALESCE($3,status), total=COALESCE($4,total),
       due_date=COALESCE($5,due_date), doc=$6 WHERE invoice_id=$1 AND order_id=$2 RETURNING *`,
    [req.params.iid, req.params.id, b.status ?? null, b.total ?? null, b.due_date ?? null,
     JSON.stringify({ ...(cur.doc || {}), ...(b.doc || {}) })]
  );
  res.json(rows[0]);
}));

/* ---------------------------- DOCUMENTS ----------------------------- */

// POST /api/orders/:id/document
r.post("/:id/document", wrap(async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  const b = req.body || {};
  const document_id = await genId("DOC", "documents");
  const label = await labelFor(order);
  // ex: ABC_LDA_PED-2026-000123_FAT-2026-000091
  const document_number = b.document_number || buildDocNumber(label, order.order_id, b.ref_id || b.invoice_id || b.quote_id || document_id);
  const { rows } = await q(
    `INSERT INTO documents (document_id,order_id,customer_id,company_id,document_type,document_number,file_url,status,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [document_id, order.order_id, order.customer_id, order.company_id,
     (b.document_type || "proforma").toLowerCase(), document_number, b.file_url || null,
     b.status || "Emitido", JSON.stringify(b.doc || {})]
  );
  res.json(rows[0]);
}));

// GET /api/orders/:id/documents
r.get("/:id/documents", wrap(async (req, res) => {
  const { rows } = await q(`SELECT * FROM documents WHERE order_id=$1 ORDER BY created_at ASC`, [req.params.id]);
  res.json(rows);
}));

/* ----------------------------- PAYMENTS ----------------------------- */

// POST /api/orders/:id/payment
r.post("/:id/payment", wrap(async (req, res) => {
  const order = await getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "order not found" });
  const b = req.body || {};
  const payment_id = await genId("PAG", "payments");
  const amount = Number(b.amount || 0);
  const { rows } = await q(
    `INSERT INTO payments (payment_id,order_id,customer_id,company_id,amount,method,status,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [payment_id, order.order_id, order.customer_id, order.company_id, amount,
     b.method || "Transferência", b.status || "Confirmado", JSON.stringify(b.doc || {})]
  );
  await q(`UPDATE orders SET payment_id=$2 WHERE order_id=$1`, [order.order_id, payment_id]);
  const entry = await addStatement({
    customer_id: order.customer_id, company_id: order.company_id, order_id: order.order_id,
    ref_type: "payment", ref_id: payment_id, debit: 0, credit: amount,
  });
  res.json({ ...rows[0], statement: entry });
}));

// GET /api/orders/:id/payments
r.get("/:id/payments", wrap(async (req, res) => {
  const { rows } = await q(`SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at ASC`, [req.params.id]);
  res.json(rows);
}));

/* -------------------------- CONTA CORRENTE -------------------------- */
const withRunning = (rows: any[]) => {
  let bal = 0;
  return rows.map((e) => {
    bal += Number(e.debit || 0) - Number(e.credit || 0);
    return { ...e, debit: Number(e.debit || 0), credit: Number(e.credit || 0), running_balance: bal };
  });
};

// GET /api/orders/:id/statement
r.get("/:id/statement", wrap(async (req, res) => {
  const { rows } = await q(
    `SELECT * FROM account_statements WHERE order_id=$1 ORDER BY created_at ASC, id ASC`,
    [req.params.id]
  );
  const entries = withRunning(rows);
  res.json({ order_id: req.params.id, entries, balance: entries.length ? entries[entries.length - 1].running_balance : 0 });
}));

// GET /api/orders/customer/:cid/statement   (mounted under /orders)
r.get("/customer/:cid/statement", wrap(async (req, res) => {
  const { rows } = await q(
    `SELECT * FROM account_statements WHERE customer_id=$1 ORDER BY created_at ASC, id ASC`,
    [req.params.cid]
  );
  const entries = withRunning(rows);
  res.json({ customer_id: req.params.cid, entries, balance: entries.length ? entries[entries.length - 1].running_balance : 0 });
}));

export default r;
