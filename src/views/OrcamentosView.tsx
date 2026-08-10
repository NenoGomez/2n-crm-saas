import React, { useState } from "react";
import { Quote, Client, CompanySettings } from "../types";
import { FaturaModal } from "../components/FaturaModal";
import { NewQuoteModal } from "../components/NewQuoteModal";

interface OrcamentosViewProps {
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  clients: Client[];
  onOpenHermes?: () => void;
  companySettings?: CompanySettings;
}

export const OrcamentosView: React.FC<OrcamentosViewProps> = ({
  quotes,
  setQuotes,
  clients,
  onOpenHermes,
  companySettings,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [selectedQuoteForInvoice, setSelectedQuoteForInvoice] = useState<Quote | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);

  // Status metrics
  const totalApproved = quotes
    .filter((q) => q.status === "Aprovado")
    .reduce((sum, q) => sum + q.totalGeral, 0);

  const totalPending = quotes
    .filter((q) => q.status === "Pendente" || q.status === "Enviado")
    .reduce((sum, q) => sum + q.totalGeral, 0);

  const totalDraft = quotes.filter((q) => q.status === "Rascunho").length;

  const filteredQuotes = quotes.filter((q) => {
    const s = (search || "").toLowerCase();
    const matchesSearch =
      (q.code || q.number || "").toLowerCase().includes(s) ||
      (q.company || "").toLowerCase().includes(s) ||
      (q.clientName || "").toLowerCase().includes(s) ||
      (q.title || "").toLowerCase().includes(s);

    if (statusFilter === "Todos") return matchesSearch;
    return matchesSearch && q.status === statusFilter;
  });

  const handleAddQuote = (newQuote: Quote) => {
    setQuotes((prev) => [newQuote, ...prev]);
  };

  const handleOpenInvoice = (quote: Quote) => {
    setSelectedQuoteForInvoice(quote);
    setIsInvoiceOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e] flex items-center gap-2">
            <span>Orçamentos & Propostas Comerciais</span>
            <span className="text-xs font-mono font-bold bg-[#131b2e] text-white px-2 py-0.5 rounded-full">
              2N Publicidade
            </span>
          </h2>
          <p className="text-xs text-[#45464d] mt-0.5">
            Gestão de orçamentos emitidos, aprovações de clientes e emissão de faturas em Kwanzas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenHermes && (
            <button
              onClick={onOpenHermes}
              className="bg-[#ECFDF5] hover:bg-[#d0fbe3] text-[#005236] border border-[#6ffbbe]/50 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer hermes-glow"
            >
              <span className="material-symbols-outlined text-base text-[#009668]">
                auto_awesome
              </span>
              <span>Gerar via IA</span>
            </button>
          )}

          <button
            onClick={() => setIsNewQuoteOpen(true)}
            className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">request_quote</span>
            <span>Novo Orçamento</span>
          </button>
        </div>
      </div>

      {/* Financial Status Summary Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#45464d] block">
              Propostas Aprovadas
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {totalApproved.toLocaleString("pt-BR")} Kz
            </div>
            <span className="text-[11px] text-emerald-700 font-medium mt-0.5 inline-block">
              {quotes.filter((q) => q.status === "Aprovado").length} orçamentos convertidos
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#45464d] block">
              Pendente de Aprovação
            </span>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {totalPending.toLocaleString("pt-BR")} Kz
            </div>
            <span className="text-[11px] text-amber-700 font-medium mt-0.5 inline-block">
              {quotes.filter((q) => q.status === "Pendente" || q.status === "Enviado").length}{" "}
              propostas enviadas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined">hourglass_top</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#45464d] block">
              Rascunhos & Em Análise
            </span>
            <div className="text-2xl font-bold text-[#131b2e] mt-1">
              {totalDraft} rascunho(s)
            </div>
            <span className="text-[11px] text-blue-600 font-bold mt-0.5 inline-block">
              Pronto para envio
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#131b2e] flex items-center justify-center">
            <span className="material-symbols-outlined">edit_document</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex bg-white p-1 rounded-xl border border-[#c6c6cd]/40 text-xs level-1-shadow overflow-x-auto">
          {["Todos", "Aprovado", "Pendente", "Enviado", "Rascunho"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#131b2e] text-white shadow-xs"
                  : "text-[#45464d] hover:text-[#191c1e]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] text-base">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, empresa..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#c6c6cd]/50 rounded-xl text-xs text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
          />
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-2xl border border-[#c6c6cd]/40 level-1-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-[11px] font-bold text-[#45464d] uppercase border-b border-[#c6c6cd]/30 tracking-wider">
                <th className="py-3 px-4">Código / Orçamento</th>
                <th className="py-3 px-4">Cliente / Empresa</th>
                <th className="py-3 px-4">Valor Total (Kz)</th>
                <th className="py-3 px-4">Data Emissão</th>
                <th className="py-3 px-4">Validade</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f4f6] text-xs">
              {filteredQuotes.map((q) => (
                <tr key={q.id} className="hover:bg-[#f7f9fb] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#131b2e]">{q.code}</span>
                      {q.isHermesGenerated && (
                        <span
                          className="bg-[#ECFDF5] text-[#009668] text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-[#6ffbbe]/40"
                          title="Gerado com Hermes AI"
                        >
                          IA
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-bold text-[#191c1e]">{q.company}</p>
                    <p className="text-[10px] text-[#76777d]">{q.clientName}</p>
                  </td>

                  <td className="py-3 px-4 font-bold text-[#131b2e]">
                    {q.totalGeral.toLocaleString("pt-BR")} Kz
                  </td>

                  <td className="py-3 px-4 text-[#45464d]">{q.date}</td>
                  <td className="py-3 px-4 text-[#45464d]">{q.dueDate}</td>

                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        q.status === "Aprovado"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : q.status === "Pendente" || q.status === "Enviado"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenInvoice(q)}
                        className="bg-slate-100 hover:bg-[#131b2e] hover:text-white text-[#191c1e] font-bold px-2.5 py-1 rounded-lg text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Ver Fatura / PDF"
                      >
                        <span className="material-symbols-outlined text-sm">receipt_long</span>
                        <span>Fatura</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <FaturaModal
        isOpen={isInvoiceOpen}
        quote={selectedQuoteForInvoice}
        onClose={() => setIsInvoiceOpen(false)}
        companySettings={companySettings}
      />

      <NewQuoteModal
        isOpen={isNewQuoteOpen}
        onClose={() => setIsNewQuoteOpen(false)}
        clients={clients}
        onAddQuote={handleAddQuote}
        onPreviewQuote={(q) => {
          setSelectedQuoteForInvoice(q);
          setIsInvoiceOpen(true);
        }}
      />
    </div>
  );
};
