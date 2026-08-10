import express, { Router } from "express";
import { spawnSync, spawn } from "child_process";
import path from "path";
import { q } from "./db";
import * as AI from "./ai";
import ordersRoutes from "./routes/orders";
import whatsappRoutes from "./routes/whatsapp";
import paymentsRoutes from "./routes/payments";

const r = Router();
r.use("/orders", ordersRoutes);
r.use("/whatsapp", whatsappRoutes);
r.use("/payments", paymentsRoutes);

/* ----------------------------- helpers ----------------------------- */
const merge = (row: any, extra: any = {}) => ({ ...(row?.doc || {}), ...extra });
const nid = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const wrap =
  (fn: (req: any, res: any) => Promise<any>) =>
  async (req: any, res: any) => {
    try {
      await fn(req, res);
    } catch (e) {
      console.error("[api]", req.method, req.path, (e as Error).message);
      res.status(500).json({ error: (e as Error).message });
    }
  };

/**
 * Notification dispatcher for production quality changes.
 * TODO(nino): wire real WhatsApp send through Chatwoot / Evolution API.
 * Set CRM_NOTIFY_WEBHOOK to an endpoint accepting {channel,target,subject,body}.
 */
const scriptPath = (name: string) => {
  const fs = require("fs");
  const cands = [path.join(__dirname, name), path.join(__dirname, "..", name),
    path.join(__dirname, "..", "..", name), path.join(process.cwd(), name),
    "/root/crm-saas/" + name];
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || cands[cands.length - 1];
};

async function notify(channel: string, target: string, subject: string, body: string) {
  let status = "logged";

  // Real WhatsApp send through Chatwoot (rails runner) via python helper.
  if (channel === "whatsapp" && target) {
    try {
      const script = scriptPath("notify_production.py");
      const out: string = await new Promise((resolve) => {
        const cp = spawn("/usr/bin/python3", [script, "--client", String(target),
          "--message", `${subject}\n${body}`], { stdio: ["ignore", "pipe", "pipe"] });
        let b = "";
        const timer = setTimeout(() => { try { cp.kill("SIGKILL"); } catch {} }, 120000);
        cp.stdout.on("data", (d) => (b += d));
        cp.stderr.on("data", (d) => (b += d));
        cp.on("close", () => { clearTimeout(timer); resolve(b); });
      });
      status = out.includes("ENVIADO") ? "sent"
        : out.includes("NAO_ENCONTRADO") ? "not_found"
        : `failed:${(out.trim().split("\n").pop() || "unknown").slice(0, 120)}`;
    } catch (e) {
      status = `failed:${(e as Error).message}`;
    }
  }

  const hook = process.env.CRM_NOTIFY_WEBHOOK;
  if (hook) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, target, subject, body }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      status = resp.ok ? "sent" : `failed:${resp.status}`;
    } catch (e) {
      status = `failed:${(e as Error).message}`;
    }
  }
  console.log(`[notify:${status}] ${channel} -> ${target} :: ${subject}`);
  await q(`INSERT INTO notifications_log (channel,target,subject,body,status) VALUES ($1,$2,$3,$4,$5)`,
    [channel, target, subject, body, status]);
  return status;
}

/* ------------------------- chatwoot sync ------------------------- */
// NOTE: must NOT use spawnSync here — the script calls back into this same
// Express server (POST /api/clients) and spawnSync would block the event loop.
r.post("/sync/chatwoot", wrap(async (_req, res) => {
  const script = scriptPath("sync_clients_from_chatwoot.py");
  const out: string = await new Promise((resolve) => {
    const cp = spawn("/usr/bin/python3", [script], { stdio: ["ignore", "pipe", "pipe"] });
    let buf = "", err = "";
    const timer = setTimeout(() => { try { cp.kill("SIGKILL"); } catch {} }, 180000);
    cp.stdout.on("data", (d) => (buf += d));
    cp.stderr.on("data", (d) => (err += d));
    cp.on("close", () => { clearTimeout(timer); resolve(buf.trim() || err.trim()); });
  });
  let parsed: any = null;
  try { parsed = JSON.parse(out.split("\n").pop() || "{}"); } catch { /* ignore */ }
  if (!parsed) return res.status(500).json({ success: false, error: out.slice(0, 500) });
  res.json(parsed);
}));

/* ----------------------------- health ----------------------------- */
r.get("/health", wrap(async (_req, res) => {
  const { rows } = await q("SELECT 1 AS ok");
  res.json({ status: "ok", db: rows[0].ok === 1, aiMode: AI.aiMode(), timestamp: new Date().toISOString() });
}));

/* ----------------------------- clients ----------------------------- */
r.get("/clients", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM clients ORDER BY created_at DESC");
  res.json(rows.map((x) => merge(x, { id: x.id })));
}));

r.post("/clients", wrap(async (req, res) => {
  const c = { ...req.body, id: req.body.id || nid("cli") };
  await q(
    `INSERT INTO clients (id,name,company,phone,email,segment,last_purchase,total_spent,orders_count,manager,status,is_vip,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, company=EXCLUDED.company, phone=EXCLUDED.phone,
       email=EXCLUDED.email, total_spent=EXCLUDED.total_spent, status=EXCLUDED.status, doc=EXCLUDED.doc`,
    [c.id, c.name, c.company, c.phone, c.email || null, c.segment || null, c.lastPurchase || "—",
     c.totalSpent || 0, c.ordersCount || 0, c.manager || "—", c.status || "Ativo", !!c.isVip, JSON.stringify(c)]
  );
  res.json(c);
}));

r.put("/clients/:id", wrap(async (req, res) => {
  const c = { ...req.body, id: req.params.id };
  await q(`UPDATE clients SET name=$2, company=$3, phone=$4, email=$5, total_spent=$6, status=$7, doc=$8 WHERE id=$1`,
    [c.id, c.name, c.company, c.phone, c.email || null, c.totalSpent || 0, c.status || "Ativo", JSON.stringify(c)]);
  res.json(c);
}));

r.delete("/clients/:id", wrap(async (req, res) => {
  await q("DELETE FROM clients WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
}));

/* ------------------------------ deals ------------------------------ */
r.get("/deals", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM deals ORDER BY created_at DESC");
  res.json(rows.map((x) => merge(x, { id: x.id, stage: x.stage })));
}));

r.post("/deals", wrap(async (req, res) => {
  const d = { ...req.body, id: req.body.id || nid("deal") };
  await q(
    `INSERT INTO deals (id,title,company,service,estimated_value,stage,priority,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, company=EXCLUDED.company, service=EXCLUDED.service,
       estimated_value=EXCLUDED.estimated_value, stage=EXCLUDED.stage, priority=EXCLUDED.priority, doc=EXCLUDED.doc`,
    [d.id, d.title, d.company, d.service, d.estimatedValue || 0, d.stage || "NOVO", d.priority || "Média", JSON.stringify(d)]
  );
  res.json(d);
}));

r.put("/deals/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const { rows } = await q("SELECT * FROM deals WHERE id=$1", [id]);
  if (!rows.length) return res.status(404).json({ error: "deal not found" });
  const d = { ...merge(rows[0]), ...req.body, id };
  await q(`UPDATE deals SET title=$2, company=$3, service=$4, estimated_value=$5, stage=$6, priority=$7, doc=$8 WHERE id=$1`,
    [id, d.title, d.company, d.service, d.estimatedValue || 0, d.stage, d.priority, JSON.stringify(d)]);
  res.json(d);
}));

/* -------------------------- conversations -------------------------- */
r.get("/conversations", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM conversations ORDER BY created_at ASC");
  const { rows: msgs } = await q("SELECT * FROM chat_messages ORDER BY seq ASC");
  res.json(rows.map((c) => ({
    ...merge(c, { id: c.id }),
    unreadCount: c.unread_count,
    lastMessage: c.last_message,
    lastMessageTime: c.last_message_time,
    messages: msgs.filter((m) => m.conversation_id === c.id).map((m) => ({
      id: m.id, sender: m.sender, text: m.text, timestamp: m.timestamp, status: m.status || undefined,
    })),
  })));
}));

r.post("/conversations/:id/messages", wrap(async (req, res) => {
  const convId = req.params.id;
  const m = { id: req.body.id || nid("msg"), sender: req.body.sender || "user", text: req.body.text || "",
    timestamp: req.body.timestamp || "Agora", status: req.body.status || "sent" };
  await q(`INSERT INTO chat_messages (id,conversation_id,sender,text,timestamp,status) VALUES ($1,$2,$3,$4,$5,$6)`,
    [m.id, convId, m.sender, m.text, m.timestamp, m.status]);
  await q(`UPDATE conversations SET last_message=$2, last_message_time=$3 WHERE id=$1`, [convId, m.text, m.timestamp]);
  res.json(m);
}));

/* --------------------------- production --------------------------- */
async function loadOrders() {
  const { rows } = await q("SELECT * FROM production_orders ORDER BY created_at ASC");
  const { rows: files } = await q("SELECT * FROM production_files ORDER BY created_at ASC");
  return rows.map((o) => ({
    ...merge(o, { id: o.id }),
    stage: o.stage,
    qualityStatus: o.quality_status,
    qualityNote: o.quality_note || undefined,
    files: files.filter((f) => f.order_id === o.id).map((f) => ({
      id: f.id, name: f.name, size: f.size, type: f.type, url: f.url || undefined,
      uploadedAt: f.uploaded_at, status: f.status,
    })),
  }));
}

r.get("/production", wrap(async (_req, res) => res.json(await loadOrders())));
r.get("/production-orders", wrap(async (_req, res) => res.json(await loadOrders())));

r.post("/production", wrap(async (req, res) => {
  const o = { ...req.body, id: req.body.id || `#ORD-${Math.floor(Math.random() * 900 + 100)}` };
  await q(
    `INSERT INTO production_orders (id,client_name,product_description,stage,due_date,status_badge,quality_status,quality_note,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET client_name=EXCLUDED.client_name, product_description=EXCLUDED.product_description,
       stage=EXCLUDED.stage, due_date=EXCLUDED.due_date, quality_status=EXCLUDED.quality_status, doc=EXCLUDED.doc`,
    [o.id, o.clientName, o.productDescription, o.stage || "PEDIDO", o.dueDate || "—", o.statusBadge || null,
     o.qualityStatus || "PENDENTE", o.qualityNote || null, JSON.stringify(o)]
  );
  for (const f of o.files || []) {
    await q(`INSERT INTO production_files (id,order_id,name,size,type,url,uploaded_at,status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [f.id || nid("file"), o.id, f.name, f.size, f.type, f.url || null, f.uploadedAt || "Agora", f.status || "Pendente"]);
  }
  res.json(o);
}));

r.put("/production/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const { rows } = await q("SELECT * FROM production_orders WHERE id=$1", [id]);
  if (!rows.length) return res.status(404).json({ error: "order not found" });
  const o = { ...merge(rows[0]), ...req.body, id };
  await q(`UPDATE production_orders SET stage=$2, quality_status=$3, quality_note=$4, due_date=$5, doc=$6 WHERE id=$1`,
    [id, o.stage, o.qualityStatus || "PENDENTE", o.qualityNote || null, o.dueDate || null, JSON.stringify(o)]);
  res.json(o);
}));

// Quality decision on the whole order (used by the Producao view)
r.post("/production/:id/quality", wrap(async (req, res) => {
  const id = req.params.id;
  const status = String(req.body.status || "APROVADO").toUpperCase();
  const note = req.body.note || null;
  const { rows } = await q("SELECT * FROM production_orders WHERE id=$1", [id]);
  if (!rows.length) return res.status(404).json({ error: "order not found" });
  await q(`UPDATE production_orders SET quality_status=$2, quality_note=$3 WHERE id=$1`, [id, status, note]);
  const o = rows[0];
  const body = status === "APROVADO"
    ? `Olá ${o.client_name}! O seu pedido ${id} (${o.product_description}) foi APROVADO no controlo de qualidade da 2N Publicidade e seguiu para produção. 🚀`
    : `Olá ${o.client_name}! O seu pedido ${id} (${o.product_description}) necessita de revisão da arte (${note || "ajuste técnico"}). A nossa equipa entrará em contacto. ⚠️`;
  const notifyStatus = await notify("whatsapp", o.client_name, `Qualidade ${status} - ${id}`, body);
  res.json({ id, qualityStatus: status, qualityNote: note, notify: notifyStatus, message: body });
}));

// File-level approve / reject
r.post("/production/:id/files/:fid/:action(approve|reject)", wrap(async (req, res) => {
  const { id, fid, action } = req.params;
  const newStatus = action === "approve" ? "Aprovado" : "Rejeitado";
  const { rowCount } = await q(`UPDATE production_files SET status=$3 WHERE id=$2 AND order_id=$1`, [id, fid, newStatus]);
  if (!rowCount) return res.status(404).json({ error: "file not found" });

  const { rows: fr } = await q("SELECT * FROM production_files WHERE order_id=$1", [id]);
  const allApproved = fr.length > 0 && fr.every((f) => f.status === "Aprovado");
  const anyRejected = fr.some((f) => f.status === "Rejeitado");
  const orderQuality = anyRejected ? "REJEITADO" : allApproved ? "APROVADO" : "PENDENTE";
  await q(`UPDATE production_orders SET quality_status=$2 WHERE id=$1`, [id, orderQuality]);

  const { rows: orows } = await q("SELECT * FROM production_orders WHERE id=$1", [id]);
  const o = orows[0] || { client_name: "Cliente", product_description: "" };
  const body = `Pedido ${id} — ficheiro ${fid} ${newStatus.toUpperCase()}. Estado global de qualidade: ${orderQuality}.`;
  const notifyStatus = await notify("whatsapp", o.client_name, `Ficheiro ${newStatus} - ${id}`, body);

  res.json({ orderId: id, fileId: fid, status: newStatus, qualityStatus: orderQuality, notify: notifyStatus });
}));

/* ----------------------------- quotes ----------------------------- */
r.get("/quotes", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM quotes ORDER BY created_at ASC");
  res.json(rows.map((x) => merge(x, { id: x.id, status: x.status })));
}));

r.post("/quotes", wrap(async (req, res) => {
  const qt = { ...req.body, id: req.body.id || nid("orc") };
  await q(
    `INSERT INTO quotes (id,code,client_name,company,status,total_geral,date,due_date,doc)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code, client_name=EXCLUDED.client_name, status=EXCLUDED.status,
       total_geral=EXCLUDED.total_geral, doc=EXCLUDED.doc`,
    [qt.id, qt.code, qt.clientName, qt.company, qt.status || "Rascunho", qt.totalGeral || 0,
     qt.date || "", qt.dueDate || "", JSON.stringify(qt)]
  );
  res.json(qt);
}));

r.put("/quotes/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const { rows } = await q("SELECT * FROM quotes WHERE id=$1", [id]);
  if (!rows.length) return res.status(404).json({ error: "quote not found" });
  const qt = { ...merge(rows[0]), ...req.body, id };
  await q(`UPDATE quotes SET status=$2, total_geral=$3, doc=$4 WHERE id=$1`,
    [id, qt.status, qt.totalGeral || 0, JSON.stringify(qt)]);
  res.json(qt);
}));

/* ---------------------------- invoices ---------------------------- */
r.get("/invoices", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM invoices ORDER BY created_at ASC");
  res.json(rows.map((x) => ({ ...merge(x), id: x.id, kind: x.kind, code: x.code,
    clientName: x.client_name, status: x.status, total: Number(x.total), date: x.date, dueDate: x.due_date })));
}));

r.post("/invoices", wrap(async (req, res) => {
  const i = { ...req.body, id: req.body.id || nid("inv") };
  await q(`INSERT INTO invoices (id,kind,code,client_name,status,total,date,due_date,doc)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, total=EXCLUDED.total, doc=EXCLUDED.doc`,
    [i.id, i.kind || "fatura", i.code || i.id, i.clientName, i.status || "Pendente",
     i.total || 0, i.date || "", i.dueDate || "", JSON.stringify(i)]);
  res.json(i);
}));

/* ------------------------------ tasks ------------------------------ */
r.get("/tasks", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM tasks ORDER BY created_at ASC");
  res.json(rows.map((t) => ({ id: t.id, title: t.title, completed: t.completed, dueDate: t.due_date || undefined })));
}));

r.post("/tasks", wrap(async (req, res) => {
  const t = { id: req.body.id || nid("tsk"), title: req.body.title, completed: !!req.body.completed, dueDate: req.body.dueDate };
  await q(`INSERT INTO tasks (id,title,completed,due_date,doc) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, completed=EXCLUDED.completed, due_date=EXCLUDED.due_date`,
    [t.id, t.title, t.completed, t.dueDate || null, JSON.stringify(t)]);
  res.json(t);
}));

r.put("/tasks/:id", wrap(async (req, res) => {
  await q(`UPDATE tasks SET title=COALESCE($2,title), completed=COALESCE($3,completed), due_date=COALESCE($4,due_date) WHERE id=$1`,
    [req.params.id, req.body.title ?? null, req.body.completed ?? null, req.body.dueDate ?? null]);
  res.json({ ok: true, id: req.params.id });
}));

// Calendar = tasks with a due date (kanban -> calendar bridge)
r.get("/calendar", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM tasks WHERE due_date IS NOT NULL ORDER BY due_date ASC");
  res.json(rows.map((t) => ({ id: t.id, title: t.title, date: t.due_date, completed: t.completed })));
}));

/* -------------------- activities / alerts / misc -------------------- */
r.get("/activities", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM activities ORDER BY created_at DESC LIMIT 50");
  res.json(rows.map((a) => ({ id: a.id, title: a.title, subtitle: a.subtitle, timeAgo: a.time_ago, type: a.type })));
}));

r.post("/activities", wrap(async (req, res) => {
  const a = { id: req.body.id || nid("act"), ...req.body };
  await q(`INSERT INTO activities (id,title,subtitle,time_ago,type) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
    [a.id, a.title, a.subtitle, a.timeAgo || "Agora", a.type || "client"]);
  res.json(a);
}));

r.get("/alerts", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM alerts ORDER BY created_at ASC");
  res.json(rows.map((a) => ({ id: a.id, title: a.title, subtitle: a.subtitle, type: a.type })));
}));

r.get("/automations", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM automations ORDER BY created_at ASC");
  res.json(rows.map((x) => merge(x, { id: x.id, isActive: x.is_active })));
}));

r.get("/settings", wrap(async (_req, res) => {
  const { rows } = await q("SELECT doc FROM company_settings WHERE id=1");
  res.json(rows[0]?.doc || {});
}));

r.put("/settings", wrap(async (req, res) => {
  await q(`INSERT INTO company_settings (id,doc,updated_at) VALUES (1,$1,now())
           ON CONFLICT (id) DO UPDATE SET doc=EXCLUDED.doc, updated_at=now()`, [JSON.stringify(req.body)]);
  res.json(req.body);
}));

r.get("/notifications", wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM notifications_log ORDER BY id DESC LIMIT 50");
  res.json(rows);
}));

/* --------------------------- bootstrap ---------------------------- */
async function loadOrdersNew() {
  const { rows: ors } = await q(`SELECT * FROM orders ORDER BY created_at DESC`);
  const { rows: pros } = await q(`SELECT * FROM production_orders ORDER BY created_at ASC`);
  const { rows: files } = await q(`SELECT * FROM production_files ORDER BY created_at ASC`);
  const { rows: custs } = await q(`SELECT customer_id, name FROM customers`);
  const cname: any = {}; custs.forEach((c: any) => (cname[c.customer_id] = c.name));
  return ors.map((o: any) => {
    const prod = pros.find((p: any) => p.order_id === o.order_id) || {};
    const ofiles = files.filter((f: any) => f.order_id === o.order_id).map((f: any) => ({
      id: f.file_id, name: f.name, size: f.size, type: f.mime_type, url: f.storage_url || undefined,
      uploadedAt: f.uploaded_at, status: f.status,
    }));
    return {
      ...(o.doc || {}),
      id: o.order_id, customer_id: o.customer_id, customerName: cname[o.customer_id] || o.doc?.cliente || "Cliente",
      productDescription: prod.product_description || o.doc?.produto || "", stage: prod.stage || o.status || "PEDIDO",
      dueDate: prod.due_date || "", qualityStatus: prod.quality_status || "PENDENTE", qualityNote: prod.quality_note || undefined,
      files: ofiles,
    };
  });
}

r.get("/bootstrap", wrap(async (_req, res) => {
  // NOVA ESTRUTURA: ler de customers/orders/quotes/conversations e mapear para os tipos das views
  const [customers, ordersRows, quotes, tasks, activities, alerts, automations, settings] = await Promise.all([
    q("SELECT customer_id, name, phone, email, nif, status, (SELECT string_agg(DISTINCT co.name, ', ') FROM customer_companies cc JOIN companies co ON co.company_id=cc.company_id WHERE cc.customer_id=customers.customer_id) AS company FROM customers ORDER BY created_at DESC"),
    q("SELECT * FROM orders ORDER BY created_at DESC"),
    q("SELECT * FROM quotes ORDER BY created_at ASC"),
    q("SELECT * FROM tasks ORDER BY created_at ASC"),
    q("SELECT * FROM activities ORDER BY created_at DESC LIMIT 50"),
    q("SELECT * FROM alerts ORDER BY created_at ASC"),
    q("SELECT * FROM automations ORDER BY created_at ASC"),
    q("SELECT doc FROM company_settings WHERE id=1"),
  ]);
  const { rows: pros } = await q("SELECT * FROM production_orders ORDER BY created_at ASC");
  const { rows: convs } = await q("SELECT * FROM conversations ORDER BY created_at ASC");
  const { rows: msgs } = await q("SELECT * FROM chat_messages ORDER BY seq ASC");

  const clients = customers.rows.map((c: any) => ({
    id: c.customer_id, name: c.name || "Sem nome", company: c.company || "", phone: c.phone || "",
    email: c.email || "", nif: c.nif || "", status: c.status || "Ativo",
    totalSpent: 0, ordersCount: 0, lastPurchase: "", isVip: false, segment: "", manager: "",
  }));

  const ordersById: any = {};
  ordersRows.rows.forEach((o: any) => (ordersById[o.order_id] = o));
  const deals = ordersRows.rows.map((o: any) => {
    const prod = pros.find((p: any) => p.order_id === o.order_id) || {};
    const cust = customers.rows.find((c: any) => c.customer_id === o.customer_id);
    return {
      id: o.order_id, title: prod.product_description || o.doc?.produto || "Pedido", company: cust?.name || o.customer_id || "",
      service: prod.product_description || o.doc?.produto || "", stage: (prod.stage || o.status || "NOVO"),
      estimatedValue: Number(o.doc?.total_geral || prod.total || 0), priority: "Média",
      dueDate: prod.due_date || "", owner: "Hermes", lastActivity: "", clientId: o.customer_id,
    };
  });

  const orders = ordersRows.rows.map((o: any) => {
    const prod = pros.find((p: any) => p.order_id === o.order_id) || {};
    const cust = customers.rows.find((c: any) => c.customer_id === o.customer_id);
    return {
      id: o.order_id, customerId: o.customer_id, clientName: cust?.name || "Cliente",
      productDescription: prod.product_description || o.doc?.produto || "", stage: prod.stage || o.status || "PEDIDO",
      dueDate: prod.due_date || "", qualityStatus: prod.quality_status || "PENDENTE", qualityNote: prod.quality_note || undefined,
      files: [],
    };
  });

  const convList = convs.map((c: any) => {
    const cust = customers.rows.find((x: any) => x.customer_id === c.customer_id);
    return {
      id: c.conversation_id || c.id, clientId: c.customer_id, clientName: cust?.name || c.doc?.cliente || "Cliente",
      company: c.company || "", channel: c.channel || "whatsapp", unreadCount: c.unread_count || 0,
      lastMessage: c.last_message || "", lastMessageTime: c.last_message_time || "",
      messages: msgs.filter((m: any) => m.conversation_id === (c.conversation_id || c.id)).map((m: any) => ({
        id: m.id, sender: m.sender || "client", text: m.text || "", timestamp: m.timestamp || "Agora", status: m.status || undefined })),
    };
  });

  const quoteList = quotes.rows.map((x: any) => ({
    id: x.quote_id || x.id, clientId: x.customer_id, clientName: x.client_name || "", company: x.company || "",
    code: x.code || x.quote_id || x.id, number: x.code || x.quote_id || x.id,
    title: x.doc?.produto || "Orçamento", status: (x.status || "Rascunho"),
    totalGeral: Number(x.total_geral || 0), date: x.date || "", dueDate: x.due_date || "", validUntil: x.due_date || "",
    items: x.doc?.items || [], notes: x.doc?.notes || "",
  }));

  res.json({
    clients,
    deals,
    conversations: convList,
    orders,
    quotes: quoteList,
    tasks: tasks.rows.map((t: any) => ({ id: t.id, title: t.title, completed: t.completed, dueDate: t.due_date || undefined })),
    activities: activities.rows.map((a: any) => ({ id: a.id, title: a.title, subtitle: a.subtitle, timeAgo: a.time_ago, type: a.type })),
    alerts: alerts.rows.map((a: any) => ({ id: a.id, title: a.title, subtitle: a.subtitle, type: a.type })),
    automations: automations.rows.map((x: any) => ({ ...(x.doc || {}), id: x.id, isActive: x.is_active, steps: (x.doc?.steps) || [] })),
    companySettings: settings.rows[0]?.doc || null,
    aiMode: AI.aiMode(),
  });
}));

/* ---------------------------- Hermes AI ---------------------------- */
r.post("/hermes/suggest-reply", wrap(async (req, res) => {
  const { clientName, messages, context } = req.body || {};
  const prompt = `Você é o Hermes AI, assistente executivo do CRM da 2N Publicidade (Luanda, Angola).
Sugira uma resposta profissional, cordial e persuasiva para o cliente.
Cliente: ${clientName || "Cliente"}
Contexto: ${context || "Interesse em serviços de publicidade"}
Histórico: ${JSON.stringify(messages || [])}
Responda apenas com o texto da resposta sugerida, em português, poucas frases.`;
  const out = await AI.generate(prompt);
  res.json({ suggestion: out || AI.fallbackSuggestReply(clientName, messages, context), mode: out ? AI.aiMode() : "local-fallback" });
}));

r.post("/hermes/summarize-lead", wrap(async (req, res) => {
  const { clientName, company, messages, notes } = req.body || {};
  const prompt = `Resuma este lead do CRM da 2N Publicidade em no máximo 3 frases (pontos principais, urgência, preferências).
Cliente: ${clientName} (${company}). Notas: ${notes || "sem notas"}. Histórico: ${JSON.stringify(messages || [])}`;
  const out = await AI.generate(prompt);
  res.json({ summary: out || AI.fallbackSummarizeLead(clientName, company, messages, notes), mode: out ? AI.aiMode() : "local-fallback" });
}));

r.post("/hermes/generate-layouts", wrap(async (req, res) => {
  const { orderId, clientName, productDescription } = req.body || {};
  const prompt = `Para o pedido ${orderId || ""} do cliente "${clientName}" (${productDescription}), gere 3 conceitos criativos.
Retorne JSON: {"layouts":[{"title":"","headline":"","description":""}]}`;
  const out = await AI.generate(prompt, true);
  if (out) {
    try {
      const parsed = JSON.parse(out);
      if (parsed?.layouts?.length) return res.json({ ...parsed, mode: AI.aiMode() });
    } catch { /* fall through to fallback */ }
  }
  res.json({ ...AI.fallbackLayouts(orderId, clientName, productDescription), mode: "local-fallback" });
}));

r.post("/hermes/chat", wrap(async (req, res) => {
  const { message, crmData } = req.body || {};
  const prompt = `Você é o Hermes AI, copiloto executivo do CRM da 2N Publicidade.
Dados do CRM: ${JSON.stringify(crmData || {})}
Mensagem do utilizador: "${message}"
Responda em português, executivo, direto, com markdown quando útil.`;
  const out = await AI.generate(prompt);
  res.json({ reply: out || AI.fallbackChat(message, crmData), mode: out ? AI.aiMode() : "local-fallback" });
}));

export default r;
export { express };
