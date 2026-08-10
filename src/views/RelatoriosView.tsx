import React from "react";
import { DealCard, Client, ProductionOrder } from "../types";
import { jsPDF } from "jspdf";

interface RelatoriosViewProps {
  deals?: DealCard[];
  clients?: Client[];
  orders?: ProductionOrder[];
}

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  deals = [],
  clients = [],
  orders = [],
}) => {
  // Calculations based on global state
  const totalDealsCount = deals.length;
  const totalEstimatedValue = deals.reduce((acc, d) => acc + d.estimatedValue, 0);
  
  const approvedDeals = deals.filter((d) => d.stage === "APROVADO");
  const approvedValue = approvedDeals.reduce((acc, d) => acc + d.estimatedValue, 0);

  const budgetDeals = deals.filter((d) => d.stage === "ORÇAMENTO");
  const budgetValue = budgetDeals.reduce((acc, d) => acc + d.estimatedValue, 0);

  const negotiationDeals = deals.filter((d) => d.stage === "NEGOCIAÇÃO");
  const negotiationValue = negotiationDeals.reduce((acc, d) => acc + d.estimatedValue, 0);

  const handleGeneratePDF = () => {
    const doc = new jsPDF();

    // Top Header Banner
    doc.setFillColor(19, 27, 46); // #131b2e
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("2N PUBLICIDADE - RELATÓRIO EXECUTIVO DE VENDAS", 14, 16);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const formattedDate = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR");
    doc.text(`Gerado em: ${formattedDate} | CRM Hermes AI System`, 14, 23);

    let y = 38;

    // Section 1: KPI Cards Summary
    doc.setTextColor(25, 28, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. RESUMO EXECUTIVO DE VENDAS", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`• Total de Negócios na Carteira: ${totalDealsCount} oportunidades`, 16, y);
    y += 6;
    doc.text(`• Valor Total do Pipeline: Kz ${totalEstimatedValue.toLocaleString("pt-BR")}`, 16, y);
    y += 6;
    doc.text(`• Vendas Confirmadas/Aprovadas: ${approvedDeals.length} (Kz ${approvedValue.toLocaleString("pt-BR")})`, 16, y);
    y += 6;
    doc.text(`• Em Negociação: ${negotiationDeals.length} (Kz ${negotiationValue.toLocaleString("pt-BR")})`, 16, y);
    y += 6;
    doc.text(`• Orçamentos Apresentados: ${budgetDeals.length} (Kz ${budgetValue.toLocaleString("pt-BR")})`, 16, y);
    y += 6;
    doc.text(`• Total de Clientes Cadastrados: ${clients.length}`, 16, y);
    y += 6;
    doc.text(`• Ordens de Produção Ativas: ${orders.length}`, 16, y);

    y += 12;

    // Section 2: Pipeline Stage Table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. DISTRIBUIÇÃO DAS OPORTUNIDADES POR ETAPA", 14, y);
    y += 8;

    doc.setFillColor(242, 244, 246);
    doc.rect(14, y - 5, 182, 7, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Etapa do Funil", 18, y);
    doc.text("Quantidade", 85, y);
    doc.text("Valor Estimado (Kz)", 135, y);
    y += 8;

    const stagesSummary = [
      { name: "Novos / Contactados", items: deals.filter((d) => d.stage === "NOVO" || d.stage === "CONTACTADO") },
      { name: "Orçamentos Enviados", items: budgetDeals },
      { name: "Em Negociação", items: negotiationDeals },
      { name: "Vendas Aprovadas", items: approvedDeals },
    ];

    doc.setFont("helvetica", "normal");
    stagesSummary.forEach((stg) => {
      const sum = stg.items.reduce((acc, d) => acc + d.estimatedValue, 0);
      doc.text(stg.name, 18, y);
      doc.text(`${stg.items.length}`, 85, y);
      doc.text(`Kz ${sum.toLocaleString("pt-BR")}`, 135, y);
      y += 6.5;
    });

    y += 10;

    // Section 3: Detailed Deals Table
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("3. LISTAGEM DOS PRINCIPAIS NEGÓCIOS DA CARTEIRA", 14, y);
    y += 8;

    doc.setFillColor(242, 244, 246);
    doc.rect(14, y - 5, 182, 7, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("Empresa / Cliente", 18, y);
    doc.text("Serviço Solicitado", 72, y);
    doc.text("Etapa", 130, y);
    doc.text("Valor (Kz)", 165, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    deals.forEach((deal) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(deal.company.substring(0, 24), 18, y);
      doc.text(deal.title.substring(0, 28), 72, y);
      doc.text(deal.stage, 130, y);
      doc.text(`${deal.estimatedValue.toLocaleString("pt-BR")}`, 165, y);
      y += 6;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(118, 119, 125);
    doc.text("2N Publicidade CRM - Documento Oficial de Desempenho e Inteligência Comercial.", 14, 287);

    doc.save(`Resumo_Vendas_2N_Publicidade_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Banner with PDF Download CTA */}
      <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e]">Relatórios Executivos & Análise de Mercado</h2>
          <p className="text-xs text-[#45464d] mt-0.5">
            Visão profunda sobre taxas de conversão, roi de mídias e performance por executivo da 2N Publicidade.
          </p>
        </div>

        <button
          onClick={handleGeneratePDF}
          className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base text-[#4edea3]">picture_as_pdf</span>
          <span>Baixar Resumo em PDF</span>
        </button>
      </div>

      {/* Global Sales Real-Time Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase block">Negócios Ativos</span>
          <div className="text-xl font-bold text-[#191c1e] mt-1">{totalDealsCount} Oportunidades</div>
          <span className="text-[10px] text-blue-600 font-bold mt-1 inline-block">Funil Comercial</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase block">Valor em Carteira</span>
          <div className="text-xl font-bold text-[#191c1e] mt-1">Kz {totalEstimatedValue.toLocaleString("pt-BR")}</div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">Projeção Total</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase block">Vendas Aprovadas</span>
          <div className="text-xl font-bold text-[#009668] mt-1">Kz {approvedValue.toLocaleString("pt-BR")}</div>
          <span className="text-[10px] text-emerald-700 font-bold mt-1 inline-block">{approvedDeals.length} Aprovados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase block">Clientes & Produção</span>
          <div className="text-xl font-bold text-[#131b2e] mt-1">{clients.length} Clientes</div>
          <span className="text-[10px] text-amber-600 font-bold mt-1 inline-block">{orders.length} Pedidos de Fábrica</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <h3 className="font-bold text-base text-[#191c1e]">Desempenho por Canal de Atendimento</h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>WhatsApp Business</span>
                <span className="font-bold">58% das Vendas</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "58%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Instagram Direct</span>
                <span className="font-bold">27% das Vendas</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full" style={{ width: "27%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Reunião Presencial / Direct</span>
                <span className="font-bold">15% das Vendas</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "15%" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <h3 className="font-bold text-base text-[#191c1e]">Top Serviços Mais Lucrativos</h3>
          <div className="divide-y divide-[#f2f4f6] text-xs">
            <div className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-[#191c1e] block">Painéis Publicitários (OOH)</span>
                <span className="text-[10px] text-[#76777d]">Mídia Exterior e Outdoors em Luanda</span>
              </div>
              <span className="font-bold text-[#009668]">Kz 6.800.000</span>
            </div>

            <div className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-[#191c1e] block">Gestão de Tráfego & Mídia Digital</span>
                <span className="text-[10px] text-[#76777d]">Campanhas para Redes Sociais</span>
              </div>
              <span className="font-bold text-[#009668]">Kz 3.400.000</span>
            </div>

            <div className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-[#191c1e] block">Impressão Gráfica & Banner Lona</span>
                <span className="text-[10px] text-[#76777d]">Produção Gráfica e Fachadas</span>
              </div>
              <span className="font-bold text-[#009668]">Kz 2.200.000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
