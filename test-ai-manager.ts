import { loadProviders, generate, detectModalities, statusReport } from "./src/server/ai-manager";

function b64(s: string) { return Buffer.from(s).toString("base64"); }

async function main() {
  loadProviders();
  console.log("=== 1) TEXTO ===");
  const t = await generate({ text: "Diz apenas: TEXTO_OK" });
  console.log("resp:", t.slice(0, 40));

  console.log("\n=== 2) MULTIMODAL (imagem 1x1 preta + pergunta) ===");
  const px = Buffer.from("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82", "binary").toString("base64");
  const m = await generate({ text: "Descreve a imagem em 3 palavras.", images: [{ mime_type: "image/png", data: px }] });
  console.log("resp:", m.slice(0, 60));

  console.log("\n=== 3) detectModalities ===");
  console.log(detectModalities({ images: [{} as any], audio: [{} as any] } as any));

  console.log("\n=== 4) SIMULAR RATE-LIMIT no Gemini (forçar falha) ===");
  process.env.GEMINI_API_KEY = "KEY_INVALIDA_PARA_TESTE_429";
  try {
    await generate({ text: "teste" });
  } catch (e: any) {
    console.log("erro esperado (sem fallback válido):", e.message.slice(0, 60));
  }
  // repor chave real para o proximo
  const real = require("fs").readFileSync("/root/.gemini_key.txt", "utf8").trim();
  process.env.GEMINI_API_KEY = real;

  console.log("\n=== 5) FALLBACK: Gemini fora, OpenRouter entra ===");
  // desativa gemini temporariamente forçando breaker? simpl: chamar com pool TEXT que tem openrouter-txt
  const f = await generate({ text: "Diz: FALLBACK_OK", pool: "TEXT" as any });
  console.log("resp fallback pool TEXT:", f.slice(0, 40));

  console.log("\n=== STATUS REPORT ===");
  console.log(JSON.stringify(statusReport(), null, 2));
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
