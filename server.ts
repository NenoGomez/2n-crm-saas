import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import api from "./src/server/routes";
import { initSchema, q } from "./src/server/db";
import { seedIfEmpty } from "./src/server/seed";

const app = express();
const PORT = Number(process.env.PORT || 8095);
const isProd = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "10mb" }));

// Mount the real data + AI API
app.use("/api", api);

// Quote / Proforma PDF generation (jsPDF)
app.get("/api/quotes/:id/pdf", async (req, res) => {
  try {
    const { rows } = await q("SELECT * FROM quotes WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "quote not found" });
    const doc = rows[0].doc || {};
    const { rows: cs } = await q("SELECT doc FROM company_settings WHERE id=1");
    const co = cs[0]?.doc || {};

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    let y = 18;
    pdf.setFontSize(16);
    pdf.text(String(co.commercialName || "2N Publicidade"), 14, y); y += 7;
    pdf.setFontSize(9);
    pdf.text(String(co.corporateName || ""), 14, y); y += 5;
    pdf.text(`NIF: ${co.nif || "-"}  |  ${co.phone || ""}  |  ${co.email || ""}`, 14, y); y += 10;
    pdf.setFontSize(13);
    pdf.text(`ORÇAMENTO ${doc.code || rows[0].code || ""}`, 14, y); y += 8;
    pdf.setFontSize(10);
    pdf.text(`Cliente: ${doc.clientName || rows[0].client_name || ""} - ${doc.company || ""}`, 14, y); y += 6;
    pdf.text(`Data: ${doc.date || ""}   Validade: ${doc.dueDate || ""}   Estado: ${doc.status || ""}`, 14, y); y += 10;
    pdf.setFontSize(9);
    for (const it of doc.items || []) {
      pdf.text(`${it.quantity}x ${it.product} — ${it.description || ""}`, 14, y); y += 5;
      pdf.text(`   Unit: ${it.unitPrice} Kz   Total: ${it.total} Kz`, 14, y); y += 7;
      if (y > 265) { pdf.addPage(); y = 20; }
    }
    y += 4;
    pdf.setFontSize(11);
    pdf.text(`Subtotal: ${doc.subtotal ?? 0} Kz`, 14, y); y += 6;
    pdf.text(`IVA: ${doc.taxIva ?? 0} Kz`, 14, y); y += 6;
    pdf.text(`TOTAL: ${doc.totalGeral ?? rows[0].total_geral ?? 0} Kz`, 14, y); y += 12;
    pdf.setFontSize(8);
    pdf.text(String(co.documentFooterNote || ""), 14, 285, { maxWidth: 180 });

    const buf = Buffer.from(pdf.output("arraybuffer") as ArrayBuffer);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.code || "orcamento"}.pdf"`);
    res.send(buf);
  } catch (e) {
    console.error("[pdf]", (e as Error).message);
    res.status(500).json({ error: (e as Error).message });
  }
});

async function startServer() {
  try {
    await initSchema();
    const seeded = await seedIfEmpty();
    console.log(`[db] schema ready${seeded ? " (seeded initial data)" : ""}`);
  } catch (e) {
    console.error("[db] init failed — API will return errors, UI falls back to local data:", (e as Error).message);
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      const idx = path.join(distPath, "index.html");
      if (fs.existsSync(idx)) return res.sendFile(idx);
      res.status(404).send("build missing");
    });
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`2N CRM SaaS running on http://0.0.0.0:${PORT}`));
}

startServer();
