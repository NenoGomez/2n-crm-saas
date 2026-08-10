import { loadProviders, generate, statusReport } from "./src/server/ai-manager";
async function main() {
  loadProviders();
  console.log("=== GROQ-TXT (texto) ===");
  const r = await generate({ text: "Diz apenas: GROQ_OK" });
  console.log("resp:", r.slice(0, 30));
  const s = statusReport();
  console.log("providers:", s.providers, "| telegram:", s.telegram, "| audio(whisper):", s.audio);
}
main().catch(e => { console.error("ERR", e.message); process.exit(1); });
