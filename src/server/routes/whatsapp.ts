import { Router } from "express";
import { spawn } from "child_process";
import { q, genId } from "../db";
import * as AI from "../ai";
import { generate as aiGenerate, loadProviders as aiLoadProviders } from "../ai-manager";

aiLoadProviders();

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
  const out = await aiGenerate({ text: prompt, json: true });
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

/* ------------------- EXTRAÇÃO DE PRAZOS / CONTEXTO ------------------- */
// Timezone Luanda
const TZ = "Africa/Luanda";

function parsePtDate(text: string): { date: Date | null; hour: string | null; raw: string } {
  const t = (text || "").toLowerCase();
  const now = new Date();
  let target = new Date(now);
  let matched = false;
  let raw = "";
  const addDays = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  if (/\bhoje\b/.test(t)) { target = addDays(0); matched = true; raw = "hoje"; }
  else if (/\bamanh(a|ã)\b/.test(t)) { target = addDays(1); matched = true; raw = "amanhã"; }
  else if (/\bdepois de amanh(a|ã)\b/.test(t)) { target = addDays(2); matched = true; raw = "depois de amanhã"; }
  else if (/\bsegunda\b/.test(t)) { target = nextWeekday(now, 1); matched = true; raw = "segunda"; }
  else if (/\bter(c|ç)a\b/.test(t)) { target = nextWeekday(now, 2); matched = true; raw = "terça"; }
  else if (/\bquarta\b/.test(t)) { target = nextWeekday(now, 3); matched = true; raw = "quarta"; }
  else if (/\bquinta\b/.test(t)) { target = nextWeekday(now, 4); matched = true; raw = "quinta"; }
  else if (/\bsexta\b/.test(t)) { target = nextWeekday(now, 5); matched = true; raw = "sexta"; }
  else if (/\bs(a|á)bado\b/.test(t)) { target = nextWeekday(now, 6); matched = true; raw = "sábado"; }
  else if (/\bdomingo\b/.test(t)) { target = nextWeekday(now, 0); matched = true; raw = "domingo"; }
  else if (/\bfim do m(e|ê)s\b/.test(t)) { target = new Date(now.getFullYear(), now.getMonth() + 1, 0); matched = true; raw = "fim do mês"; }
  const m = t.match(/daqui a\s+(\d+)\s+dias?/);
  if (m) { target = addDays(parseInt(m[1])); matched = true; raw = `daqui a ${m[1]} dias`; }
  // hora
  const hm = t.match(/(\d{1,2})[:h](\d{2})?\s*(h|horas?)?/);
  let hour: string | null = null;
  if (hm) { hour = `${hm[1].padStart(2, "0")}:${(hm[2] || "00").padStart(2, "0")}`; }
  return { date: matched ? target : null, hour, raw };
}

function nextWeekday(from: Date, dow: number): Date {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

async function extractContext(text: string): Promise<any> {
  const t = (text || "").toLowerCase();
  const prio: string = /(urgente|rapido|asap|hoje|agora)/.test(t) ? "URGENTE" : /(importante|prioridade|critic)/.test(t) ? "ALTA" : "NORMAL";
  const prompt = `Analisa a mensagem de um cliente da 2N Publicidade (Luanda, Angola).
Extrai JSON com: produto, quantidade(number), prazo_texto, data_entrega(string YYYY-MM-DD ou null), hora_entrega(string HH:MM ou null),
local_entrega, prioridade("BAIXA"|"NORMAL"|"ALTA"|"URGENTE"|"CRITICA"), pagamento, observacoes, urgencia(bool), alteracao_importante(bool).
Se nao houver data exata mas houver expressao relativa (amanha, sexta, daqui a 3 dias), poe em prazo_texto.
Mensagem: """${text}"""
Responda APENAS o JSON.`;
  const local = parsePtDate(text);
  const out = await aiGenerate({ text: prompt, json: true });
  let parsed: any = null;
  if (out) {
    try { const m = out.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch {}
  }
  // Se há expressão relativa detetada localmente, a data local tem prioridade (não inventar)
  if (local.date) {
    return {
      produto: t.includes("flyer") ? "flyer" : t.includes("banner") ? "banner" : (parsed?.produto || ""),
      quantidade: parsed?.quantidade || (t.match(/\d[\d.\s]*\d|\d/g) || []).join("").replace(/\s/g, "") || undefined,
      prazo_texto: local.raw || (parsed?.prazo_texto || null),
      data_entrega: local.date.toISOString().slice(0, 10),
      hora_entrega: local.hour || parsed?.hora_entrega || null,
      prioridade: parsed?.prioridade || prio,
      urgencia: (parsed?.prioridade === "URGENTE" || parsed?.prioridade === "CRITICA" || prio === "URGENTE"),
      alteracao_importante: false,
    };
  }
  const p = parsed || {};
  return {
    produto: p.produto || (t.includes("flyer") ? "flyer" : t.includes("banner") ? "banner" : ""),
    quantidade: p.quantidade || (t.match(/\d[\d.\s]*\d|\d/g) || []).join("").replace(/\s/g, "") || undefined,
    prazo_texto: p.prazo_texto || null,
    data_entrega: p.data_entrega || null,
    hora_entrega: p.hora_entrega || local.hour || null,
    prioridade: p.prioridade || prio,
    urgencia: (p.prioridade === "URGENTE" || p.prioridade === "CRITICA" || prio === "URGENTE"),
    alteracao_importante: false,
  };
}

// Cria tarefa + evento de calendario a partir de prazo detetado
async function createTaskFromConv(ctx: any, customer_id: string, order_id: string | null, convId: string) {
  if (!ctx || (!ctx.data_entrega && !ctx.prazo_texto && !ctx.hora_entrega)) return null;
  const dateStr = ctx.data_entrega || (ctx.prazo_texto ? new Date().toISOString().slice(0, 10) : null);
  const timeStr = ctx.hora_entrega || (ctx.prazo_texto ? "09:00" : null);
  const title = `Entrega: ${ctx.produto || "Pedido"} (${ctx.quantidade || ""})`;
  const priority = ctx.prioridade || "NORMAL";
  const { rows: t } = await q(
    `INSERT INTO tasks (id, title, completed, due_date, due_time, priority, origin, customer_id, order_id, doc_json)
     VALUES ($1,$2,false,$3,$4,$5,'conversa',$6,$7,$8) RETURNING id`,
    [await genId("TASK", "tasks"), title, dateStr, timeStr, priority, customer_id || null, order_id || null, JSON.stringify({ source: "whatsapp", conversation_id: convId })]
  );
  const startDate = new Date(`${dateStr}T${timeStr || "09:00"}:00`);
  await q(
    `INSERT INTO calendar_events (title, description, start_time, type, priority, customer_id, order_id, conversation_id, source, doc)
     VALUES ($1,$2,$3,'entrega',$4,$5,$6,$7,'conversa',$8)`,
    [title, `Prazo combinado via WhatsApp (${ctx.prazo_texto || ctx.hora_entrega || ""})`, startDate, priority, customer_id || null, order_id || null, convId, JSON.stringify({ conversation_id: convId })]
  );
  return t[0]?.id || null;
}

async function audit(actor: string, entity: string, entity_id: string | null, action: string, field: string | null, oldV: string | null, newV: string | null, origin: string) {
  try {
    await q(
      `INSERT INTO audit_log (entity, entity_id, actor, action, field, old_value, new_value, origin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [entity, entity_id || "?", actor, action, field, oldV, newV, origin]
    );
  } catch (e) { console.error("[audit]", (e as Error).message); }
}
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
      `INSERT INTO chat_messages (id, conversation_id, sender, sender_type, text, timestamp, status, message_id, attachments)
       VALUES ($1,$2,'client','customer', $3, now(),'received', $4, $5) ON CONFLICT (id) DO NOTHING`,
      [`msg-${convId}-${Date.now()}`, convId, String(text), `cw-${convId}-${Date.now()}`, JSON.stringify([])]
    );
  }

  // 2) Hermes extraction (lead + contexto/prazos)
  const lead = await extractLead(text);
  const ctx = await extractContext(text);

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
        [order_id, customer_id, convId || null, JSON.stringify({ extracted: lead, context: ctx, source: "whatsapp" })]
      );
      await audit("Hermes", "order", order_id, "created", "status", null, "NOVO", "whatsapp");
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
    // 4) Se há prazo/hora detetado -> criar tarefa + calendario (AUTOMAÇÃO)
    const taskId = await createTaskFromConv(ctx, customer_id, order_id, convId);
    if (taskId) await audit("Hermes", "task", taskId, "created", "due_date", null, ctx.data_entrega || ctx.prazo_texto, "whatsapp");
    // 5) if production needs a file and none exists -> ask client
    const { rows: files } = await q(`SELECT count(*)::int AS n FROM production_files WHERE order_id=$1`, [order_id]);
    if ((files[0]?.n ?? 0) === 0) {
      const note = `Para avançarmos com a produção, preciso que envie a arte/ficheiro do trabalho. Pode enviar diretamente por aqui.`;
      sendWhatsapp(name, note);
    }
  } else {
    // mesmo sem intenção de compra, se há prazo detetado, cria tarefa
    const taskId = await createTaskFromConv(ctx, customer_id, null, convId);
    if (taskId) await audit("Hermes", "task", taskId, "created", "due_date", null, ctx.data_entrega || ctx.prazo_texto, "whatsapp");
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

/* --------------------------- SYNC CHATWOOT --------------------------- */
// GET /api/whatsapp/sync  -> importa conversas reais do Chatwoot para o CRM
r.get("/sync", wrap(async (_req, res) => {
  const { spawn } = require("child_process");
  const cp = spawn("/usr/bin/python3", ["/root/crm-saas/chatwoot_sync.py", "--limit", "50"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  cp.stdout.on("data", (d) => (out += d));
  cp.stderr.on("data", (d) => (out += d));
  cp.on("close", () => {
    try {
      const j = JSON.parse(out.trim().split("\n").pop() || "{}");
      res.json({ ok: true, synced: j.synced || 0, total: j.total || 0 });
    } catch {
      res.json({ ok: true, raw: out.slice(-300) });
    }
  });
}));

/* ----------------------------- SEND MSG ----------------------------- */
// POST /api/whatsapp/send  body: { conversation_id, text }
r.post("/send", wrap(async (req, res) => {
  const b = req.body || {};
  const convId = b.conversation_id || b.conv;
  const text = b.text || b.message;
  if (!convId || !text) return res.status(400).json({ error: "conversation_id e text obrigatórios" });
  const { spawn } = require("child_process");
  const cp = spawn("/usr/bin/python3", [
    "/root/crm-saas/chatwoot_send.py", "--conv", String(convId), "--message", String(text),
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  cp.stdout.on("data", (d) => (out += d));
  cp.stderr.on("data", (d) => (out += d));
  cp.on("close", () => {
    const ok = out.includes("ENVIADO");
    // registar mensagem enviada localmente (para o inbox refletir)
    (async () => {
      try {
        await q(
          `INSERT INTO chat_messages (id, conversation_id, sender, text, timestamp, status)
           VALUES ($1,$2,'agent',$3,now(),'sent') ON CONFLICT (id) DO NOTHING`,
          [`agent-${convId}-${Date.now()}`, String(convId), String(text).slice(0, 2000)]
        );
        await q(
          `UPDATE conversations SET last_message=$2, last_message_time=now() WHERE conversation_id=$1`,
          [String(convId), String(text).slice(0, 500)]
        );
      } catch (e) {
        console.error("[whatsapp/send] local log", (e as Error).message);
      }
    })();
    res.json({ ok, conversation_id: convId, detail: ok ? null : out.slice(-200) });
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
