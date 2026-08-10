import { Router } from "express";
import { spawn } from "child_process";
import { q, genId } from "../db";
import * as AI from "../ai";

const r = Router();

const wrap =
  (fn: (req: any, res: any) => Promise<any>) =>
  async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (e) {
      console.error("[whatsapp]", req.method, req.path, (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  };

const today = () => new Date().toISOString().slice(0, 10);

/** Resolve or create a customer by phone -> nif -> name (reuses orders module logic). */
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
      `UPDATE customers SET name=COALESCE($2,name), phone=COALESCE($3,phone), email=COALESCE($4,email), nif=COALESCE($5,nif) WHERE customer_id=$1`,
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

/** Resolve or create a company by nif -> name. */
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

/** Send a WhatsApp message to a client via Chatwoot (rails runner). Non-blocking. */
function sendWhatsapp(clientName: string, body: string): Promise<string> {
  return new Promise((resolve) => {
    const script = "/root/crm-saas/notify_production.py";
    const cp = spawn("/usr/bin/python3", [script, "--client", String(clientName), "--message", `${body}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let b = "";
    const timer = setTimeout(() => { try { cp.kill("SIGKILL"); } catch {} }, 120000);
    cp.stdout.on("data", (d) => (b += d));
    cp.stderr.on("data", (d) => (b += d));
    cp.on("close", () => { clearTimeout(timer); resolve(b); });
  });
}

const normalizePhone = (p: string) => String(p || "").replace(/\D/g, "");

/** Extract structured lead data from free text using Hermes (OpenRouter). */
async function extractLead(text: string): Promise<any> {
  const prompt = `Analise a seguinte mensagem de um cliente da 2N Publicidade (Luanda, Angola).
Extraia um objeto JSON com estes campos exatos:
{ "intent": "compra" | "duvida" | "outro", "cliente": string, "empresa": string, "produto": string,
  "quantidade": number, "medidas": string, "preco": number, "prazo": string, "localizacao": string,
  "ficheiros": boolean, "observacoes": string, "pedido": string, "estado": string }
Mensagem: """${text}"""
Responda APENAS o JSON, sem comentários.`;
  const out = await AI.generate(prompt, true);
  if (out) {
    try {
      const m = out.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch {}
  }
  // Heuristic fallback
  const t = text.toLowerCase();
  const num = (t.match(/\d[\d.\s]*\d|\d/g) || []).join("");
  const intent = /(quero|preciso|comprar|fazer|orç|orc|banner|adesiv|impress|encomend|pedid)/.test(t) ? "compra" : "outro";
  return { intent, cliente: "", empresa: "", produto: t.includes("banner") ? "banner" : "", quantidade: num ? Number(num.replace(/\s/g, "")) : undefined, medidas: "", preco: undefined, prazo: "", localizacao: "", ficheiros: false, observacoes: text, pedido: "", estado: intent === "compra" ? "NOVO" : "" };
}

/* --------------------------- TEST EXTRACT --------------------------- */
r.get("/test-extract", wrap(async (req, res) => {
  const text = String(req.query.text || "");
  if (!text) return res.status(400).json({ error: "missing ?text=" });
  const data = await extractLead(text);
  res.json({ text, extracted: data });
}));

/* ----------------------------- WEBHOOK ----------------------------- */
r.post("/webhook", wrap(async (req, res) => {
  const b = req.body || {};
  // Chatwoot payload shapes vary; be tolerant.
  const conv = b.conversation || b.conversation_data || {};
  const contact = b.contact || b.sender || b.contact_data || {};
  const msg = b.message || b.content || b.message_data || {};
  const text = msg.content || msg.text || b.text || "";
  const phone = contact.phone || contact.phone_number || (contact.identifier || "");
  const name = contact.name || contact.full_name || "Cliente";
  const convId = String(conv.id ?? b.conversation_id ?? "");

  if (!text) return res.json({ ok: true, skipped: "no text" });

  // 1) customer + conversation
  const customer_id = await resolveCustomer({ name, phone, email: contact.email || null });
  if (convId) {
    await q(
      `INSERT INTO conversations (conversation_id, customer_id, channel, last_message, last_message_time, doc)
       VALUES ($1,$2,'whatsapp',$3,now(),$4)
       ON CONFLICT (conversation_id) DO NOTHING`,
      [convId, customer_id, String(text).slice(0, 500), JSON.stringify({ source: "chatwoot" })]
    );
    await q(
      `UPDATE conversations SET customer_id=COALESCE($2,customer_id), last_message=$3, last_message_time=now() WHERE conversation_id=$1`,
      [convId, customer_id, String(text).slice(0, 500)]
    );
    await q(
      `INSERT INTO chat_messages (id, conversation_id, sender, text, timestamp, status)
       VALUES ($1,$2,'client',$3,now(),'received') ON CONFLICT (id) DO NOTHING`,
      [`msg-${convId}-${Date.now()}`, convId, String(text)]
    );
  }

  // 2) Hermes extraction
  const lead = await extractLead(text);

  // 3) If purchase intent -> create/update order + optional quote
  let order_id: string | null = null;
  let quote_id: string | null = null;
  if (lead.intent === "compra") {
    // find open order for this customer (no quote yet)
    const { rows: open } = await q(
      `SELECT o.order_id FROM orders o LEFT JOIN quotes q ON q.order_id=o.order_id
       WHERE o.customer_id=$1 AND o.status IN ('NOVO','ORÇAMENTO') AND q.quote_id IS NULL
       ORDER BY o.created_at DESC LIMIT 1`,
      [customer_id]
    );
    if (open.length) {
      order_id = open[0].order_id;
    } else {
      order_id = await genId("PED", "orders-YYYY");
      await q(
        `INSERT INTO orders (order_id, customer_id, conversation_id, status, doc)
         VALUES ($1,$2,$3,'NOVO',$4)`,
        [order_id, customer_id, convId || null, JSON.stringify({ extracted: lead, source: "whatsapp" })]
      );
    }
    // create quote if product + price present
    if (lead.produto && lead.preco) {
      quote_id = await genId("ORC", "quotes-YYYY");
      await q(
        `INSERT INTO quotes (quote_id, order_id, customer_id, code, client_name, status, total_geral, date, doc)
         VALUES ($1,$2,$3,$4,$5,'Rascunho',$6,$7,$8)`,
        [quote_id, order_id, customer_id, quote_id, name, Number(lead.preco) || 0, today(),
         JSON.stringify({ product: lead.produto, quantity: lead.quantidade, measures: lead.medidas, notes: lead.observacoes })]
      );
      await q(`UPDATE orders SET quote_id=$2 WHERE order_id=$1`, [order_id, quote_id]);
    }
    // 4) if production needs a file and none exists -> ask client
    const { rows: files } = await q(`SELECT count(*)::int AS n FROM production_files WHERE order_id=$1`, [order_id]);
    if ((files[0]?.n ?? 0) === 0) {
      const note = `Para avançarmos com a produção, preciso que envie a arte/ficheiro do trabalho. Pode enviar diretamente por aqui.`;
      sendWhatsapp(name, note);
    }
  }

  res.json({
    ok: true,
    customer_id,
    conversation_id: convId || null,
    intent: lead.intent,
    extracted: lead,
    order_id,
    quote_id,
  });
}));

/* --------------------------- FILE UPLOAD --------------------------- */
// POST /api/whatsapp/upload  body: { order_id, filename, url? , content_base64? }
// Saves the file locally under /root/crm-saas/uploads and links to the order.
import fs from "fs";
import path from "path";
const UPLOAD_DIR = "/root/crm-saas/uploads";
r.post("/upload", wrap(async (req, res) => {
  const b = req.body || {};
  const order_id = b.order_id;
  if (!order_id) return res.status(400).json({ error: "order_id required" });
  const { rows: ord } = await q(`SELECT customer_id FROM orders WHERE order_id=$1`, [order_id]);
  if (!ord.length) return res.status(404).json({ error: "order not found" });
  const customer_id = ord[0].customer_id;

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const safe = String(b.filename || `file-${Date.now()}`).replace(/[^\w.\-]/g, "_");
  const dest = path.join(UPLOAD_DIR, `${order_id}__${safe}`);
  if (b.content_base64) {
    fs.writeFileSync(dest, Buffer.from(b.content_base64, "base64"));
  } else if (b.url) {
    // best-effort download
    try { await new Promise<void>((res2, rej) => {
      const cp = spawn("/usr/bin/curl", ["-fsSL", b.url, "-o", dest]);
      cp.on("close", (c) => (c === 0 ? res2() : rej(new Error("curl " + c))));
    }); } catch (e) { return res.status(502).json({ error: "download failed: " + (e as Error).message }); }
  } else {
    return res.status(400).json({ error: "content_base64 or url required" });
  }

  const file_id = await genId("FILE", "files");
  await q(
    `INSERT INTO production_files (file_id, order_id, customer_id, name, mime_type, size, storage_url, uploaded_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now(),'Pendente')`,
    [file_id, order_id, customer_id, safe, b.mime_type || "application/octet-stream", b.size || null, dest]
  );
  await q(`UPDATE orders SET file_ids = array_append(COALESCE(file_ids,'{}'), $2) WHERE order_id=$1`, [order_id, file_id]);

  // notify client
  const { rows: cust } = await q(`SELECT name FROM customers WHERE customer_id=$1`, [customer_id]);
  sendWhatsapp(cust[0]?.name || "Cliente", `Ficheiro recebido ✓ (${safe}). Entraremos em produção em breve.`);

  res.json({ ok: true, file_id, order_id, storage_url: dest });
}));

export default r;
