import React, { useState } from "react";
import { HermesLayoutOption, Client, ProductionOrder } from "../types";
import { apiUrl } from "../api";

interface HermesAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  crmMetricsSummary?: Record<string, unknown>;
  clients?: Client[];
  orders?: ProductionOrder[];
}

export const HermesAssistantModal: React.FC<HermesAssistantModalProps> = ({
  isOpen,
  onClose,
  crmMetricsSummary,
  clients,
  orders,
}) => {
  const [activeTab, setActiveTab] = useState<"chat" | "layout" | "insights">("chat");
  const [userQuery, setUserQuery] = useState("");
  const [selectedContext, setSelectedContext] = useState<{
    type: "client" | "order";
    id: string;
    label: string;
    details: string;
  } | null>(null);
  const [showContextPicker, setShowContextPicker] = useState(false);

  const [chatLog, setChatLog] = useState<
    Array<{
      sender: "user" | "hermes";
      text: string;
      timestamp: string;
      citedContext?: string;
    }>
  >([
    {
      sender: "hermes",
      text: "Olá, Nino! Sou o **Hermes AI**, copiloto de inteligência da 2N Publicidade. Como posso ajudar com seus indicadores, pipeline ou produção hoje? Você pode citar ordens de produção ou clientes específicos como contexto!",
      timestamp: "Agora",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Default fallback data if empty props
  const availableClients: Client[] =
    clients && clients.length > 0
      ? clients
      : [
          {
            id: "CLI-01",
            name: "Eng. Eduardo Silva",
            company: "Shopping Palladium",
            phone: "923 456 789",
            email: "eduardo@palladium.co.ao",
            segment: "Shopping & Varejo",
            lastPurchase: "10/Out/2026",
            totalSpent: 4200000,
            ordersCount: 8,
            manager: "Nino",
            status: "Ativo",
            isVip: true,
          },
          {
            id: "CLI-02",
            name: "Dra. Ana Paula Santos",
            company: "Sonangol E.P.",
            phone: "912 345 678",
            email: "anapaula@sonangol.co.ao",
            segment: "Energia & Petróleo",
            lastPurchase: "28/Set/2026",
            totalSpent: 18500000,
            ordersCount: 14,
            manager: "Nino",
            status: "Ativo",
            isVip: true,
          },
          {
            id: "CLI-03",
            name: "Dr. Miguel Rosa",
            company: "Banco BAI",
            phone: "934 567 890",
            email: "m.rosa@bai.co.ao",
            segment: "Financeiro & Banca",
            lastPurchase: "05/Out/2026",
            totalSpent: 9800000,
            ordersCount: 6,
            manager: "Nino",
            status: "Ativo",
            isVip: true,
          },
          {
            id: "CLI-04",
            name: "Eng. Carlos Mendes",
            company: "Unitel Angola",
            phone: "923 111 222",
            email: "carlos.mendes@unitel.co.ao",
            segment: "Telecomunicações",
            lastPurchase: "01/Out/2026",
            totalSpent: 12100000,
            ordersCount: 11,
            manager: "Nino",
            status: "Ativo",
            isVip: false,
          },
        ];

  const availableOrders: ProductionOrder[] =
    orders && orders.length > 0
      ? orders
      : [
          {
            id: "#ORD-488",
            clientName: "Shopping Palladium",
            productDescription: "Banner Lona 440g (10x) - Campanha de Verão",
            stage: "IMPRESSÃO",
            dueDate: "15/Nov",
            statusBadge: "URGENTE",
            createdAt: "01/10/2026",
          },
          {
            id: "#ORD-489",
            clientName: "Sonangol E.P.",
            productDescription: "Outdoor Dupla Face - Rodovia Talatona",
            stage: "ARTE",
            dueDate: "18/Nov",
            statusBadge: "NORMAL",
            createdAt: "02/10/2026",
          },
          {
            id: "#ORD-490",
            clientName: "Banco BAI",
            productDescription: "Letreiro Acrílico Iluminado LED Premium",
            stage: "APROVAÇÃO",
            dueDate: "20/Nov",
            statusBadge: "NORMAL",
            createdAt: "03/10/2026",
          },
          {
            id: "#ORD-491",
            clientName: "Unitel Angola",
            productDescription: "Stand Promocional Movel Feira Luanda",
            stage: "PEDIDO",
            dueDate: "22/Nov",
            statusBadge: "URGENTE",
            createdAt: "04/10/2026",
          },
        ];

  // Layout Generator State
  const [orderId, setOrderId] = useState("#ORD-488");
  const [clientName, setClientName] = useState("Shopping Palladium");
  const [productDesc, setProductDesc] = useState("Banner Lona 440g (10x) - Campanha de Verão");
  const [layoutOptions, setLayoutOptions] = useState<HermesLayoutOption[]>([]);
  const [isGeneratingLayouts, setIsGeneratingLayouts] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || userQuery;
    if (!query.trim() || isLoading) return;

    let fullPrompt = query;
    let contextTitle = "";

    if (selectedContext) {
      contextTitle = selectedContext.label;
      fullPrompt = `[CONTEXTO CITADO DO CRM]:\n${selectedContext.details}\n\n[PERGUNTA DO USUÁRIO]:\n${query}`;
    }

    const newMsg = {
      sender: "user" as const,
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      citedContext: contextTitle,
    };

    setChatLog((prev) => [...prev, newMsg]);
    if (!textToSend) setUserQuery("");
    const currentCited = selectedContext;
    setSelectedContext(null);
    setIsLoading(true);

    try {
      const response = await fetch(apiUrl("/hermes/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: fullPrompt,
          citedContext: currentCited,
          crmData: crmMetricsSummary || {
            salesToday: "840.500 Kz",
            salesMonth: "12.400.000 Kz",
            leads: 48,
            budgetsCount: 15,
            inProduction: 112,
            pendingAmount: "2.100.000 Kz",
          },
        }),
      });

      const data = await response.json();
      setChatLog((prev) => [
        ...prev,
        {
          sender: "hermes",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      let replyText = "Analisei os indicadores e o contexto fornecido. ";
      if (currentCited?.type === "order") {
        replyText += `Sobre a Ordem de Produção **${currentCited.id}**, o pedido está na etapa de **${
          availableOrders.find((o) => o.id === currentCited.id)?.stage || "Produção"
        }**. A equipe gráfica já está atuando para garantir o cumprimento do prazo.`;
      } else if (currentCited?.type === "client") {
        replyText += `O cliente **${currentCited.label}** possui histórico consolidado no CRM. Recomendo enviar uma proposta personalizada para os próximos lançamentos de mídia da empresa.`;
      } else {
        replyText += "Seu pipeline geral soma Kz 14.5M com taxa de conversão em 28.4%. Recomendo priorizar os 3 orçamentos prestes a expirar para garantir o fechamento do mês.";
      }

      setChatLog((prev) => [
        ...prev,
        {
          sender: "hermes",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLayouts = async () => {
    setIsGeneratingLayouts(true);
    try {
      const response = await fetch(apiUrl("/hermes/generate-layouts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          clientName,
          productDescription: productDesc,
        }),
      });

      const data = await response.json();
      setLayoutOptions(data.layouts || []);
    } catch {
      setLayoutOptions([
        {
          title: "Opção 1 - Impacto Visual Urbano",
          headline: "Sua Marca em Grande Estilo na Cidade",
          description: "Design moderno focado em alta visibilidade para outdoors e mídias de grande formato.",
        },
        {
          title: "Opção 2 - Elegância Corporativa",
          headline: "Qualidade de Impressão que Transmite Confiança",
          description: "Cores sóbrias com forte contraste para valorizar o logo do cliente.",
        },
        {
          title: "Opção 3 - Engajamento Promocional",
          headline: "O Lançamento que Luanda Estava Esperando",
          description: "Comunicação direta com destaque para oferta, datas e código QR promocional.",
        },
      ]);
    } finally {
      setIsGeneratingLayouts(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full h-[100dvh] sm:h-[85vh] sm:max-w-3xl bg-[#131b2e] text-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-white/10 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-[#0F172A] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#4edea3]/20 flex items-center justify-center text-[#4edea3] shrink-0">
                <span className="material-symbols-outlined text-lg sm:text-xl animate-pulse">auto_awesome</span>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm sm:text-base text-white flex items-center gap-1.5 truncate">
                  Hermes AI <span className="text-[10px] sm:text-xs font-semibold text-[#4edea3] bg-[#4edea3]/10 px-1.5 sm:px-2 py-0.5 rounded-full border border-[#4edea3]/30 shrink-0">v2.4 Executivo</span>
                </h2>
                <p className="text-[10px] sm:text-xs text-[#7c839b] truncate">Copiloto Comercial & Operacional</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onClose}
              className="sm:hidden text-[#7c839b] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Nav Tabs */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs w-full sm:w-auto justify-around sm:justify-start">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-colors cursor-pointer text-center ${
                  activeTab === "chat" ? "bg-[#4edea3] text-[#131b2e] font-bold" : "text-[#7c839b] hover:text-white"
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab("layout")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-colors cursor-pointer text-center ${
                  activeTab === "layout" ? "bg-[#4edea3] text-[#131b2e] font-bold" : "text-[#7c839b] hover:text-white"
                }`}
              >
                Gerador Arte
              </button>
              <button
                onClick={() => setActiveTab("insights")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-colors cursor-pointer text-center ${
                  activeTab === "insights" ? "bg-[#4edea3] text-[#131b2e] font-bold" : "text-[#7c839b] hover:text-white"
                }`}
              >
                Gargalos
              </button>
            </div>

            {/* Desktop Close Button */}
            <button
              onClick={onClose}
              className="hidden sm:block text-[#7c839b] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#131b2e]">
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col p-3 sm:p-5 overflow-hidden">
              {/* Quick Actions */}
              <div className="flex gap-2 mb-3 shrink-0 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => handleSendMessage("Gerar Relatório Executivo de Vendas")}
                  className="text-[11px] sm:text-xs bg-white/5 hover:bg-white/10 text-[#4edea3] border border-[#4edea3]/30 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span className="material-symbols-outlined text-xs sm:text-sm">analytics</span>
                  Relatório Executivo
                </button>
                <button
                  onClick={() => handleSendMessage("Quais os principais gargalos de produção hoje?")}
                  className="text-[11px] sm:text-xs bg-white/5 hover:bg-white/10 text-[#4edea3] border border-[#4edea3]/30 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span className="material-symbols-outlined text-xs sm:text-sm">warning</span>
                  Gargalos da Produção
                </button>
                <button
                  onClick={() => handleSendMessage("Sugerir próximos follow-ups prioritários para o pipeline")}
                  className="text-[11px] sm:text-xs bg-white/5 hover:bg-white/10 text-[#4edea3] border border-[#4edea3]/30 px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span className="material-symbols-outlined text-xs sm:text-sm">schedule</span>
                  Follow-ups Prioritários
                </button>
              </div>

              {/* Chat Message History */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 sm:pr-2">
                {chatLog.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-[#0F172A] text-white border border-white/20 rounded-tr-xs"
                          : "bg-white/10 text-slate-100 border border-white/10 rounded-tl-xs hermes-glow-dark"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-semibold text-xs text-[#4edea3]">
                          {msg.sender === "user" ? "Você (Nino)" : "Hermes AI"}
                        </span>
                        <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                      </div>
                      {msg.citedContext && (
                        <div className="mb-2 bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 w-fit">
                          <span className="material-symbols-outlined text-xs">bookmark</span>
                          <span>Contexto: {msg.citedContext}</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/10 rounded-2xl p-3 sm:p-4 text-xs sm:text-sm text-slate-300 border border-white/10 flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#4edea3] animate-spin text-base">
                        sync
                      </span>
                      <span>Hermes está analisando os dados do CRM e contexto...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Context Picker Dropdown Panel */}
              {showContextPicker && (
                <div className="my-2 bg-[#0F172A] border border-white/20 rounded-xl p-3 shadow-xl space-y-2.5 text-xs animate-in fade-in duration-150 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 sticky top-0 bg-[#0F172A] z-10">
                    <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <span className="material-symbols-outlined text-sm text-[#4edea3]">dataset</span>
                      Anexar Contexto (Cliente ou Pedido)
                    </span>
                    <button
                      onClick={() => setShowContextPicker(false)}
                      className="text-slate-400 hover:text-white cursor-pointer p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Orders Column */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#4edea3] tracking-wider block mb-1">
                        📦 Ordens de Produção (#ORD)
                      </span>
                      <div className="space-y-1">
                        {availableOrders.map((ord) => (
                          <button
                            key={ord.id}
                            onClick={() => {
                              setSelectedContext({
                                type: "order",
                                id: ord.id,
                                label: `${ord.id}: ${ord.clientName}`,
                                details: `Ordem ${ord.id} | Cliente: ${ord.clientName} | Item: ${ord.productDescription} | Etapa: ${ord.stage} | Vencimento: ${ord.dueDate}`,
                              });
                              setShowContextPicker(false);
                            }}
                            className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-[11px] cursor-pointer"
                          >
                            <div className="font-bold text-white flex justify-between">
                              <span>{ord.id}</span>
                              <span className="text-[9px] bg-white/10 px-1 py-0.2 rounded text-[#4edea3]">
                                {ord.stage}
                              </span>
                            </div>
                            <div className="text-slate-300 truncate">{ord.clientName}</div>
                            <div className="text-[10px] text-slate-400 truncate">{ord.productDescription}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clients Column */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#4edea3] tracking-wider block mb-1">
                        👤 Clientes do CRM
                      </span>
                      <div className="space-y-1">
                        {availableClients.map((cli) => (
                          <button
                            key={cli.id}
                            onClick={() => {
                              setSelectedContext({
                                type: "client",
                                id: cli.id,
                                label: `Cliente: ${cli.company}`,
                                details: `Cliente CRM: ${cli.company} (${cli.name}) | Faturamento: Kz ${cli.totalSpent.toLocaleString("pt-BR")} | Pedidos: ${cli.ordersCount} | Tel: ${cli.phone}`,
                              });
                              setShowContextPicker(false);
                            }}
                            className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-[11px] cursor-pointer"
                          >
                            <div className="font-bold text-white flex justify-between">
                              <span className="truncate">{cli.company}</span>
                              {cli.isVip && (
                                <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1 py-0.2 rounded shrink-0">
                                  VIP
                                </span>
                              )}
                            </div>
                            <div className="text-slate-300 truncate">{cli.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Context Chip Display */}
              {selectedContext && (
                <div className="my-1.5 bg-[#4edea3]/15 border border-[#4edea3]/40 text-[#4edea3] px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs">
                    <span className="material-symbols-outlined text-sm">bookmark</span>
                    <span className="truncate">Contexto: <strong>{selectedContext.label}</strong></span>
                  </span>
                  <button
                    onClick={() => setSelectedContext(null)}
                    className="text-slate-300 hover:text-white cursor-pointer ml-2 p-1"
                    title="Remover contexto"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div className="mt-2 pt-2 sm:pt-3 border-t border-white/10 flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowContextPicker(!showContextPicker)}
                  className={`p-2 sm:p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    showContextPicker || selectedContext
                      ? "bg-[#4edea3] text-[#131b2e] border-[#4edea3]"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                  }`}
                  title="Citar Contexto"
                >
                  <span className="material-symbols-outlined text-base">bookmark_add</span>
                  <span className="hidden sm:inline">Citar Contexto</span>
                </button>

                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={
                    selectedContext
                      ? `Pergunte sobre ${selectedContext.label}...`
                      : "Pergunte ao Hermes..."
                  }
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#4edea3]"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !userQuery.trim()}
                  className="bg-[#4edea3] hover:bg-[#3bc28d] disabled:opacity-50 text-[#131b2e] font-bold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <span className="hidden sm:inline">Enviar</span>
                  <span className="material-symbols-outlined text-base">send</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "layout" && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white mb-1">Gerador de Opções de Layout</h3>
                <p className="text-xs text-[#7c839b]">
                  O Hermes AI cria conceitos visuais e slogans prontos para a equipe gráfica.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 p-3.5 sm:p-4 rounded-xl border border-white/10">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">ID do Pedido</label>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Cliente</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Descrição do Serviço</label>
                  <input
                    type="text"
                    value={productDesc}
                    onChange={(e) => setProductDesc(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGenerateLayouts}
                  disabled={isGeneratingLayouts}
                  className="w-full sm:w-auto bg-[#4edea3] text-[#131b2e] hover:bg-[#3bc28d] font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  {isGeneratingLayouts ? "Gerando Opções com IA..." : "Gerar 3 Opções de Layout"}
                </button>
              </div>

              {/* Layout Options Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {layoutOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#4edea3]/50 transition-all space-y-2 relative"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4edea3] bg-[#4edea3]/10 px-2 py-0.5 rounded-md inline-block">
                      {opt.title}
                    </span>
                    <h4 className="font-bold text-sm text-white">{opt.headline}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{opt.description}</p>
                    <button
                      onClick={() => alert(`Conceito "${opt.headline}" aplicado ao pedido!`)}
                      className="w-full mt-3 bg-white/10 hover:bg-white/20 text-white font-medium py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Aprovar Conceito
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "insights" && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white mb-1">Análise de Gargalos & Eficiência</h3>
                <p className="text-xs text-[#7c839b]">
                  Diagnóstico do fluxo comercial e produtivo do CRM.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 sm:p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-400 text-xl sm:text-2xl shrink-0">warning</span>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-amber-200">Atenção no Tempo de Resposta em Orçamentos</h4>
                    <p className="text-xs text-amber-100/80 mt-1">
                      Há 15 orçamentos abertos na etapa de Negociação com tempo médio sem resposta de 42 horas. Recomenda-se disparar o robô de follow-up automático via WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 sm:p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#4edea3] text-xl sm:text-2xl shrink-0">check_circle</span>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-emerald-200">Alta Performance na Etapa de Aprovação</h4>
                    <p className="text-xs text-emerald-100/80 mt-1">
                      A taxa de aprovação de impressos grandes (Banners e Outdoors) aumentou 18% após a inclusão das mockups geradas pelo Hermes AI.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3.5 sm:p-4 flex items-start gap-3">
                  <span className="material-symbols-outlined text-blue-400 text-xl sm:text-2xl shrink-0">insights</span>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-blue-200">Oportunidade de Upsell em Clientes VIP</h4>
                    <p className="text-xs text-blue-100/80 mt-1">
                      3 clientes VIP da categoria Arquitetura possuem contratos vencendo este mês. Hermes agendou sugestões de renovação com 10% de bonificação.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
