import React, { useState } from "react";
import { Client, Conversation, ProductionOrder, Quote } from "../types";

interface ClientProfileModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  conversations?: Conversation[];
  orders?: ProductionOrder[];
  quotes?: Quote[];
  onOpenChatWithClient?: (clientId: string) => void;
  onOpenNewQuoteForClient?: (client: Client) => void;
}

export const ClientProfileModal: React.FC<ClientProfileModalProps> = ({
  client,
  isOpen,
  onClose,
  conversations = [],
  orders = [],
  quotes = [],
  onOpenChatWithClient,
  onOpenNewQuoteForClient,
}) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "conversations" | "quotes" | "orders" | "payments" | "timeline"
  >("overview");

  if (!isOpen || !client) return null;

  const clientConversations = conversations.filter(
    (c) => c.clientId === client.id || c.clientName.toLowerCase().includes(client.name.toLowerCase())
  );

  const clientOrders = orders.filter(
    (o) => o.clientName.toLowerCase().includes(client.name.toLowerCase()) || o.clientName.toLowerCase().includes(client.company.toLowerCase())
  );

  const clientQuotes = quotes.filter(
    (q) => q.clientName.toLowerCase().includes(client.name.toLowerCase()) || q.company.toLowerCase().includes(client.company.toLowerCase())
  );

  const ticketMedio =
    client.ordersCount > 0 ? Math.round(client.totalSpent / client.ordersCount) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#f8fafc] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-300 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] text-[#191c1e]">
        {/* Profile Executive Header */}
        <div className="bg-[#131b2e] text-white p-6 relative overflow-hidden shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {client.avatarUrl ? (
                <img
                  src={client.avatarUrl}
                  alt={client.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 text-white font-black text-xl flex items-center justify-center">
                  {client.initials || "CL"}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{client.name}</h2>
                  {client.isVip && (
                    <span className="bg-amber-400 text-amber-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                      ★ VIP
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      client.status === "Ativo"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                    }`}
                  >
                    {client.status}
                  </span>
                </div>

                <p className="text-xs text-[#7c839b] font-medium mt-0.5">{client.company}</p>
                <p className="text-[11px] text-[#7c839b] mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">location_on</span>
                  <span>Luanda, Angola</span>
                  <span className="mx-1">•</span>
                  <span>Resp: {client.manager}</span>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onOpenChatWithClient && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenChatWithClient(client.id);
                  }}
                  className="bg-[#009668] hover:bg-[#007c57] text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer flex-1 sm:flex-none"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  <span>Mensagem</span>
                </button>
              )}

              {onOpenNewQuoteForClient && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenNewQuoteForClient(client);
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-none"
                >
                  <span className="material-symbols-outlined text-sm">request_quote</span>
                  <span>Criar Orçamento</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-white/10 text-xs overflow-x-auto no-scrollbar">
            {[
              { id: "overview", label: "Visão Geral", icon: "dashboard" },
              { id: "conversations", label: `Conversas (${clientConversations.length})`, icon: "forum" },
              { id: "quotes", label: `Orçamentos (${clientQuotes.length})`, icon: "request_quote" },
              { id: "orders", label: `Pedidos (${clientOrders.length})`, icon: "precision_manufacturing" },
              { id: "timeline", label: "Linha do Tempo", icon: "history" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-white text-[#131b2e] shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {activeTab === "overview" && (
            <>
              {/* Bento Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Gasto</span>
                  <div className="text-xl font-black text-[#131b2e] mt-1">
                    {client.totalSpent.toLocaleString("pt-BR")} Kz
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 inline-block">
                    Cliente Ativo
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total de Pedidos</span>
                  <div className="text-xl font-black text-[#131b2e] mt-1">
                    {client.ordersCount} pedidos
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 inline-block">
                    Última compra: {client.lastPurchase}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 block">Ticket Médio</span>
                  <div className="text-xl font-black text-[#131b2e] mt-1">
                    {ticketMedio.toLocaleString("pt-BR")} Kz
                  </div>
                  <span className="text-[10px] text-blue-600 font-bold mt-0.5 inline-block">
                    Recorrência Alta
                  </span>
                </div>
              </div>

              {/* Hermes AI Insight Card */}
              <div className="bg-[#ECFDF5] border border-[#6ffbbe]/60 p-4 rounded-2xl space-y-2 relative overflow-hidden hermes-glow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#009668]">auto_awesome</span>
                    <h4 className="font-bold text-sm text-[#005236]">Hermes AI Insight Comercial</h4>
                  </div>
                  <span className="text-[10px] bg-emerald-200/60 text-[#005236] font-bold px-2 py-0.5 rounded-full">
                    Probabilidade 85%
                  </span>
                </div>
                <p className="text-xs text-[#005236] leading-relaxed">
                  Cliente possui um padrão de renovação trimestral de peças de mídia exterior e rebranding.
                  Recomendamos oferecer o pacote integrado de sinalética e campanhas OOH com 10% de desconto na adjudicação.
                </p>
              </div>

              {/* Contact Details */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-sm text-[#191c1e]">Dados Cadastrais & Contato</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Telefone Principal</span>
                    <span className="font-bold text-[#191c1e] font-mono">{client.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">E-mail Corporativo</span>
                    <span className="font-bold text-[#191c1e]">{client.email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Segmento / Nicho</span>
                    <span className="font-bold text-[#191c1e]">{client.segment || "Comercial"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Gestor Responsável</span>
                    <span className="font-bold text-[#191c1e]">{client.manager}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "conversations" && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[#191c1e]">Histórico de Conversas Omnichannel</h4>
              {clientConversations.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-500">
                  Nenhuma conversa registrada para este cliente.
                </div>
              ) : (
                clientConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#191c1e] flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-emerald-600">
                          chat
                        </span>
                        <span>{conv.channel}</span>
                      </span>
                      <span className="text-[10px] text-slate-400">{conv.lastMessageTime}</span>
                    </div>
                    <p className="text-xs text-slate-600 italic">"{conv.lastMessage}"</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "quotes" && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[#191c1e]">Orçamentos e Propostas</h4>
              {clientQuotes.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-500">
                  Nenhum orçamento em aberto.
                </div>
              ) : (
                clientQuotes.map((q) => (
                  <div
                    key={q.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-[#131b2e]">{q.code}</p>
                      <p className="text-[11px] text-slate-500">Emissão: {q.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">
                        {q.totalGeral.toLocaleString("pt-BR")} Kz
                      </p>
                      <span className="text-[10px] font-bold text-slate-500">{q.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[#191c1e]">Ordens de Produção</h4>
              {clientOrders.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-500">
                  Nenhum pedido de produção encontrado.
                </div>
              ) : (
                clientOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-[#131b2e]">{ord.id}</p>
                      <p className="text-[11px] text-slate-600">{ord.productDescription}</p>
                    </div>
                    <span className="bg-slate-100 font-bold px-2.5 py-1 rounded-lg text-[10px] text-slate-700">
                      {ord.stage}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-[#191c1e]">Linha do Tempo de Atividades</h4>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                <div className="relative">
                  <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-[#131b2e] border-2 border-white"></div>
                  <p className="font-bold text-[#191c1e]">Pagamento Recebido</p>
                  <p className="text-[11px] text-slate-500">185.000 Kz referente ao pedido #ORD-492</p>
                  <span className="text-[10px] text-slate-400">Há 2 horas</span>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                  <p className="font-bold text-[#191c1e]">Proposta Enviada por Hermes AI</p>
                  <p className="text-[11px] text-slate-500">Orçamento ORC-2023-0142 enviado para aprovação</p>
                  <span className="text-[10px] text-slate-400">Ontem às 15:40</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
