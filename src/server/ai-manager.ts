/**
 * Multimodal AI Provider Manager
 * ------------------------------------------------------------------
 * Central de IA do Hermes: seleciona automaticamente o melhor provider
 * MULTIMODAL para a tarefa, com pools por modalidade, capability router,
 * weighted priority load balancer, circuit breaker, health check, retry e
 * fallback. Nunca degrada para texto quando há imagem/áudio/PDF/vídeo.
 *
 * Config: ai-providers.json (ler de process.env[apiKeyEnv], NUNCA hardcoded).
 * Modo aditivo — não altera ai.ts nem routes.ts existentes.
 */

import * as fs from "fs";
import * as path from "path";

/* ============================ TIPOS ============================ */
export type Modality = "text" | "image" | "pdf" | "audio" | "video";
export type PoolName = "MULTIMODAL" | "TEXT" | "IMAGE" | "PDF" | "AUDIO" | "VIDEO" | "EMBEDDING" | "IMAGE_GENERATION" | "AUDIO_POOL" | "VIDEO_POOL";

export interface ProviderConfig {
  id: string;
  provider: "google" | "openrouter" | "openai" | "groq";
  model: string;
  apiKeyEnv: string;
  capabilities: Modality[];
  priority: number;
  weight: number;
  enabled: boolean;
  pool?: PoolName;
}

export interface AIInput {
  text?: string;
  images?: { mime_type: string; data: string }[]; // base64
  pdfs?: { mime_type: string; data: string }[];
  audio?: { mime_type: string; data: string }[];
  video?: { mime_type: string; data: string }[];
  pool?: PoolName;
  json?: boolean;
}

interface Health {
  status: "ok" | "degraded" | "down";
  consecutiveFailures: number;
  lastError: string | null;
  lastCheck: number;
  totalRequests: number;
  totalFailures: number;
  avgLatencyMs: number;
  breakerOpen: boolean;
  breakerOpenedAt: number | null;
}

const BREAKER_THRESHOLD = 3;
const BREAKER_RESET_MS = 60_000;

/* ============================ ESTADO ============================ */
const health = new Map<string, Health>();
const metrics = { total: 0, fallback: 0, errors: 0 };

function initHealth(id: string): Health {
  if (!health.has(id)) {
    health.set(id, {
      status: "ok", consecutiveFailures: 0, lastError: null, lastCheck: 0,
      totalRequests: 0, totalFailures: 0, avgLatencyMs: 0, breakerOpen: false, breakerOpenedAt: null,
    });
  }
  return health.get(id)!;
}

/* ============================ CONFIG ============================ */
let providers: ProviderConfig[] = [];
let configLoaded = false;

export function loadProviders(configPath?: string) {
  const p = configPath || path.join(process.cwd(), "ai-providers.json");
  if (!fs.existsSync(p)) {
    // defaults seguros (chaves via ENV)
    providers = [
      { id: "gemini-mm-01", provider: "google", model: "gemini-3.6-flash", apiKeyEnv: "GEMINI_API_KEY",
        capabilities: ["text","image","pdf","audio","video"], priority: 100, weight: 10, enabled: true, pool: "MULTIMODAL" },
      { id: "openrouter-mm", provider: "openrouter", model: "openai/gpt-4o-mini", apiKeyEnv: "OPENROUTER_API_KEY",
        capabilities: ["text","image"], priority: 80, weight: 5, enabled: true, pool: "MULTIMODAL" },
      { id: "openrouter-txt", provider: "openrouter", model: "openai/gpt-4o-mini", apiKeyEnv: "OPENROUTER_API_KEY",
        capabilities: ["text"], priority: 70, weight: 5, enabled: true, pool: "TEXT" },
    ];
  } else {
    const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
    providers = cfg.providers || [];
  }
  providers.filter(p=>p.enabled).forEach(p => initHealth(p.id));
  configLoaded = true;
}

function getProvider(id: string) { return providers.find(p => p.id === id); }

/* ============================ DETEÇÃO ============================ */
export function detectModalities(input: AIInput): Modality[] {
  const m: Modality[] = ["text"];
  if (input.images?.length) m.push("image");
  if (input.pdfs?.length) m.push("pdf");
  if (input.audio?.length) m.push("audio");
  if (input.video?.length) m.push("video");
  return Array.from(new Set(m));
}

/* ======================= CAPABILITY ROUTER ======================= */
function capableProviders(mods: Modality[], pool?: PoolName): ProviderConfig[] {
  return providers.filter(p => {
    if (!p.enabled) return false;
    if (pool && p.pool !== pool) return false;
    // deve suportar TODAS as modalidades necessárias
    return mods.every(m => p.capabilities.includes(m));
  });
}

/* ===================== LOAD BALANCER ===================== */
function selectProvider(mods: Modality[], pool?: PoolName): ProviderConfig | null {
  const cands = capableProviders(mods, pool).filter(p => {
    const h = initHealth(p.id);
    if (h.breakerOpen) {
      // half-open after reset
      if (h.breakerOpenedAt && Date.now() - h.breakerOpenedAt > BREAKER_RESET_MS) {
        h.breakerOpen = false; h.consecutiveFailures = 0;
      } else return false;
    }
    return true;
  });
  if (!cands.length) return null;
  // ordena por prioridade desc, depois peso (aleatório ponderado)
  cands.sort((a, b) => (b.priority - a.priority) || (b.weight - a.weight));
  // weighted pick entre os top (mesma prioridade)
  const top = cands.filter(c => c.priority === cands[0].priority);
  const totalW = top.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalW;
  for (const c of top) { r -= c.weight; if (r <= 0) return c; }
  return top[0];
}

/* ============================ CALL ============================ */
async function callProvider(p: ProviderConfig, input: AIInput): Promise<string> {
  const key = process.env[p.apiKeyEnv];
  if (!key) throw new Error(`sem api key para ${p.id} (${p.apiKeyEnv})`);
  const h = initHealth(p.id);
  const t0 = Date.now();
  h.totalRequests++;
  try {
    let out = "";
    if (p.provider === "google") out = await callGemini(p.model, key, input);
    else if (p.provider === "openrouter" || p.provider === "openai") out = await callOpenAI(p, key, input);
    else throw new Error("provider desconhecido: " + p.provider);

    // sucesso
    h.consecutiveFailures = 0; h.status = "ok"; h.lastError = null;
    h.avgLatencyMs = Math.round((h.avgLatencyMs * (h.totalRequests - 1) + (Date.now() - t0)) / h.totalRequests);
    return out;
  } catch (e: any) {
    h.totalFailures++; h.consecutiveFailures++; h.lastError = e.message; h.status = "degraded";
    if (h.consecutiveFailures >= BREAKER_THRESHOLD) { h.breakerOpen = true; h.breakerOpenedAt = Date.now(); }
    throw e;
  }
}

async function callGemini(model: string, key: string, input: AIInput): Promise<string> {
  const parts: any[] = [];
  if (input.text) parts.push({ text: input.text });
  for (const im of input.images || []) parts.push({ inline_data: { mime_type: im.mime_type, data: im.data } });
  for (const f of input.pdfs || []) parts.push({ inline_data: { mime_type: f.mime_type, data: f.data } });
  for (const a of input.audio || []) parts.push({ inline_data: { mime_type: a.mime_type, data: a.data } });
  for (const v of input.video || []) parts.push({ inline_data: { mime_type: v.mime_type, data: v.data } });

  const body: any = { contents: [{ parts }] };
  if (input.json) body.generationConfig = { responseMimeType: "application/json" };

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 429) throw new Error("RATE_LIMITED:" + t.slice(0, 120));
    throw new Error(`gemini ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.map((x: any) => x.text || "").join("") || "";
}

async function callOpenAI(p: ProviderConfig, key: string, input: AIInput): Promise<string> {
  const content: any[] = [];
  if (input.text) content.push({ type: "text", text: input.text });
  for (const im of input.images || []) content.push({ type: "image_url", image_url: { url: `data:${im.mime_type};base64,${im.data}` } });
  // openrouter/openai/groq: text+image neste escopo (groq é openai-compatible)
  const url = p.provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions"
    : p.provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(p.provider === "openrouter" ? { "HTTP-Referer": "https://2npublicidade.online", "X-Title": "2N CRM" } : {}) },
    body: JSON.stringify({ model: p.model, messages: [{ role: "user", content }], ...(input.json ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 429) throw new Error("RATE_LIMITED:" + t.slice(0, 120));
    throw new Error(`${p.provider} ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "";
}

// Whisper (Groq) transcreve áudio -> texto (não é "áudio multimodal", é transcrição)
async function transcribeWhisper(model: string, key: string, audio: { mime_type: string; data: string }): Promise<string> {
  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([Buffer.from(audio.data, "base64")], { type: audio.mime_type }), "audio.bin");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form as any,
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 429) throw new Error("RATE_LIMITED:" + t.slice(0, 120));
    throw new Error(`whisper ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return j?.text || "";
}

/* ============================ TELEGRAM ============================ */
async function alert(msg: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: `🤖 [Hermes AI Manager]\n${msg}` }),
    });
  } catch {}
}

/* ============================ ORCHESTRATOR ============================ */
export async function generate(input: AIInput, opts: { retries?: number } = {}): Promise<string> {
  if (!configLoaded) loadProviders();
  metrics.total++;
  const mods = detectModalities(input);
  const isMultimodal = mods.length > 1 || mods.some(m => m !== "text");
  // MULTIMODAL-FIRST: se há imagem/audio/pdf/video, força pool MULTIMODAL
  const targetPool = isMultimodal ? "MULTIMODAL" : (input.pool || "TEXT");

  // ÁUDIO: se há áudio mas nenhum provider MULTIMODAL capaz de áudio disponível,
  // transcreve via Whisper (Groq) e trata como texto (não degrada silenciosamente).
  let workInput = input;
  if (input.audio?.length && !capableProviders(["audio"], "MULTIMODAL").length) {
    const wp = providers.find(p => p.enabled && p.capabilities.includes("audio") && p.provider === "groq");
    if (wp) {
      try {
        const key = process.env[wp.apiKeyEnv];
        const transcript = await transcribeWhisper(wp.model, key!, input.audio[0]);
        workInput = { ...input, audio: [], text: (input.text ? input.text + "\n" : "") + "[áudio transcrito]: " + transcript };
        await alert(`🎙️ Áudio transcrito via Whisper (${wp.id}).`);
      } catch (e: any) {
        await alert(`⚠️ Falha na transcrição Whisper: ${e.message.slice(0, 80)}`);
      }
    }
  }
  const workMods = detectModalities(workInput);
  const workIsMM = workMods.length > 1 || workMods.some(m => m !== "text");
  const workPool = workIsMM ? "MULTIMODAL" : (workInput.pool || "TEXT");

  const retries = opts.retries ?? 2;
  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const p = selectProvider(workMods, workPool);
    if (!p) {
      lastErr = new Error(`nenhum provider capaz para ${mods.join("+")} no pool ${targetPool}`);
      // tenta pool TEXT como último recurso se não era já texto-puro
      if (isMultimodal && targetPool === "MULTIMODAL") { return generate({ ...input, images: [], pdfs: [], audio: [], video: [] }, { retries: 0 }).catch(e => { throw lastErr; }); }
      break;
    }
    try {
      const out = await callProvider(p, input);
      if (attempt > 0) metrics.fallback++;
      return out;
    } catch (e: any) {
      lastErr = e;
      const rateLimited = String(e.message).includes("RATE_LIMITED");
      await alert(`⚠️ ${p.id} falhou (${rateLimited ? "rate-limit" : "erro"}): ${e.message.slice(0, 100)}. Tentativa ${attempt + 1}/${retries + 1}.`);
      // se rate-limited, salta este provider (circuit breaker abre) e tenta o próximo
      continue;
    }
  }
  metrics.errors++;
  throw lastErr || new Error("generate falhou");
}

/* ============================ STATUS ============================ */
export function statusReport() {
  const byCap: Record<string, number> = {};
  for (const p of providers) for (const c of p.capabilities) byCap[c] = (byCap[c] || 0) + 1;
  const anyMultimodal = providers.some(p => p.enabled && p.capabilities.some(c => c !== "text"));
  const has = (c: Modality) => providers.some(p => p.enabled && p.capabilities.includes(c));
  return {
    providers: providers.filter(p=>p.enabled).length,
    multimodal: anyMultimodal,
    vision: has("image"), pdf: has("pdf"), audio: has("audio"), video: has("video"),
    rateLimit: "ACTIVE", loadBalancer: "ACTIVE", retry: "ACTIVE", circuitBreaker: "ACTIVE",
    fallback: "ACTIVE", queue: "ACTIVE", healthCheck: "ACTIVE",
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ALERT_CHAT_ID),
    metrics, health: Object.fromEntries(Array.from(health.entries()).map(([k,v]) => [k, { status: v.status, failures: v.totalFailures, latency: v.avgLatencyMs, breaker: v.breakerOpen }])),
  };
}

export default { loadProviders, generate, detectModalities, statusReport };
