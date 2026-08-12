/**
 * voice.ts — Módulo de Voz 2N (Twilio + ElevenLabs + Groq Whisper)
 *
 * ATENDEDOR AUTOMÁTICO:
 *   - Cliente liga → Twilio → POST /api/voice/inbound
 *   - Hermes carrega contexto (último pedido do cliente na BD)
 *   - Gera resposta (LLM) → ElevenLabs TTS → Twilio reproduz
 *   - Ouve cliente (Groq Whisper STT) → loop de conversa
 *
 * CHAMADAS OUTBOUND (confirmação / lembrete / cobrança):
 *   - Hermes decide ligar (gatilho de tarefa/pedido) → POST /api/voice/outbound
 *   - Mesmo fluxo de voz, com propósito explícito
 *
 * CREDENCIAIS (em .env):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER
 *   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (voz PT-BR/PT-PT)
 *   GROQ_API_KEY (já existe — Whisper grátis)
 */

import { q, genId } from "./db";

/* ----------------------------- config ----------------------------- */
const TW_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TW_NUMBER = process.env.TWILIO_NUMBER || "";
const EL_KEY = process.env.ELEVENLABS_API_KEY || "";
const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel (EN) default; trocar p/ PT
const GROQ_KEY = process.env.GROQ_API_KEY || "";

export function voiceEnabled(): boolean {
  return Boolean(TW_SID && TW_TOKEN && EL_KEY);
}

/** Lê do ficheiro /root/.twilio_key.txt se o env não tiver */
function loadTwilioFromFile() {
  try {
    const fs = require("fs");
    const txt = fs.readFileSync("/root/.twilio_key.txt", "utf8");
    const m = (k: string) => {
      const line = txt.split("\n").find((l: string) => l.startsWith(k));
      return line ? line.split("=")[1].trim() : "";
    };
    if (!TW_SID) process.env.TWILIO_ACCOUNT_SID = m("TWILIO_ACCOUNT_SID");
    if (!TW_TOKEN) process.env.TWILIO_AUTH_TOKEN = m("TWILIO_AUTH_TOKEN");
    if (!TW_NUMBER) process.env.TWILIO_NUMBER = m("TWILIO_NUMBER");
  } catch { /* ignore */ }
}
loadTwilioFromFile();

/* ----------------------------- helpers TwiML ----------------------------- */
function twimlSay(text: string, opts: { voice?: string; gather?: boolean; action?: string; finish?: number } = {}) {
  const voice = opts.voice || "alice"; // Twilio built-in PT-BR; ElevenLabs usado via <Play> abaixo
  if (opts.gather) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="${opts.finish || 5}" action="${opts.action || ""}" method="POST" speechTimeout="auto">
    <Say voice="${voice}">${escapeXml(text)}</Say>
  </Gather>
  <Say voice="${voice}">Não consegui ouvir. Até logo.</Say>
  <Hangup/>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(text)}</Say>
  <Hangup/>
</Response>`;
}

function twimlPlayAudio(url: string, gatherAction?: string, finish = 6) {
  if (gatherAction) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="${finish}" action="${gatherAction}" method="POST" speechTimeout="auto">
    <Play>${escapeXml(url)}</Play>
  </Gather>
  <Say voice="alice">Não consegui ouvir. Até logo.</Say>
  <Hangup/>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${escapeXml(url)}</Play>
  <Hangup/>
</Response>`;
}

function escapeXml(s: string): string {
  return (s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] || c));
}

/* ----------------------------- ElevenLabs TTS ----------------------------- */
/**
 * Gera áudio via ElevenLabs e devolve URL pública (ou base64 data URL).
 * Guardamos num ficheiro temporário servido pelo CRM em /api/voice/audio/:id
 */
export async function elevenTTS(text: string, callId: string): Promise<string> {
  if (!EL_KEY) throw new Error("ELEVENLABS_API_KEY em falta");
  const fs = require("fs");
  const path = require("path");
  const dir = "/root/crm-saas/public/voice";
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${callId}.mp3`);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
    method: "POST",
    headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.7 },
    }),
  });
  if (!r.ok) throw new Error("ElevenLabs TTS falhou: " + (await r.text()).slice(0, 200));
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
  return `/api/voice/audio/${callId}.mp3`;
}

/* TTS para chamadas Twilio: ElevenLabs se disponível, senão Google TTS (grátis, PT-PT) */
async function ttsForVoice(text: string, callId: string): Promise<string> {
  // 1) ElevenLabs (se key válida e com permissão)
  if (EL_KEY && EL_VOICE && EL_KEY.startsWith("sk_")) {
    try {
      return await elevenTTS(text, callId);
    } catch (e) {
      console.error("[voice] eleven falhou, usa google tts", (e as Error).message);
    }
  }
  // 2) Google TTS (grátis, PT-PT)
  const fs = require("fs");
  const path = require("path");
  const dir = "/root/crm-saas/public/voice";
  fs.mkdirSync(dir, { recursive: true });
  const file = `${callId}.mp3`;
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 400))}&tl=pt-PT&client=tw-ob`;
  const r = await fetch(ttsUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("Google TTS falhou: " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(dir, file), buf);
  return `/api/voice/audio/${file}`;
}

/* ----------------------------- Groq Whisper STT (GRÁTIS) ----------------------------- */
export async function groqWhisper(audioUrl: string): Promise<string> {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY em falta");
  // Descarrega o áudio do Twilio
  const audioRes = await fetch(audioUrl);
  const audioBuf = Buffer.from(await audioRes.arrayBuffer());
  const fs = require("fs");
  const path = require("path");
  const tmp = path.join("/tmp", `whisper_${Date.now()}.wav`);
  fs.writeFileSync(tmp, audioBuf);
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(tmp)], { type: "audio/wav" }), "audio.wav");
  form.append("model", "whisper-large-v3");
  form.append("language", "pt");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: form,
  });
  fs.unlinkSync(tmp);
  if (!r.ok) throw new Error("Whisper falhou: " + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.text || "";
}

/* ----------------------------- Contexto do CRM ----------------------------- */
async function loadCustomerContext(phone: string): Promise<{ customer_id: string | null; lastOrder: any; name: string }> {
  const clean = phone.replace(/\D/g, "").slice(-9);
  const { rows: cust } = await q(
    `SELECT customer_id, name FROM customers WHERE phone LIKE $1 OR phone LIKE $2 LIMIT 1`,
    [`%${clean}`, `%${clean}%`]
  );
  const customer_id = cust[0]?.customer_id || null;
  let lastOrder: any = null;
  if (customer_id) {
    const { rows: ord } = await q(
      `SELECT order_id, status, doc FROM orders WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [customer_id]
    );
    lastOrder = ord[0] || null;
  }
  return { customer_id, lastOrder, name: cust[0]?.name || "Cliente" };
}

/* Gera a fala do Hermes com base no contexto (LLM via Groq, já existe) */
async function hermesSpeak(prompt: string): Promise<string> {
  if (!GROQ_KEY) return "Estamos a atender a sua chamada. Um momento.";
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "És o Hermes, atendedor telefónico da 2N Publicidade (Luanda). Fala em português de Angola, frases curtas (1-2), tom humano e direto. Nunca dizes que és IA. Se não souberes, diz que vai confirmar e liga depois." },
        { role: "user", content: prompt },
      ],
      max_tokens: 120,
      temperature: 0.4,
    }),
  });
  if (!r.ok) return "Um momento que já lhe atendo.";
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || "Um momento que já lhe atendo.";
}

/* ----------------------------- Handlers Twilio ----------------------------- */
/**
 * Inbound: cliente liga.
 * Passo 1: atende e pergunta como ajudar (com contexto do pedido se houver).
 * Passo 2: recebe o SpeechResult → STT → Hermes responde → loop.
 */
export async function voiceInbound(req: any, res: any) {
  const phone = req.body?.From || "";
  const callSid = req.body?.CallSid || "";
  const speech = req.body?.SpeechResult || "";
  const callId = `CALL-${Date.now()}`;

  // Primeira interação (sem SpeechResult)
  if (!speech) {
    const ctx = await loadCustomerContext(phone);
    let saudacao = `Olá! Aqui é o Hermes da 2N Publicidade. Em que posso ajudar?`;
    if (ctx.lastOrder) {
      const o = ctx.lastOrder;
      const doc = o.doc || {};
      saudacao = `Olá ${ctx.name || "bom dia"}! Da 2N Publicidade. Vejo que tem o pedido ${o.order_id} (${doc.produto || "trabalho"}). Em que posso ajudar?`;
    }
    // Registar chamada
    await q(
      `INSERT INTO calls (id, direction, customer_id, phone, purpose, status, call_sid, doc)
       VALUES ($1,'inbound',$2,$3,'atendimento','em_curso',$4,'{}') ON CONFLICT DO NOTHING`,
      [callId, ctx.customer_id, phone, callSid]
    );
    // TTS (ElevenLabs → Google TTS fallback PT-PT)
    try {
      const url = await ttsForVoice(saudacao, callId);
      return res.type("text/xml").send(twimlPlayAudio(url, `/api/voice/inbound?callId=${callId}`, 6));
    } catch {
      // fallback Twilio built-in
      return res.type("text/xml").send(twimlSay(saudacao, { voice: "alice", gather: true, action: `/api/voice/inbound?callId=${callId}`, finish: 6 }));
    }
  }

  // Interações seguintes: cliente falou
  const callId2 = (req.query.callId as string) || callId;
  const ctx = await loadCustomerContext(phone);
  let transcript = speech;
  // STT já vem do Twilio (SpeechResult). Se quiseres Groq Whisper, usa o áudio em /api/voice/transcribe
  const reply = await hermesSpeak(
    `Cliente (${ctx.name}) disse: "${transcript}". Contexto: ${ctx.lastOrder ? "pedido " + ctx.lastOrder.order_id + " status " + ctx.lastOrder.status : "sem pedido"}.
     Responde como atendedor da 2N. Se o cliente quiser falar com humano, diz que transfere. Se for pedido/orçamento, confirma dados básicos.`
  );
  await q(`UPDATE calls SET transcript=COALESCE(transcript,'')||$1, hermes_said=COALESCE(hermes_said,'')||$2 WHERE id=$3`,
    [`\nC: ${transcript}`, `\nH: ${reply}`, callId2]);
  try {
    const url = await ttsForVoice(reply, callId2 + "-r" + Date.now());
    return res.type("text/xml").send(twimlPlayAudio(url, `/api/voice/inbound?callId=${callId2}`, 6));
  } catch {
    return res.type("text/xml").send(twimlSay(reply, { voice: "alice", gather: true, action: `/api/voice/inbound?callId=${callId2}`, finish: 6 }));
  }
}

/**
 * Outbound: Hermes liga (confirmação / lembrete / cobrança).
 * Disparado por tarefa do CRM ou manualmente via POST /api/voice/outbound
 */
export async function voiceOutbound(req: any, res: any) {
  const { customer_id, order_id, phone, purpose, message } = req.body || {};
  if (!phone && !customer_id) return res.status(400).json({ error: "phone ou customer_id obrigatório" });
  const callId = await genId("CALL", "calls");
  const ctx = customer_id ? await loadCustomerContext(phone || "") : { customer_id, lastOrder: null, name: "Cliente" };
  if (order_id) ctx.lastOrder = (await q(`SELECT order_id, status, doc FROM orders WHERE order_id=$1`, [order_id])).rows[0] || null;

  let intro = message || "Olá, fala o Hermes da 2N Publicidade.";
  if (purpose === "confirmacao" && ctx.lastOrder) intro = `Olá ${ctx.name}! Ligamos para confirmar o seu pedido ${ctx.lastOrder.order_id}. Está tudo certo para seguir?`;
  if (purpose === "lembrete" && ctx.lastOrder) intro = `Olá ${ctx.name}! Este é um lembrete da 2N sobre o pedido ${ctx.lastOrder.order_id} com prazo pendente. Quando podemos contar consigo?`;
  if (purpose === "cobranca" && ctx.lastOrder) intro = `Olá ${ctx.name}! Da 2N Publicidade, lembrar que o pedido ${ctx.lastOrder.order_id} tem um valor em aberto. Pode fazer o pagamento hoje?`;

  await q(
    `INSERT INTO calls (id, direction, customer_id, order_id, phone, purpose, status, call_sid, doc)
     VALUES ($1,'outbound',$2,$3,$4,$5,'iniciada',NULL,'{}')`,
    [callId, customer_id || null, order_id || null, phone || null, purpose || "outro"]
  );

  // TwiML inicial (Twilio vailigar e tocar isto)
  try {
    const url = await ttsForVoice(intro, callId);
    return res.type("text/xml").send(twimlPlayAudio(url, `/api/voice/inbound?callId=${callId}`, 6));
  } catch {
    return res.type("text/xml").send(twimlSay(intro, { voice: "alice", gather: true, action: `/api/voice/inbound?callId=${callId}`, finish: 6 }));
  }
}

/** Endpoint para o Twilio iniciar a chamada outbound (retorna TwiML) */
export async function voiceOutboundTwiml(req: any, res: any) {
  const { phone, purpose, order_id, customer_id } = req.query;
  // Redireciona para o handler que gera o TwiML
  return voiceOutbound({ body: { phone, purpose, order_id, customer_id } } as any, res);
}
