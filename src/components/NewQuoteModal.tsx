import React, { useState } from "react";
import { Quote, QuoteItem, Client } from "../types";

interface NewQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onAddQuote: (quote: Quote) => void;
  onPreviewQuote?: (quote: Quote) => void;
}

export const NewQuoteModal: React.FC<NewQuoteModalProps> = ({
  isOpen,
  onClose,
  clients,
  onAddQuote,
  onPreviewQuote,
}) => {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nif, setNif] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("50% Adjudicação / 50% Entrega");
  const [notes, setNotes] = useState("");
  const [isGeneratingHermes, setIsGeneratingHermes] = useState(false);

  const [items, setItems] = useState<QuoteItem[]>([
    {
      id: "qi-1",
      product: "Campanha Digital",
      description: "Gestão de Redes Sociais - Mensal",
      quantity: 1,
      unit: "Mês",
      unitPrice: 150000,
      discountPercent: 0,
      total: 150000,
    },
    {
      id: "qi-2",
      product: "Criação de Vídeo",
      description: "Vídeo Institucional 2 min",
      quantity: 1,
      unit: "Unidade",
      unitPrice: 350000,
      discountPercent: 10,
      total: 315000,
    },
  ]);

  if (!isOpen) return null;

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setClientName(found.name);
      setCompany(found.company);
      setEmail(found.email || "");
      setPhone(found.phone);
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof QuoteItem,
    value: string | number
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Recalculate total
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discountPercent) || 0;
      item.total = Math.max(0, qty * price * (1 - disc / 100));

      updated[index] = item;
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `qi-${Date.now()}`,
        product: "Novo Serviço",
        description: "Descrição da peça ou produção gráfica",
        quantity: 1,
        unit: "Unidade",
        unitPrice: 100000,
        discountPercent: 0,
        total: 100000,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const itemsTotalSum = items.reduce((sum, item) => sum + item.total, 0);
  const discountTotal = Math.max(0, subtotal - itemsTotalSum);
  const taxIva = itemsTotalSum * 0.14;
  const totalGeral = itemsTotalSum + taxIva;

  const buildQuoteObject = (status: Quote["status"], isHermes = false): Quote => {
    const codeNum = Math.floor(100 + Math.random() * 900);
    return {
      id: `orc-${Date.now()}`,
      code: `ORC-2023-${codeNum}`,
      clientName: clientName || "Cliente Exemplo",
      company: company || "Empresa Exemplo Lda",
      email: email || "contato@empresa.co.ao",
      phone: phone || "+244 923 000 000",
      nif: nif || "5000123000",
      paymentTerms,
      items,
      subtotal,
      discountTotal,
      taxIva,
      totalGeral,
      status,
      date: "Hoje",
      dueDate: "Em 15 dias",
      manager: "Ana Júlia",
      notes,
      isHermesGenerated: isHermes,
    };
  };

  const handleSubmit = (e: React.FormEvent, status: Quote["status"]) => {
    e.preventDefault();
    if (!company && !clientName) return;

    const newQuote = buildQuoteObject(status);
    onAddQuote(newQuote);
    onClose();
  };

  const handleGenerateHermesProposal = () => {
    setIsGeneratingHermes(true);
    setTimeout(() => {
      setIsGeneratingHermes(false);
      // Auto optimize items with discount
      setItems((prev) =>
        prev.map((i) => ({
          ...i,
          discountPercent: 5,
          total: i.quantity * i.unitPrice * 0.95,
        }))
      );
      setNotes(
        "Proposta otimizada por Hermes AI. Inclui condições especiais para entrega expressa e pacote de comunicação integrada."
      );
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#f7f9fb] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-300 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#131b2e] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6ffbbe]">request_quote</span>
            <div>
              <h3 className="font-bold text-base text-white">Criar Novo Orçamento</h3>
              <p className="text-xs text-[#7c839b]">
                Preencha os detalhes para gerar uma nova proposta comercial em Kwanzas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Scrollable Form */}
        <form
          onSubmit={(e) => handleSubmit(e, "Enviado")}
          className="p-6 overflow-y-auto space-y-6 text-xs text-[#191c1e]"
        >
          {/* Section 1: Client Information */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#131b2e]"></div>
            <h4 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#131b2e]">person_search</span>
              Informações do Cliente
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="block font-semibold text-slate-600">
                  Selecionar Cliente Cadastrado ou Digitar Nome
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="flex-1 bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#191c1e] font-bold focus:outline-none focus:bg-white focus:border-[#131b2e]"
                  >
                    <option value="">-- Buscar na base de clientes --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.company})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Nome do Contato *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#131b2e]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Empresa / Negócio *</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Ex: Tech Solutions SA"
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#131b2e]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">E-mail de Envio</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.co.ao"
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#131b2e]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">NIF / NUIT</label>
                <input
                  type="text"
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  placeholder="5000123456"
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#131b2e]"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="block font-semibold text-slate-600">Condições de Pagamento</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-2 text-xs text-[#191c1e] font-bold focus:outline-none focus:bg-white focus:border-[#131b2e]"
                >
                  <option value="Pronto Pagamento">Pronto Pagamento</option>
                  <option value="50% Adjudicação / 50% Entrega">
                    50% Adjudicação / 50% Entrega
                  </option>
                  <option value="30 Dias">30 Dias</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section 2: Items & Services Table */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#131b2e]">inventory_2</span>
                Itens e Serviços
              </h4>

              <button
                type="button"
                onClick={handleAddItem}
                className="text-[#131b2e] hover:bg-slate-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Adicionar Linha</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">Produto / Serviço</th>
                    <th className="py-2.5 px-3">Descrição Detalhada</th>
                    <th className="py-2.5 px-3 w-16 text-center">Qtd.</th>
                    <th className="py-2.5 px-3 w-24">Medida</th>
                    <th className="py-2.5 px-3 w-28 text-right">Preço Unit. (Kz)</th>
                    <th className="py-2.5 px-3 w-20 text-center">Desc. %</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (Kz)</th>
                    <th className="py-2.5 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.product}
                          onChange={(e) => handleItemChange(idx, "product", e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold text-[#191c1e]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-slate-600"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-center font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="Mês">Mês</option>
                          <option value="Unidade">Unidade</option>
                          <option value="Hora">Hora</option>
                          <option value="Pacote">Pacote</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step={1000}
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-right font-mono font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPercent}
                          onChange={(e) => handleItemChange(idx, "discountPercent", Number(e.target.value))}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-center"
                        />
                      </td>
                      <td className="p-2 text-right font-bold text-[#131b2e] align-middle">
                        {item.total.toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Notes & Totals Breakdown */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="sm:col-span-2 space-y-1">
              <label className="block font-semibold text-slate-600">
                Notas ou Termos Adicionais da Proposta
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Insira observações relevantes para o cliente, especificações técnicas ou prazos..."
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs focus:outline-none focus:border-[#131b2e]"
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-[#191c1e]">
                  {subtotal.toLocaleString("pt-BR")} Kz
                </span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto Total:</span>
                  <span className="font-semibold">
                    - {discountTotal.toLocaleString("pt-BR")} Kz
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-2">
                <span>Impostos (IVA 14%):</span>
                <span className="font-semibold text-[#191c1e]">
                  {taxIva.toLocaleString("pt-BR")} Kz
                </span>
              </div>
              <div className="pt-1 flex justify-between items-center text-sm">
                <span className="font-bold text-[#191c1e]">Total Geral:</span>
                <span className="font-extrabold text-[#131b2e]">
                  {totalGeral.toLocaleString("pt-BR")} Kz
                </span>
              </div>
            </div>
          </section>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, "Rascunho")}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors w-full sm:w-auto cursor-pointer"
              >
                Guardar Rascunho
              </button>
              {onPreviewQuote && (
                <button
                  type="button"
                  onClick={() => {
                    const q = buildQuoteObject("Pendente");
                    onPreviewQuote(q);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>Pré-visualizar</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleGenerateHermesProposal}
                disabled={isGeneratingHermes}
                className="px-4 py-2 bg-[#ECFDF5] text-[#005236] hover:bg-[#d0fbe3] border border-[#6ffbbe]/50 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto cursor-pointer hermes-glow"
              >
                <span className="material-symbols-outlined text-sm text-[#009668]">
                  auto_awesome
                </span>
                <span>
                  {isGeneratingHermes ? "Otimizando..." : "Gerar Proposta via Hermes AI"}
                </span>
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold rounded-xl shadow-sm transition-all w-full sm:w-auto cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                <span>Enviar para Cliente</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
