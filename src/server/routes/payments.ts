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
      console.error("[payments]", req.method, req.path, (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  };

/** Methods of payment available in Angola for 2N Publicidade. */
export const PAYMENT_METHODS = ["Referencia", "Transferencia", "Express"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function assertMethod(method: any): PaymentMethod {
  const m = String(method || "").trim();
  if ((PAYMENT_METHODS as readonly string[]).includes(m)) return m as PaymentMethod;
  throw new Error(
    `method inválido: '${m}'. Use um de: ${PAYMENT_METHODS.join(", ")}`
  );
}

/** Generate a human-readable reference number for the chosen method. */
function genReference(method: PaymentMethod): string {
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.floor(1000 + Math.random() * 9000);
  switch (method) {
    case "Referencia": // Multibanco / EMIS-style payment reference
      return `EMIS-${ts}${rnd}`;
    case "Transferencia": // bank transfer reference
      return `TRF-${ts}${rnd}`;
    case "Express": // Unitel/Airtel Express money reference
      return `EXP-${ts}${rnd}`;
    default:
      return `REF-${ts}${rnd}`;
  }
}

async function getOrder(orderId: string) {
  const { rows } = await q(`SELECT * FROM orders WHERE order_id=$1`, [orderId]);
  return rows[0] || null;
}

/**
 * Resolve the amount to charge for an order.
 * Automation-ready: the amount surfaced to the client (proforma / WhatsApp)
 * MUST equal the amount later minted by Pay4all. We derive it from the
 * order's latest quote total_geral (fallback: latest invoice total).
 */
async function getOrderChargeAmount(orderId: string): Promise<number> {
  const { rows: q } = await q(
    `SELECT total_geral FROM quotes WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  if (q[0]?.total_geral != null) return Number(q[0].total_geral);

  const { rows: iv } = await q(
    `SELECT total FROM invoices WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  if (iv[0]?.total != null) return Number(iv[0].total);

  throw new Error("order sem orçamento nem factura — impossível derivar o valor do pagamento");
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

/**
 * PAY4ALL integration point (PENDING — awaiting Sr Mauro's API).
 *
 * TODO(PAY4ALL): substituir o stub abaixo por uma chamada real à API Pay4all:
 *   - input:  { amount, order_id, method, reference }
 *   - output: { pay4all_reference, expires_at, entity?, ... }
 * O valor `amount` passado AQUI é o mesmo total_geral do orçamento, garantindo
 * que o valor mostrado ao cliente (proforma/WhatsApp) == valor da referência Pay4all.
 */
async function mintPay4allReference(_opts: {
  amount: number;
  order_id: string;
  reference: string;
  method: string;
}): Promise<{ pending: true; note: string; pay4all_reference: null }> {
  // TODO(PAY4ALL): await pay4allClient.createReference({ ..._opts })
  return { pending: true, note: "aguardando API Pay4all", pay4all_reference: null };
}

/* ----------------------- PAYMENT METHODS INFO ----------------------- */

// GET /api/payments/methods
// Documentation endpoint: the 3 Angolan methods and the Pay4all pending status.
r.get("/methods", wrap(async (_req, res) => {
  res.json({ methods: [...PAYMENT_METHODS], pay4all: "pending_api" });
}));

/* ----------------------------- LISTING ----------------------------- */

// GET /api/payments
r.get("/", wrap(async (_req, res) => {
  const { rows } = await q(
    `SELECT p.*, o.status AS order_status,
            c.name AS customer_name, co.name AS company_name
       FROM payments p
       LEFT JOIN orders o ON o.order_id = p.order_id
       LEFT JOIN customers c ON c.customer_id = p.customer_id
       LEFT JOIN companies co ON co.company_id = p.company_id
      ORDER BY p.created_at DESC`
  );
  res.json(rows.map((x: any) => ({
    ...(x.doc || {}),
    payment_id: x.payment_id,
    order_id: x.order_id,
    customer_id: x.customer_id,
    company_id: x.company_id,
    customer_name: x.customer_name,
    company_name: x.company_name,
    order_status: x.order_status,
    amount: x.amount != null ? Number(x.amount) : null,
    method: x.method,
    status: x.status,
    reference: x.doc?.reference || null,
    pay4all_reference: x.doc?.pay4all_reference || null,
    created_at: x.created_at,
  })));
}));

// GET /api/payments/:id
r.get("/:id", wrap(async (req, res) => {
  const { rows } = await q(`SELECT * FROM payments WHERE payment_id=$1`, [req.params.id]);
  const p = rows[0];
  if (!p) return res.status(404).json({ error: "payment not found" });
  res.json({
    ...(p.doc || {}),
    payment_id: p.payment_id,
    order_id: p.order_id,
    customer_id: p.customer_id,
    company_id: p.company_id,
    amount: p.amount != null ? Number(p.amount) : null,
    method: p.method,
    status: p.status,
    reference: p.doc?.reference || null,
    pay4all_reference: p.doc?.pay4all_reference || null,
    created_at: p.created_at,
  });
}));

/* --------------------------- GENERATE ----------------------------- */

// POST /api/payments/generate
// body: { order_id, method }
// Derives the exact charge amount from the order's latest quote/invoice total,
// creates a PAG- payment row, (stub) mints a Pay4all reference with that exact
// amount, and posts a credit to the account statement.
r.post("/generate", wrap(async (req, res) => {
  const b = req.body || {};
  const orderId = String(b.order_id || "").trim();
  if (!orderId) return res.status(400).json({ error: "order_id é obrigatório" });

  const order = await getOrder(orderId);
  if (!order) return res.status(404).json({ error: "order not found" });

  const method = assertMethod(b.method);
  const amount = await getOrderChargeAmount(orderId);
  const reference = genReference(method);

  const payment_id = await genId("PAG", "payments");

  // TODO(PAY4ALL): mint a reference with the EXACT `amount` (amount-equality automation).
  const pay4all = await mintPay4allReference({
    amount,
    order_id: orderId,
    reference,
    method,
  });

  const { rows } = await q(
    `INSERT INTO payments (payment_id,order_id,customer_id,company_id,amount,method,status,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [payment_id, order.order_id, order.customer_id, order.company_id, amount,
     method, b.status || "Pendente",
     JSON.stringify({
       reference,
       pay4all_reference: pay4all.pay4all_reference,
       pay4all_pending: pay4all.pending,
       method,
       source: "generate",
     })]
  );

  // link the payment back to the order
  await q(`UPDATE orders SET payment_id=$2 WHERE order_id=$1`, [order.order_id, payment_id]);

  // conta corrente: pagamento = crédito do cliente (reduz o saldo em dívida)
  const entry = await addStatement({
    customer_id: order.customer_id,
    company_id: order.company_id,
    order_id: order.order_id,
    ref_type: "payment",
    ref_id: payment_id,
    debit: 0,
    credit: amount,
  });

  res.json({
    payment_id,
    order_id: order.order_id,
    amount,
    reference,
    method,
    status: b.status || "Pendente",
    pay4all_pending: true,
    pay4all_reference: null,
    statement: entry,
  });
}));

/* ----------------------- PAY4ALL REFERENCE STUB -------------------- */

// POST /api/payments/:id/pay4all-reference
// Stub for the future Pay4all API. Returns a pending shape today; the
// TODO(PAY4ALL) body inside is where the real reference will be minted.
r.post("/:id/pay4all-reference", wrap(async (req, res) => {
  const { rows } = await q(`SELECT * FROM payments WHERE payment_id=$1`, [req.params.id]);
  const p = rows[0];
  if (!p) return res.status(404).json({ error: "payment not found" });

  // TODO(PAY4ALL): chamar API Pay4all com p.amount (derivado do orçamento) para
  // gerar a referência. O valor da referência será === p.amount por construção.
  const pay4all_reference: string | null = null;
  if (pay4all_reference) {
    await q(`UPDATE payments SET doc=jsonb_set(doc,'{pay4all_reference}',to_jsonb($2::text)) WHERE payment_id=$1`,
      [p.payment_id, pay4all_reference]);
  }

  res.json({
    payment_id: p.payment_id,
    amount: p.amount != null ? Number(p.amount) : null,
    pending: true,
    note: "aguardando API Pay4all",
    pay4all_reference,
  });
}));

export default r;
