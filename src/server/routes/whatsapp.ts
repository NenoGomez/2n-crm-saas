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

/** Chama Gemini direto e devolve JSON ou texto. */
async function geminiRaw(prompt: string, asJson = false): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const body: any = { contents: [{ parts: [{ text: prompt }] }] };
    if (asJson) body.generationConfig = { responseMimeType: "application/json" };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) { console.error("[gemini] status", r.status, (await r.text()).slice(0, 200)); return ""; }
    const j = await r.json();
    return (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").toString();
  } catch (e) { clearTimeout(timer); console.error("[gemini] erro", (e as Error).message); return ""; }
}

/** Fallback Groq (usado quando Gemini falha por quota/erro). */
async function groqRaw(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) { console.error("[groq] sem key"); return ""; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (r.ok) {
      const j = await r.json();
      const out = j?.choices?.[0]?.message?.content;
      if (out && out.trim().length > 2) return out.toString().trim().slice(0, 1000);
    } else {
      console.error("[groq] status", r.status, (await r.text()).slice(0, 200));
    }
  } catch (e) { clearTimeout(timer); console.error("[groq] erro", (e as Error).message); }
  return "";
}

/** Extract structured lead data from free text using Hermes (Gemini). */
async function extractLead(text: string): Promise<any> {
  const prompt = `Analise a seguinte mensagem de um cliente da 2N Publicidade (Luanda, Angola).
Extraia um objeto JSON com estes campos exatos:
{ "intent": "compra" | "duvida" | "outro", "cliente": string, "empresa": string, "produto": string,
  "quantidade": number, "medidas": string, "preco": number, "prazo": string, "localizacao": string,
  "ficheiros": boolean, "observacoes": string, "pedido": string, "estado": string }
Mensagem: """${text}"""
Responda APENAS o JSON, sem comentários.`;
  const out = await geminiRaw(prompt, true) || await groqRaw(prompt);
  if (out) {
    try {
      const m = out.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch {}
  }
  // Heuristic fallback
  const t = text.toLowerCase();
  const num = (t.match(/\d[\d.\s]*\d|\d/g) || []).join("");
  const prodRe = /(quero|preciso|comprar|fazer|orç|orc|banner|adesiv|impress|encomend|pedid|flyer|cart[ãa]o|cartaz|folheto|etiquet|brochur|livro|revista|calend[áa]rio|caneca|tela|stand|roll|fixe|topo| wob|lona|adesivo|autocol|camis|serviço|servico|logotip|logotip|site|panflet)/;
  const intent = prodRe.test(t) ? "compra" : "outro";
  let produto = "";
  for (const p of ["flyer","banner","adesivo","cartão","cartao","cartaz","folheto","etiqueta","brochura","livro","revista","calendário","calendario","caneca","tela","stand","roll up","topo de mesa","lona","camisa","logotipo","site","panfleto"]) {
    if (t.includes(p)) { produto = p; break; }
  }
  return { intent, cliente: "", empresa: "", produto, quantidade: num ? Number(num.replace(/\s/g, "")) : undefined, medidas: "", preco: undefined, prazo: "", localizacao: "", ficheiros: false, observacoes: text, pedido: "", estado: intent === "compra" ? "NOVO" : "" };
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
  const out = await geminiRaw(prompt, true) || await groqRaw(prompt);
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
    prazo_texto: p.prazo_texto || local.raw || null,
    data_entrega: p.data_entrega || (local.date ? local.date.toISOString().slice(0, 10) : null),
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
    `INSERT INTO tasks (id, title, due_date, due_time, priority, origin, customer_id, order_id, doc_json)
     VALUES ($1,$2,$3,$4,$5,'conversa',$6,$7,$8) RETURNING id`,
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

const HERMES_SYSTEM = `És o Hermes, assistente executivo da 2N Publicidade (Luanda, Angola).
Responde em português de Angola, tom profissional e cordial.
REGRA CRÍTICA: NUNCA reveles que és IA nem uses frases de IA ("como uma IA", "posso ajudar como assistente virtual").
NUNCA envies imagem/vídeo sem o cliente pedir. Máximo 3 imagens se necessário.
NUNCA digas que não consegues enviar áudio — o sistema JÁ envia áudio quando o cliente pede ("manda áudio") ou envia áudio primeiro. Se o cliente pedir áudio, confirma de forma natural.
Fecha com "Ficou esclarecido?" ou "Pretende avançar?" APENAS se fizeres uma pergunta ou proposta concreta. Se só confirmares algo, não perguntes.
Se o cliente pedir algo crítico (cancelar pedido, alterar valor, confirmar pagamento, marcar concluído), responde apenas que vais submeter ao equipo para confirmação — NÃO confirmes tu.
Sê conciso (1-3 frases). NUNCA uses o padrão "Prezado Nino Ferreira".`

async function generateBotReply(text: string, history: string[], context: any): Promise<string> {
  // context pode ser string (legacy) ou objeto rico
  const ctxObj = typeof context === "string" ? { resumo: context } : (context || {});
  const histStr = (history && history.length) ? history.join("\n") : "(sem histórico)";
  const prompt = `${HERMES_SYSTEM}

=== CONTEXTO COMPLETO DO CLIENTE (WhatsApp é a fonte principal) ===
${ctxObj.resumo || ""}
${ctxObj.cliente ? `CLIENTE: ${ctxObj.cliente.nome || ""} ${ctxObj.cliente.empresa ? "(" + ctxObj.cliente.empresa + ")" : ""} | tel ${ctxObj.cliente.phone || ""}` : ""}
${ctxObj.pedido ? `PEDIDO ATUAL (${ctxObj.pedido.order_id}):
- Produto: ${ctxObj.pedido.produto || "?"}
- Quantidade: ${ctxObj.pedido.quantidade || "?"}
- Dimensões: ${ctxObj.pedido.dimensões || ctxObj.pedido.dimensoes || "?"}
- Material: ${ctxObj.pedido.material || "?"}
- Acabamento: ${ctxObj.pedido.acabamento || "?"}
- Prazo: ${ctxObj.pedido.prazo || "?"}
- Valor: ${ctxObj.pedido.valor || "?"}
- Estado: ${ctxObj.pedido.estado || "?"}
- Ficheiros recebidos: ${ctxObj.pedido.ficheiros || "nenhum"}` : "PEDIDO ATUAL: ainda não existe pedido estruturado."}
${ctxObj.falta ? `INFORMAÇÕES EM FALTA para concluir o pedido: ${ctxObj.falta.join(", ")}` : ""}
${ctxObj.jaPerguntado ? `O QUE O HERMES JÁ PERGUNTOU ANTES (NÃO REPETIR): ${ctxObj.jaPerguntado}` : ""}
${ctxObj.pedidosAnteriores ? `PEDIDOS ANTERIORES DESTE CLIENTE: ${ctxObj.pedidosAnteriores}` : ""}

=== HISTÓRICO DA CONVERSA (WhatsApp) ===
${histStr}

=== MENSAGEM ATUAL DO CLIENTE ===
${text}

=== INSTRUÇÕES DE COMPORTAMENTO (SEGUE TODAS) ===
1. LÊ a MENSAGEM ATUAL e responde APENAS a essa mensagem. NUNCA repitas frases feitas nem respostas anteriores.
2. Se a mensagem do cliente for curta (ex: "Não", "Sim", "Ok", "Talvez") ou for uma resposta a uma pergunta tua ANTERIOR, reage a essa resposta de forma objetiva — NÃO voltes a fazer a pergunta nem resumes o pedido.
3. Se a mensagem for uma NOVA PERGUNTA ou NOVO ASSUNTO, responde DIRETAMENTE a isso. Não digas "estamos a analisar".
4. Se faltarem dados para o pedido (vê INFORMAÇÕES EM FALTA), pergunta SÓ o que falta, 1 vez, de forma curta. NUNCA perguntes o que já foi dito ou o que já perguntaste (vê O QUE O HERMES JÁ PERGUNTOU).
5. NÃO uses o padrão "Prezado Nino Ferreira" nem frases longas. Usa o primeiro nome do cliente (ou "Nino") e tom direto.
6. Responde em português de Angola, 1-3 frases CURTAS. Nada de "Entendemos que você já nos forneceu...".
7. Se o cliente disser "quero outra coisa" / mudar de assunto, pergunta o que precisa — não resumes o pedido antigo.
8. Termina com "Ficou esclarecido?" ou "Pretende avançar?" APENAS se fizeres uma pergunta ou proposta. Se só confirmares algo, não perguntes.
Responde como o Hermes (pessoa da 2N), direto e natural.`;
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (r.ok) {
        const j = await r.json();
        const out = j?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (out && out.trim().length > 2) return out.toString().trim().slice(0, 1000);
      } else {
        console.error("[gemini-direct] status", r.status, (await r.text()).slice(0, 200));
      }
    } catch (e) {
      console.error("[gemini-direct] erro", (e as Error).message);
    }
  }
  // fallback: tenta Groq; só se ambos falharem, usa frase neutra
  const g = await groqRaw(prompt);
  if (g) return g;
  return "Recebemos a sua mensagem. Um momento que já lhe respondo com os detalhes.";
}

function isCritical(text: string): boolean {
  const t = text.toLowerCase();
  return /(cancelar\s+(o\s+)?pedido|anular\s+(o\s+)?pedido|alterar\s+(o\s+)?valor|mudar\s+(o\s+)?preço|confirmar\s+(o\s+)?pagamento|ja\s+paguei|marcar\s+(como\s+)?concluido|dar\s+como\s+concluido|cancelar\s+(a\s+)?encomenda)/.test(t);
}

/**
 * Monta o contexto RICO para o Hermes responder com memória.
 * WhatsApp é a fonte principal: lê pedido atual, cliente, ficheiros,
 * o que já foi perguntado e pedidos anteriores.
 */
async function buildContext(convId: string, customer_id: string | null, lead: any): Promise<any> {
  const ctx: any = { resumo: "" };
  if (customer_id) {
    const { rows: cl } = await q(`SELECT * FROM customers WHERE customer_id=$1`, [customer_id]);
    if (cl[0]) ctx.cliente = { nome: cl[0].name, empresa: cl[0].company, phone: cl[0].phone, email: cl[0].email };
  }
  let order_id: string | null = null;
  if (customer_id) {
    const { rows: open } = await q(
      `SELECT o.order_id, o.status, o.doc FROM orders o WHERE o.customer_id=$1 AND o.status IN ('NOVO','ORÇAMENTO','EM PRODUÇÃO','AGUARDANDO CLIENTE','AGUARDANDO PAGAMENTO','EM ANÁLISE') ORDER BY o.created_at DESC LIMIT 1`,
      [customer_id]
    );
    if (open[0]) {
      order_id = open[0].order_id;
      const d = open[0].doc || {};
      const { rows: po } = await q(`SELECT * FROM production_orders WHERE order_id=$1 LIMIT 1`, [order_id]);
      const { rows: pf } = await q(`SELECT name, type, status FROM production_files WHERE order_id=$1`, [order_id]);
      ctx.pedido = {
        order_id,
        produto: d.produto || po[0]?.product_description || "",
        quantidade: d.quantidade || "",
        dimensoes: d.dimensoes || d.dimensões || "",
        material: d.material || "",
        acabamento: d.acabamento || "",
        prazo: d.prazo || po[0]?.due_date || "",
        valor: d.valor || d.total_geral || "",
        estado: open[0].status,
        ficheiros: pf.map((f: any) => `${f.name} (${f.status})`).join(", ") || "nenhum",
      };
    }
  }
  if (order_id) {
    await q(`UPDATE conversations SET doc=jsonb_set(COALESCE(doc,'{}'),'{pedidoFoco}',to_jsonb($2::text)) WHERE conversation_id=$1`, [convId, order_id]);
  } else {
    const { rows: cv } = await q(`SELECT doc->>'pedidoFoco' AS pf FROM conversations WHERE conversation_id=$1`, [convId]);
    if (cv[0]?.pf) {
      const { rows: o2 } = await q(`SELECT o.order_id, o.status, o.doc FROM orders o WHERE o.order_id=$1`, [cv[0].pf]);
      if (o2[0]) {
        order_id = o2[0].order_id;
        const d = o2[0].doc || {};
        ctx.pedido = { order_id, produto: d.produto || "", quantidade: d.quantidade || "", dimensoes: d.dimensoes || "", material: d.material || "", acabamento: d.acabamento || "", prazo: d.prazo || "", valor: d.valor || "", estado: o2[0].status, ficheiros: "ver anexos" };
      }
    }
  }
  const { rows: cv2 } = await q(`SELECT doc->>'jaPerguntado' AS jp FROM conversations WHERE conversation_id=$1`, [convId]);
  if (cv2[0]?.jp) ctx.jaPerguntado = cv2[0].jp;
  if (customer_id && order_id) {
    const { rows: ant } = await q(
      `SELECT order_id, doc FROM orders WHERE customer_id=$1 AND order_id != $2 AND status NOT IN ('NOVO','ORÇAMENTO','EM PRODUÇÃO') ORDER BY created_at DESC LIMIT 3`,
      [customer_id, order_id]
    );
    if (ant.length) ctx.pedidosAnteriores = ant.map((a: any) => `${a.order_id}: ${a.doc?.produto || "?"} x${a.doc?.quantidade || "?"}`).join(" | ");
  }
  const campos = ["produto", "quantidade", "dimensoes", "material", "acabamento", "prazo"];
  const falta: string[] = [];
  if (lead?.intent === "compra" || ctx.pedido) {
    for (const c of campos) {
      const v = (ctx.pedido && (ctx.pedido[c] || ctx.pedido[c === "dimensoes" ? "dimensoes" : c])) || (lead && lead[c]);
      if (!v || v === "?" || v === "") falta.push(c);
    }
    if (falta.length) ctx.falta = falta;
  }
  ctx.resumo = `Cliente ${ctx.cliente?.nome || "WhatsApp"}; Canal whatsapp; ${lead?.intent === "compra" || ctx.pedido ? "Pedido em curso" : "Lead"}.`;
  return ctx;
}

r.get("/test-extract", wrap(async (req, res) => {
  const text = String(req.query.text || "");
  if (!text) return res.status(400).json({ error: "missing ?text=" });
  const data = await extractLead(text);
  res.json({ text, extracted: data });
}));

r.get("/test-bot", wrap(async (req, res) => {
  const text = String(req.query.text || "Quero 10 banners");
  const hist = String(req.query.hist || "").split("|").filter(Boolean);
  const reply = await generateBotReply(text, hist, { resumo: "teste", falta: ["dimensoes", "material"] });
  res.json({ text, reply });
}));

r.get("/auto-reply", wrap(async (_req, res) => {
  const { rows } = await q(`SELECT doc FROM company_settings WHERE id=1`);
  const on = (rows[0]?.doc?.autoReply === true) || (process.env.AUTO_REPLY === "true");
  res.json({ enabled: !!on });
}));
r.post("/auto-reply", wrap(async (req, res) => {
  const b = req.body || {};
  const enabled = !!b.enabled;
  process.env.AUTO_REPLY = enabled ? "true" : "false";
  const { rows: cur } = await q(`SELECT doc FROM company_settings WHERE id=1`);
  const merged = { ...(cur[0]?.doc || {}), autoReply: enabled };
  await q(`UPDATE company_settings SET doc = $1::jsonb WHERE id=1`, [JSON.stringify(merged)]);
  res.json({ enabled });
}));

/* ----------------------------- WEBHOOK ----------------------------- */
r.post("/webhook", wrap(async (req, res) => {
  const b = req.body || {};
  // Chatwoot AgentBot + webhook payload shapes vary; be tolerant.
  const conv = b.conversation || b.conversation_data || {};
  const contact = b.contact || b.sender || b.contact_data || {};
  const msg = b.message || b.message_data || {};
  const text = b.content || msg.content || msg.text || b.text || "";
  const phone = contact.phone || contact.phone_number || (contact.identifier || "") || (b.meta && b.meta.sender && b.meta.sender.phone_number) || "";
  const name = contact.name || contact.full_name || (b.meta && b.meta.sender && b.meta.sender.name) || "Cliente";
  const convId = String(conv.id ?? b.conversation_id ?? b.conversation?.id ?? "");
  const msgType = b.message_type || msg.message_type || "";
  const senderType = (contact.type || b.sender?.type || (b.meta && b.meta.sender && b.meta.sender.type) || "").toLowerCase();

  // AgentBot: so responde a mensagens recebidas do CLIENTE (nao da minha propria resposta)
  if (msgType === "outgoing" || senderType === "user" || senderType === "agent" || senderType === "agent_bot") {
    return res.json({ ok: true, skipped: "not incoming from contact" });
  }

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
  let lead: any = {};
  try { lead = await extractLead(text); } catch (e) { require("fs").appendFileSync("/tmp/evo_debug.log", `extractLead ERR: ${(e as Error).message}\n`); }
  const ctx = await extractContext(text);
  require("fs").appendFileSync("/tmp/evo_debug.log", `lead.intent=${lead.intent} produto=${lead.produto} qtd=${lead.quantidade}\n`);

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

  // 6) Auto-resposta Hermes (bot) — apenas se ativo
  const { rows: st } = await q(`SELECT doc FROM company_settings WHERE id=1`);
  const stDoc = (st[0] as any)?.doc || {};
  const autoReplyOn = (process.env.AUTO_REPLY === "true") || (stDoc.autoReply === true);
  if (autoReplyOn && convId) {
    const { rows: hist } = await q(
      `SELECT sender, text FROM chat_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 10`,
      [convId]
    );
    const history = hist.map((m: any) => (m.sender === "client" ? `Cliente: ${m.text}` : `Hermes: ${m.text}`)).reverse();
    const context = `Cliente ${name}; Canal whatsapp; ${lead.intent === "compra" ? "Interesse em compra" : "Lead"}`;
    if (isCritical(text)) {
      const suggested = await generateBotReply(text, history, context);
      await q(
        `UPDATE conversations SET doc = jsonb_set(doc, '{hermesSuggestedReply}', to_jsonb($2::text)) WHERE conversation_id=$1`,
        [convId, String(suggested)]
      );
      await audit("Hermes", "conversation", convId || null, "suggested", "hermesSuggestedReply", null, String(suggested).slice(0, 200), "whatsapp");
    } else {
      const reply = await generateBotReply(text, history, context);
      await sendWhatsapp(name, reply);
      await q(
        `INSERT INTO chat_messages (id, conversation_id, sender, sender_type, sender_name, text, timestamp, status)
         VALUES ($1,$2,'hermes','bot','Hermes',$3,now(),'sent') ON CONFLICT (id) DO NOTHING`,
        [`hermes-${convId}-${Date.now()}`, convId, String(reply)]
      );
      await audit("Hermes", "message", "bot", "sent", "text", null, String(reply).slice(0, 200), "whatsapp");
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

/* --------------------------- EVOLUTION WEBHOOK --------------------------- */
// POST /api/whatsapp/evolution-webhook  -> Evolution API envia MESSAGES_UPSERT
const EVO_BASE = process.env.EVO_BASE || "http://localhost:8080";
const EVO_KEY = process.env.EVO_KEY || "evo_2n_2npublicidade_2026_x9f3kq";
const EVO_INSTANCE = process.env.EVO_INSTANCE || "2npublicidade";

async function sendEvolutionMessage(phone: string, text: string): Promise<void> {
  try {
    const res = await fetch(`${EVO_BASE}/message/sendText/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ number: phone, text: text }),
    });
    const j = await res.json().catch(() => ({}));
    console.log("[evo-send]", res.status, JSON.stringify(j).slice(0, 100));
  } catch (e) {
    console.error("[evo-send] erro", (e as Error).message);
  }
}

/* Envia áudio (MP3 base64 ou URL) via Evolution */
async function sendEvolutionAudio(phone: string, audioUrl: string): Promise<void> {
  try {
    const res = await fetch(`${EVO_BASE}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ number: phone, audio: audioUrl, mimetype: "audio/mpeg" }),
    });
    const j = await res.json().catch(() => ({}));
    console.log("[evo-audio]", res.status, JSON.stringify(j).slice(0, 100));
  } catch (e) {
    console.error("[evo-audio] erro", (e as Error).message);
  }
}

/* Gera áudio a partir de texto -> devolve URL servida pelo CRM.
   Tenta ElevenLabs primeiro; se indisponível (conta Free/sem crédito), usa Google TTS (grátis, PT-PT). */
async function elevenTTSForWhatsApp(text: string): Promise<string | null> {
  const fs = require("fs");
  const path = require("path");
  const dir = "/root/crm-saas/public/voice";
  fs.mkdirSync(dir, { recursive: true });
  const file = `wa_${Date.now()}.mp3`;
  const EL_KEY = process.env.ELEVENLABS_API_KEY;
  const EL_VOICE = process.env.ELEVENLABS_VOICE_ID;

  // 1) ElevenLabs (se key válida e com permissão)
  if (EL_KEY && EL_VOICE && EL_KEY.startsWith("sk_")) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
        method: "POST",
        headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.4, similarity_boost: 0.7 } }),
      });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(path.join(dir, file), buf);
        return `${process.env.INTERNAL_URL || "http://127.0.0.1:8095"}/voice_audio/${file}`;
      }
      console.error("[eleven] falhou", r.status, (await r.text()).slice(0, 100));
    } catch (e) {
      console.error("[eleven] erro", (e as Error).message);
    }
  }

  // 2) Fallback: Google Translate TTS (grátis, PT-PT) — voz robótica mas funciona sem custo
  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 400))}&tl=pt-PT&client=tw-ob`;
    const r2 = await fetch(ttsUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (r2.ok) {
      const buf = Buffer.from(await r2.arrayBuffer());
      fs.writeFileSync(path.join(dir, file), buf);
      return `${process.env.INTERNAL_URL || "http://127.0.0.1:8095"}/voice_audio/${file}`;
    }
    console.error("[google-tts] falhou", r2.status);
  } catch (e) {
    console.error("[google-tts] erro", (e as Error).message);
  }
  return null;
}

async function storeAttachment(phone: string, msgObj: any): Promise<{ url: string; name: string; mime: string; size: number; kind: string } | null> {
  try {
    const img = msgObj.imageMessage || msgObj.videoMessage || msgObj.documentMessage || msgObj.audioMessage;
    if (!img) return null;
    const mediaUrl = img.url || (img.jpgThumbnail ? null : null);
    const caption = msgObj.imageMessage?.caption || msgObj.documentMessage?.caption || msgObj.videoMessage?.caption || "";
    const fileName = (msgObj.documentMessage?.fileName) || `arte_${Date.now()}.${img.mimetype?.split("/")[1] || "bin"}`;
    const mime = img.mimetype || "application/octet-stream";
    if (!mediaUrl) return null;
    // download
    const dir = "/root/crm-saas/public/production";
    require("fs").mkdirSync(dir, { recursive: true });
    const local = `${dir}/${phone}_${Date.now()}_${fileName.replace(/[^\w.\-]/g, "_")}`;
    const r = await fetch(mediaUrl, { headers: { apikey: EVO_KEY } });
    if (!r.ok) { console.error("[store] download falhou", r.status); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    require("fs").writeFileSync(local, buf);
    const rel = `/production/${require("path").basename(local)}`;
    // Classificar tipo de ficheiro (ponto 8 do briefing)
    const lower = (fileName + " " + caption).toLowerCase();
    let kind = "arte";
    if (/(logo|logotipo|marca)/.test(lower)) kind = "logotipo";
    else if (/(comprov|pagamento|recibo|transf|iban|factur|fatura)/.test(lower)) kind = "comprovativo";
    else if (/(ref|exemplo|modelo|amostra)/.test(lower)) kind = "referencia";
    else if (/(foto|imagem|fotografia)/.test(lower)) kind = "fotografia";
    else if (/(pdf|doc|docx|txt)/.test(lower) || mime.includes("pdf") || mime.includes("word")) kind = "documento";
    else if (/(producao|print|final|arte_final)/.test(lower)) kind = "ficheiro_producao";
    return { url: rel, name: fileName, mime, size: buf.length, kind };
  } catch (e) {
    console.error("[store] erro", (e as Error).message);
    return null;
  }
}

r.post("/evolution-webhook", wrap(async (req, res) => {
  const b = req.body || {};
  const event = b.event || "";
  if (event !== "messages.upsert") return res.json({ ok: true, skipped: "not messages.upsert" });

  const data = b.data || {};
  const key = data.key || {};
  const fromMe = key.fromMe === true;
  if (fromMe) return res.json({ ok: true, skipped: "outgoing" });

  try {
  const remoteJid = key.remoteJid || "";
  const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
  const pushName = data.pushName || "Cliente";
  const msgObj = data.message || {};
  const text =
    msgObj.conversation ||
    (msgObj.extendedTextMessage && msgObj.extendedTextMessage.text) ||
    (msgObj.imageMessage && msgObj.imageMessage.caption) ||
    (msgObj.documentMessage && msgObj.documentMessage.caption) ||
    (msgObj.videoMessage && msgObj.videoMessage.caption) ||
    "";
  const clienteEnviouAudio = !!msgObj.audioMessage;
  const pediuAudio = /(manda\s+audio|envia\s+audio|mandar\s+audio|liga\s+ai|manda\s+um\s+audio|quero\s+ouvir|em\s+audio)/i.test(text);
  const convId = `evo-${phone}`;
  const customer_id = await resolveCustomer({ name: pushName, phone, email: null });

  await q(
    `INSERT INTO conversations (conversation_id, customer_id, channel, last_message, last_message_time, doc)
     VALUES ($1,$2,'whatsapp',$3,now(),$4) ON CONFLICT (conversation_id) DO NOTHING`,
    [convId, customer_id, String(text || "[arte enviada]").slice(0, 500), JSON.stringify({ source: "evolution" })]
  );
  await q(
    `UPDATE conversations SET customer_id=COALESCE($2,customer_id), last_message=$3, last_message_time=now() WHERE conversation_id=$1`,
    [convId, customer_id, String(text || "[arte enviada]").slice(0, 500)]
  );

  // anexo (arte) -> Area de Producao
  const att = await storeAttachment(phone, msgObj);
  const attachments = att ? [att] : [];
  await q(
    `INSERT INTO chat_messages (id, conversation_id, sender, sender_type, text, timestamp, status, message_id, attachments)
     VALUES ($1,$2,'client','customer',$3,now(),'received',$4,$5) ON CONFLICT (id) DO NOTHING`,
    [`evo-${convId}-${Date.now()}`, convId, String(text || "[arte]"), `evo-${key.id || Date.now()}`, JSON.stringify(attachments)]
  );

  let lead: any = {};
  try { lead = await extractLead(text || "envio de arte para producao"); } catch (e) { console.error("[evo] extractLead", (e as Error).message); }
  let ctx: any = {};
  try { ctx = await extractContext(text); } catch (e) { console.error("[evo] extractContext", (e as Error).message); }

  // Qualificar lead: marcar customer como lead
  if (customer_id) {
    await q(
      `UPDATE customers SET status=COALESCE(NULLIF(status,''),'lead') WHERE customer_id=$1`,
      [customer_id]
    );
    await q(
      `UPDATE conversations SET doc=jsonb_set(COALESCE(doc,'{}'),'{lead}',to_jsonb($2::text)) WHERE conversation_id=$1`,
      [convId, JSON.stringify({ intent: lead.intent, produto: lead.produto, quantidade: lead.quantidade, empresa: lead.empresa, observacoes: lead.observacoes })]
    );
  }

  // Se intenção de compra e não enviou arte -> criar/atualizar pedido estruturado + tarefa
  if (lead.intent === "compra" && !att) {
    // Usar pedido em foco (memória) APENAS se o pedido ainda existir — NÃO duplicar
    const { rows: foco } = await q(`SELECT doc->>'pedidoFoco' AS pf FROM conversations WHERE conversation_id=$1`, [convId]);
    const focoId = (foco[0]?.pf && foco[0].pf !== "") ? foco[0].pf : null;
    let order_id: string | null = null;
    if (focoId) {
      const { rows: ex } = await q(`SELECT order_id FROM orders WHERE order_id=$1`, [focoId]);
      if (ex[0]) order_id = focoId;
    }
    if (!order_id) {
      const { rows: open } = await q(
        `SELECT o.order_id FROM orders o WHERE o.customer_id=$1 AND o.status IN ('NOVO','ORÇAMENTO','EM PRODUÇÃO','AGUARDANDO CLIENTE','EM ANÁLISE') ORDER BY o.created_at DESC LIMIT 1`,
        [customer_id]
      );
      order_id = open[0]?.order_id || null;
    }
    const docPedido = {
      source: "whatsapp",
      produto: lead.produto || "",
      quantidade: lead.quantidade || "",
      dimensoes: lead.dimensoes || "",
      material: lead.material || "",
      acabamento: lead.acabamento || "",
      prazo: ctx.prazo_texto || lead.prazo || "",
      valor: lead.preco || "",
      observacoes: lead.observacoes || "",
    };
    if (!order_id) {
      try {
        order_id = await genId("PED", "orders-YYYY");
      } catch (e) {
        console.error("[evo] genId", (e as Error).message);
        order_id = `PED-${new Date().getFullYear()}-${Date.now()}`;
      }
      await q(
        `INSERT INTO orders (order_id, customer_id, conversation_id, status, doc)
         VALUES ($1,$2,$3,'EM ANÁLISE',$4)`,
        [order_id, customer_id, convId, JSON.stringify(docPedido)]
      );
    } else {
      // atualizar campos já conhecidos sem perder os existentes
      await q(`UPDATE orders SET doc=jsonb_set(COALESCE(doc,'{}'),'{produto}',to_jsonb($2::text)), status=COALESCE(NULLIF(status,''),'EM ANÁLISE') WHERE order_id=$1`,
        [order_id, docPedido.produto || ""]);
      await q(`UPDATE orders SET doc=jsonb_set(doc,'{quantidade}',to_jsonb($2::text)) WHERE order_id=$1 AND $2::text <> ''`, [order_id, String(docPedido.quantidade || "")]);
      await q(`UPDATE orders SET doc=jsonb_set(doc,'{dimensoes}',to_jsonb($2::text)) WHERE order_id=$1 AND $2::text <> ''`, [order_id, docPedido.dimensoes || ""]);
      await q(`UPDATE orders SET doc=jsonb_set(doc,'{material}',to_jsonb($2::text)) WHERE order_id=$1 AND $2::text <> ''`, [order_id, docPedido.material || ""]);
      await q(`UPDATE orders SET doc=jsonb_set(doc,'{acabamento}',to_jsonb($2::text)) WHERE order_id=$1 AND $2::text <> ''`, [order_id, docPedido.acabamento || ""]);
      await q(`UPDATE orders SET doc=jsonb_set(doc,'{prazo}',to_jsonb($2::text)) WHERE order_id=$1 AND $2::text <> ''`, [order_id, docPedido.prazo || ""]);
    }
    // memória: guardar pedido em foco
    await q(`UPDATE conversations SET doc=jsonb_set(COALESCE(doc,'{}'),'{pedidoFoco}',to_jsonb($2::text)) WHERE conversation_id=$1`, [convId, order_id]);
    // garantir production_order
    const { rows: po } = await q(`SELECT production_id FROM production_orders WHERE order_id=$1`, [order_id]);
    let prod_id = po[0]?.production_id || null;
    if (!prod_id) {
      prod_id = await genId("PRD", "prod-YYYY");
      await q(
        `INSERT INTO production_orders (id, production_id, order_id, customer_id, stage, status_badge, created_at)
         VALUES ($1,$2,$3,$4,'recebido','aberto',now())`,
        [prod_id, prod_id, order_id, customer_id]
      );
    }
  }

  // PRAZO -> tarefa/calendar_event (ponto 13 do briefing) — corre SEMPRE que haja prazo detetado
  if (ctx.data_entrega || ctx.prazo_texto) {
    // encontrar pedido deste cliente (aberto ou o em foco)
    const { rows: focoC } = await q(`SELECT doc->>'pedidoFoco' AS pf FROM conversations WHERE conversation_id=$1`, [convId]);
    const { rows: openC } = await q(
      `SELECT o.order_id FROM orders o WHERE o.customer_id=$1 AND o.status IN ('NOVO','ORÇAMENTO','EM PRODUÇÃO','AGUARDANDO CLIENTE','EM ANÁLISE') ORDER BY o.created_at DESC LIMIT 1`,
      [customer_id]
    );
    let order_id_prazo = (focoC[0]?.pf && focoC[0].pf !== "") ? focoC[0].pf : (openC[0]?.order_id || null);
    if (order_id_prazo) {
      const { rows: ex } = await q(`SELECT order_id FROM orders WHERE order_id=$1`, [order_id_prazo]);
      if (!ex[0]) order_id_prazo = null;
    }
    const due = ctx.data_entrega ? new Date(ctx.data_entrega + "T" + (ctx.hora_entrega || "09:00")) : null;
    const title = `Prazo: ${lead.produto || "Pedido"} (${order_id_prazo || "sem pedido"})`;
    await q(`INSERT INTO tasks (id, title, due_date, due_time, priority, origin, customer_id, order_id, doc_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [await genId("TASK", "tasks"), title, due ? due.toISOString().slice(0,10) : null, ctx.hora_entrega || null, ctx.urgencia ? "URGENTE" : "NORMAL", "whatsapp", customer_id, order_id_prazo, JSON.stringify({ source: "whatsapp", conversation_id: convId })]);
    if (due) {
      await q(`INSERT INTO calendar_events (title, description, start_time, type, priority, customer_id, order_id, conversation_id, source, doc)
        VALUES ($1,$2,$3,'entrega',$4,$5,$6,$7,'whatsapp',$8) ON CONFLICT DO NOTHING`,
        [title, `Prazo combinado via WhatsApp (${ctx.prazo_texto || ctx.hora_entrega || ""})`, due.toISOString(), ctx.urgencia ? "URGENTE" : "NORMAL", customer_id || null, order_id_prazo || null, convId, JSON.stringify({ conversation_id: convId })]);
    }
  }

  // Se enviou arte -> garantir production_files + notificar + validação humana
  if (att) {
    // Usar pedido em foco (memória) ou o aberto mais recente — NÃO duplicar
    const { rows: focoA } = await q(`SELECT doc->>'pedidoFoco' AS pf FROM conversations WHERE conversation_id=$1`, [convId]);
    const { rows: openA } = await q(
      `SELECT o.order_id FROM orders o WHERE o.customer_id=$1 AND o.status IN ('NOVO','ORÇAMENTO','EM PRODUÇÃO','AGUARDANDO CLIENTE','EM ANÁLISE') ORDER BY o.created_at DESC LIMIT 1`,
      [customer_id]
    );
    let order_id = focoA[0]?.pf || openA[0]?.order_id || null;
    if (!order_id) {
      order_id = await genId("PED", "orders-YYYY");
      await q(
        `INSERT INTO orders (order_id, customer_id, conversation_id, status, doc)
         VALUES ($1,$2,$3,'EM PRODUÇÃO',$4)`,
        [order_id, customer_id, convId, JSON.stringify({ source: "whatsapp_arte" })]
      );
    } else if (att.kind === "arte" || att.kind === "ficheiro_producao") {
      // arte recebida -> aguarda validação humana (ponto 9)
      await q(`UPDATE orders SET status='AGUARDANDO APROVAÇÃO' WHERE order_id=$1 AND status NOT IN ('CONCLUIDO','ENTREGUE')`, [order_id]);
    }
    // garantir production_order
    const { rows: po } = await q(`SELECT production_id FROM production_orders WHERE order_id=$1`, [order_id]);
    let prod_id = po[0]?.production_id || null;
    if (!prod_id) {
      prod_id = await genId("PRD", "prod-YYYY");
      await q(
        `INSERT INTO production_orders (id, production_id, order_id, customer_id, stage, status_badge, created_at)
         VALUES ($1,$2,$3,$4,'recebido','aberto',now())`,
        [prod_id, prod_id, order_id, customer_id]
      );
    }
    // production_file (order_id referencia production_orders.id), com tipo classificado
    const file_id = await genId("FILE", "files-YYYY");
    await q(
      `INSERT INTO production_files (id, file_id, order_id, customer_id, name, type, size, url, uploaded_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),'recebido') ON CONFLICT DO NOTHING`,
      [file_id, file_id, prod_id, customer_id, att.name, att.kind || att.mime, att.size, att.url]
    );
    // notificar equipa
    await audit("Hermes", "production_file", file_id, "received", "storage_url", att.url, "whatsapp");
  }

  // Auto-resposta Hermes (bot) — com memória de contexto
  const { rows: st } = await q(`SELECT doc FROM company_settings WHERE id=1`);
  const stDoc = (st[0] as any)?.doc || {};
  const autoReplyOn = (process.env.AUTO_REPLY === "true") || (stDoc.autoReply === true);
  if (autoReplyOn) {
    const { rows: hist } = await q(
      `SELECT sender, text FROM chat_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 15`,
      [convId]
    );
    const history = hist.map((m: any) => (m.sender === "client" ? `Cliente: ${m.text}` : `Hermes: ${m.text}`)).reverse();
    const context = await buildContext(convId, customer_id, lead);
    if (isCritical(text)) {
      const suggested = await generateBotReply(text, history, context);
      await q(
        `UPDATE conversations SET doc = jsonb_set(doc, '{hermesSuggestedReply}', to_jsonb($2::text)) WHERE conversation_id=$1`,
        [convId, String(suggested)]
      );
    } else {
      const reply = await generateBotReply(text, history, context);
      await sendEvolutionMessage(phone, reply);
      // Áudio via ElevenLabs se cliente enviou áudio primeiro OU pediu áudio (regra Nino)
      if (clienteEnviouAudio || pediuAudio) {
        const audioUrl = await elevenTTSForWhatsApp(reply);
        if (audioUrl) await sendEvolutionAudio(phone, audioUrl);
      }
      await q(
        `INSERT INTO chat_messages (id, conversation_id, sender, sender_type, sender_name, text, timestamp, status)
         VALUES ($1,$2,'hermes','bot','Hermes',$3,now(),'sent') ON CONFLICT (id) DO NOTHING`,
        [`hermes-${convId}-${Date.now()}`, convId, String(reply)]
      );
      // Guardar o que foi perguntado (para não repetir depois)
      const perguntou = (context.jaPerguntado ? context.jaPerguntado + "; " : "") + reply.slice(0, 120);
      await q(`UPDATE conversations SET doc=jsonb_set(COALESCE(doc,'{}'),'{jaPerguntado}',to_jsonb($2::text)) WHERE conversation_id=$1`, [convId, perguntou]);
    }
  }

  res.json({ ok: true, phone, convId, intent: lead.intent, hasAttachment: !!att });
  } catch (e) {
    const stack = (e as Error).stack || (e as Error).message;
    console.error("[evo-webhook] erro", stack);
    require("fs").writeFileSync("/tmp/evo_err.log", String(stack) + "\n");
    res.status(500).json({ error: (e as Error).message });
  }
}));

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
