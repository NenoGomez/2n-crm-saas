import React, { useState, useEffect } from "react";
import { Conversation, ChatMessage, PipelineStage } from "../types";
import { apiUrl } from "../api";

interface AtendimentoViewProps {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  selectedConvId?: string;
  onOpenHermes: () => void;
}

export const AtendimentoView: React.FC<AtendimentoViewProps> = ({
  conversations,
  setConversations,
  selectedConvId,
  onOpenHermes,
}) => {
  const [activeConvId, setActiveConvId] = useState<string>(
    selectedConvId || conversations[0]?.id || ""
  );
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("Todos");
  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);
  const [mobileActiveView, setMobileActiveView] = useState<"list" | "chat" | "info">("list");
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<string>("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // New Chat Form State
  const [newClientName, setNewClientName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newChannel, setNewChannel] = useState<"WhatsApp" | "Instagram" | "Email">("WhatsApp");
  const [newInitialMsg, setNewInitialMsg] = useState("");

  // Sync selectedConvId from parent
  useEffect(() => {
    if (selectedConvId) {
      setActiveConvId(selectedConvId);
      setMobileActiveView("chat");
    }
  }, [selectedConvId]);

  const emailTemplates = [
    {
      id: "pres",
      name: "Apresentação & Portfólio",
      subject: "Apresentação de Soluções em Publicidade - 2N",
      body: (name: string, comp: string) =>
        `Olá ${name}, tudo bem? Sou da equipe comercial da 2N Publicidade. Conforme conversamos sobre a ${comp}, temos o prazer de apresentar nosso catálogo de soluções de comunicação visual, impressão gráfica e outdoors. Podemos agendar uma breve apresentação nesta semana?`,
    },
    {
      id: "orc",
      name: "Proposta de Orçamento",
      subject: "Proposta Comercial & Orçamento - 2N Publicidade",
      body: (name: string, comp: string, val?: number) =>
        `Estimado(a) ${name}, segue o orçamento comercial ajustado para a ${comp}. O investimento total estimado é de Kz ${(val || 280000).toLocaleString("pt-BR")}. Oferecemos condições flexíveis de pagamento. Fico no aguardo do seu de acordo para encaminhar à produção.`,
    },
    {
      id: "followup",
      name: "Follow-up de Negociação",
      subject: "Acompanhamento da Proposta Comercial",
      body: (name: string, comp: string) =>
        `Olá ${name}! Passando para saber se teve a oportunidade de analisar nossa proposta de mídia para a ${comp}. Caso tenha qualquer dúvida técnica ou necessidade de ajuste nos prazos, estou à disposição!`,
    },
    {
      id: "welcome",
      name: "Boas-Vindas ao Cliente",
      subject: "Seja bem-vindo à 2N Publicidade",
      body: (name: string, comp: string) =>
        `Seja muito bem-vindo à 2N Publicidade, ${name}! É uma honra ter a ${comp} como parceira comercial. Nosso time de atendimento e criação já está mobilizado para garantir excelência nas suas entregas.`,
    },
    {
      id: "prod_done",
      name: "Aviso de Produção Concluída",
      subject: "Material Pronto para Entrega/Instalação",
      body: (name: string, comp: string) =>
        `Olá ${name}, informamos que o pedido da ${comp} foi finalizado na nossa fábrica com 100% de controle de qualidade e já está pronto para coleta/instalação. Por favor confirme o melhor horário para recebimento.`,
    },
  ];

  const currentConv = conversations.find((c) => c.id === activeConvId) || conversations[0];

  const handleCreateNewChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newCompany.trim()) return;

    const newId = `c-${Date.now()}`;
    const initials = newClientName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    const createdConv: Conversation = {
      id: newId,
      clientId: `CLI-${Date.now()}`,
      clientName: newClientName,
      company: newCompany,
      channel: newChannel,
      initials,
      lastMessage: newInitialMsg || "Conversa iniciada",
      lastMessageTime: "Agora",
      unreadCount: 0,
      tag: "Atendimento",
      estimatedValue: 450000,
      stage: "NOVO",
      messages: [
        {
          id: `m-${Date.now()}`,
          sender: "user",
          text: newInitialMsg || `Olá ${newClientName}! Como posso ajudar com a ${newCompany}?`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "sent",
        },
      ],
      hermesSummary: `Nova conversa iniciada via ${newChannel} com ${newClientName} da ${newCompany}.`,
    };

    setConversations((prev) => [createdConv, ...prev]);
    setActiveConvId(newId);
    setMobileActiveView("chat");
    setShowNewChatModal(false);

    // Reset form
    setNewClientName("");
    setNewCompany("");
    setNewInitialMsg("");
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || messageText;
    if (!text.trim() || !currentConv) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === currentConv.id) {
          return {
            ...conv,
            messages: [...conv.messages, newMsg],
            lastMessage: text,
            lastMessageTime: "Agora",
            unreadCount: 0,
          };
        }
        return conv;
      })
    );

    if (!textToSend) setMessageText("");

    // Simulate auto client reply after 1.5s
    setTimeout(() => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === currentConv.id) {
            const autoMsg: ChatMessage = {
              id: `m-reply-${Date.now()}`,
              sender: "client",
              text: "Excelente! Recebi sua mensagem, vou analisar com a nossa equipe.",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            return {
              ...conv,
              messages: [...conv.messages, autoMsg],
              lastMessage: autoMsg.text,
              lastMessageTime: "Agora",
            };
          }
          return conv;
        })
      );
    }, 1800);
  };

  const handleGenerateAiReply = async () => {
    if (!currentConv) return;
    setIsGeneratingAiReply(true);

    try {
      const response = await fetch(apiUrl("/hermes/suggest-reply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: currentConv.clientName,
          messages: currentConv.messages,
          context: `Atendimento via ${currentConv.channel} para ${currentConv.company}`,
        }),
      });

      const data = await response.json();
      if (data.suggestion) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConv.id ? { ...c, hermesSuggestedReply: data.suggestion } : c
          )
        );
      }
    } catch {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConv.id
            ? {
                ...c,
                hermesSuggestedReply:
                  "Com certeza! Segue a apresentação dos nossos serviços e os cases mais relevantes para o seu segmento. Quando poderíamos agendar uma breve reunião para alinhar o seu orçamento?",
              }
            : c
        )
      );
    } finally {
      setIsGeneratingAiReply(false);
    }
  };

  const handleUpdateStage = (stage: PipelineStage) => {
    if (!currentConv) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === currentConv.id ? { ...c, stage } : c))
    );
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesChannel =
      channelFilter === "Todos" || c.channel.toLowerCase() === channelFilter.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-5rem)] flex flex-col bg-white rounded-2xl border border-[#c6c6cd]/40 level-1-shadow overflow-hidden text-[#191c1e] animate-in fade-in duration-300">
      {/* 3-Column Layout Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: Inbox & Conversations List */}
        <div
          className={`w-full md:w-80 lg:w-80 border-r border-[#f2f4f6] bg-[#f7f9fb] flex flex-col shrink-0 ${
            mobileActiveView !== "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Inbox Header */}
          <div className="p-3.5 border-b border-[#f2f4f6] space-y-2.5 bg-white shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-[#191c1e]">Inbox & Chat</h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="text-xs bg-[#131b2e] text-white font-bold px-2.5 py-1 rounded-lg hover:bg-[#0b111f] flex items-center gap-1 cursor-pointer"
                  title="Nova Conversa"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Nova</span>
                </button>
                <button
                  onClick={onOpenHermes}
                  className="text-xs text-[#009668] font-bold bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#6ffbbe]/40 flex items-center gap-1 cursor-pointer"
                  title="Hermes Copiloto"
                >
                  <span className="material-symbols-outlined text-xs">auto_awesome</span>
                  <span>Hermes</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#76777d] text-base">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversa ou cliente..."
                className="w-full bg-[#f2f4f6] border border-[#c6c6cd]/30 rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#191c1e] placeholder:text-[#76777d] focus:outline-none focus:bg-white focus:border-[#131b2e]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Channels Filter Tabs */}
            <div className="flex bg-[#f2f4f6] p-1 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar">
              {(["Todos", "WhatsApp", "Instagram", "Email"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`flex-1 min-w-[60px] py-1 px-2 text-[11px] rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                    channelFilter === ch
                      ? "bg-[#131b2e] text-white shadow-xs font-bold"
                      : "text-[#45464d] hover:text-[#191c1e]"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f2f4f6]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <span className="material-symbols-outlined text-3xl">chat_bubble_outline</span>
                <p className="text-xs font-medium">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === currentConv?.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      setMobileActiveView("chat");
                    }}
                    className={`p-3 sm:p-3.5 hover:bg-white cursor-pointer transition-colors flex items-start gap-3 relative ${
                      isSelected ? "bg-white border-l-4 border-[#131b2e]" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {conv.avatarUrl ? (
                        <img
                          src={conv.avatarUrl}
                          alt={conv.clientName}
                          className="w-10 h-10 rounded-full object-cover border border-[#c6c6cd]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#131b2e] text-white font-bold text-xs flex items-center justify-center">
                          {conv.initials || "CL"}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white text-[9px] flex items-center justify-center font-bold text-white ${
                          conv.channel === "WhatsApp"
                            ? "bg-emerald-500"
                            : conv.channel === "Instagram"
                            ? "bg-pink-500"
                            : "bg-blue-500"
                        }`}
                        title={conv.channel}
                      >
                        {conv.channel[0]}
                      </span>
                    </div>

                    {/* Conv Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="font-bold text-xs text-[#191c1e] truncate">{conv.clientName}</h4>
                        <span className="text-[10px] text-[#76777d] shrink-0">{conv.lastMessageTime}</span>
                      </div>

                      <p className="text-[11px] text-[#45464d] truncate font-medium">
                        {conv.lastMessage}
                      </p>

                      <div className="flex items-center justify-between gap-1 mt-1.5">
                        {conv.tag && (
                          <span className="text-[9px] font-bold text-[#009668] bg-[#ECFDF5] px-1.5 py-0.2 rounded border border-[#6ffbbe]/40">
                            {conv.tag}
                          </span>
                        )}

                        {conv.unreadCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-red-600 text-white font-bold text-[9px] flex items-center justify-center ml-auto">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: Chat Interface */}
        {currentConv && (
          <div
            className={`flex-1 flex flex-col bg-white overflow-hidden ${
              mobileActiveView === "chat"
                ? "flex"
                : mobileActiveView === "info"
                ? "hidden md:flex"
                : "hidden md:flex"
            }`}
          >
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-[#f2f4f6] flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileActiveView("list")}
                  className="md:hidden text-[#45464d] hover:text-[#191c1e] p-1 rounded-lg"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>

                {currentConv.avatarUrl ? (
                  <img
                    src={currentConv.avatarUrl}
                    alt={currentConv.clientName}
                    className="w-9 h-9 rounded-full object-cover border border-[#c6c6cd]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#131b2e] text-white font-bold text-xs flex items-center justify-center">
                    {currentConv.initials || "CL"}
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                    <span>{currentConv.clientName}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {currentConv.company}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#009668] font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    Atendimento via {currentConv.channel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileActiveView("info")}
                  className="md:hidden text-[#45464d] hover:text-[#191c1e] p-1.5 rounded-lg border border-[#c6c6cd]/40"
                  title="Ver Perfil"
                >
                  <span className="material-symbols-outlined text-lg">info</span>
                </button>

                <button
                  onClick={handleGenerateAiReply}
                  disabled={isGeneratingAiReply}
                  className="bg-[#ECFDF5] hover:bg-[#d0fbe3] text-[#005236] font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-[#6ffbbe]/40 transition-all cursor-pointer hermes-glow"
                >
                  <span className="material-symbols-outlined text-sm text-[#009668] animate-pulse">
                    auto_awesome
                  </span>
                  <span>{isGeneratingAiReply ? "Gerando Resposta..." : "Gerar Resposta IA"}</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8fafc]/50">
              {currentConv.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-[#131b2e] text-white rounded-tr-xs shadow-xs"
                        : "bg-white text-[#191c1e] border border-[#c6c6cd]/40 rounded-tl-xs shadow-xs"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span
                      className={`text-[9px] block text-right mt-1 font-mono ${
                        msg.sender === "user" ? "text-slate-300" : "text-[#76777d]"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {/* Floating Hermes AI Suggested Reply Card */}
              {currentConv.hermesSuggestedReply && (
                <div className="bg-[#ECFDF5] border border-[#6ffbbe]/60 rounded-2xl p-4 my-4 hermes-glow space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#009668] text-lg animate-pulse">
                        auto_awesome
                      </span>
                      <span className="font-bold text-xs text-[#005236]">
                        Sugestão do Hermes AI
                      </span>
                    </div>
                    <span className="text-[10px] text-[#009668] font-bold bg-white/60 px-2 py-0.5 rounded-md">
                      Pronta para envio
                    </span>
                  </div>

                  <p className="text-xs text-[#131b2e] leading-relaxed font-medium bg-white/80 p-3 rounded-xl border border-emerald-100">
                    "{currentConv.hermesSuggestedReply}"
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() =>
                        setMessageText(currentConv.hermesSuggestedReply || "")
                      }
                      className="px-3 py-1.5 bg-white text-[#131b2e] font-bold rounded-lg text-xs border border-emerald-200 hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      Copiar p/ Campo
                    </button>
                    <button
                      onClick={() => {
                        handleSendMessage(currentConv.hermesSuggestedReply);
                        setConversations((prev) =>
                          prev.map((c) =>
                            c.id === currentConv.id ? { ...c, hermesSuggestedReply: undefined } : c
                          )
                        );
                      }}
                      className="px-4 py-1.5 bg-[#009668] hover:bg-[#007d57] text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>Enviar Sugestão</span>
                      <span className="material-symbols-outlined text-sm">send</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Email Templates Selector Bar */}
            <div className="px-3 py-2 bg-[#f8fafc] border-t border-[#f2f4f6] flex items-center gap-2 overflow-x-auto text-xs shrink-0">
              <span className="text-[11px] font-bold text-[#131b2e] flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-sm text-[#009668]">mail</span>
                Templates E-mail:
              </span>
              {emailTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    if (currentConv) {
                      const text = tpl.body(
                        currentConv.clientName,
                        currentConv.company,
                        currentConv.estimatedValue
                      );
                      setMessageText(text);
                      setSelectedEmailTemplate(tpl.id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                    selectedEmailTemplate === tpl.id
                      ? "bg-[#131b2e] text-white border-[#131b2e]"
                      : "bg-white text-[#45464d] hover:bg-[#f2f4f6] border-[#c6c6cd]/40"
                  }`}
                  title={tpl.subject}
                >
                  {tpl.name}
                </button>
              ))}
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-[#f2f4f6] bg-white flex items-center gap-2 shrink-0">
              <button
                onClick={() => alert("Anexar arquivo ou arte gráfica.")}
                className="p-2 text-[#45464d] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-xl transition-colors cursor-pointer"
                title="Anexar Arquivo"
              >
                <span className="material-symbols-outlined text-xl">attach_file</span>
              </button>

              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Digite sua mensagem de atendimento..."
                className="flex-1 bg-[#f2f4f6] border border-[#c6c6cd]/40 rounded-xl px-4 py-2.5 text-xs text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#131b2e]"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!messageText.trim()}
                className="bg-[#131b2e] hover:bg-[#0b111f] disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Enviar</span>
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: Client Profile & Hermes Summary (Desktop always, mobile conditionally) */}
        {currentConv && (
          <div
            className={`w-full md:w-72 lg:w-80 border-l border-[#f2f4f6] bg-[#f7f9fb] p-5 overflow-y-auto space-y-6 shrink-0 ${
              mobileActiveView === "info" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
            }`}
          >
            {/* Top Close for Mobile */}
            <button
              onClick={() => setMobileActiveView("chat")}
              className="lg:hidden text-[#45464d] self-start flex items-center gap-1 text-xs font-bold mb-2"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar ao Chat
            </button>

            {/* Profile Header */}
            <div className="text-center space-y-2">
              {currentConv.avatarUrl ? (
                <img
                  src={currentConv.avatarUrl}
                  alt={currentConv.clientName}
                  className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-white shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#131b2e] text-white font-bold text-lg flex items-center justify-center mx-auto shadow-md">
                  {currentConv.initials || "CL"}
                </div>
              )}

              <h4 className="font-bold text-sm text-[#191c1e]">{currentConv.clientName}</h4>
              <p className="text-xs text-[#45464d]">{currentConv.role || currentConv.company}</p>

              <span className="inline-block text-[10px] font-bold text-[#009668] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#6ffbbe]/40">
                {currentConv.stage || "Em Negociação"}
              </span>
            </div>

            {/* Hermes Summary Box */}
            <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#005236]">
                <span className="material-symbols-outlined text-[#009668] text-base animate-pulse">
                  auto_awesome
                </span>
                Resumo por Hermes AI
              </div>
              <p className="text-xs text-[#45464d] leading-relaxed">
                {currentConv.hermesSummary ||
                  "Cliente demonstra alto interesse nos pacotes de publicidade da 2N. Prefere respostas objetivas via WhatsApp no período da manhã."}
              </p>
            </div>

            {/* Contact Details */}
            <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow space-y-3 text-xs">
              <h5 className="font-bold text-xs text-[#191c1e] uppercase tracking-wider">
                Informações do Lead
              </h5>

              <div className="space-y-2.5">
                <div>
                  <span className="text-[#76777d] block text-[10px] mb-1">Etapa no Funil de Vendas</span>
                  <select
                    value={currentConv.stage || "NOVO"}
                    onChange={(e) => handleUpdateStage(e.target.value as PipelineStage)}
                    className="w-full bg-[#f2f4f6] border border-[#c6c6cd]/40 rounded-lg px-2.5 py-1.5 font-bold text-xs text-[#131b2e] focus:outline-none focus:bg-white"
                  >
                    <option value="NOVO">NOVO LEAD</option>
                    <option value="CONTACTADO">CONTACTADO</option>
                    <option value="ORÇAMENTO">ORÇAMENTO</option>
                    <option value="NEGOCIAÇÃO">NEGOCIAÇÃO</option>
                    <option value="APROVADO">APROVADO / FECHADO</option>
                  </select>
                </div>
                <div>
                  <span className="text-[#76777d] block text-[10px]">Valor Estimado</span>
                  <span className="font-bold text-[#131b2e]">
                    Kz {(currentConv.estimatedValue || 280000).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div>
                  <span className="text-[#76777d] block text-[10px]">Canal de Origem</span>
                  <span className="font-semibold text-[#191c1e]">{currentConv.channel}</span>
                </div>
                <div>
                  <span className="text-[#76777d] block text-[10px]">Empresa</span>
                  <span className="font-semibold text-[#191c1e]">{currentConv.company}</span>
                </div>
              </div>
            </div>

            {/* Activity History */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-xs text-[#191c1e] uppercase tracking-wider">
                Histórico de Interações
              </h5>
              <div className="border-l-2 border-[#131b2e] pl-3 space-y-3">
                <div>
                  <p className="font-bold text-[#191c1e]">Primeiro Contato</p>
                  <p className="text-[11px] text-[#45464d]">Lead capturado via {currentConv.channel}</p>
                </div>
                <div>
                  <p className="font-bold text-[#191c1e]">Orçamento Solicitado</p>
                  <p className="text-[11px] text-[#45464d]">Aguardando envio do escopo comercial</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NEW CONVERSATION MODAL */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#131b2e] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">chat</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#191c1e]">Nova Conversa</h3>
                  <p className="text-xs text-slate-500">Inicie um novo atendimento omnichannel</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateNewChat} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-bold text-[#191c1e] mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#131b2e]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#191c1e] mb-1">Empresa / Negócio *</label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Ex: BFA Banco ou Grupo Kero"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#131b2e]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#191c1e] mb-1">Canal de Comunicação</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["WhatsApp", "Instagram", "Email"] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setNewChannel(ch)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        newChannel === ch
                          ? "bg-[#131b2e] text-white border-[#131b2e]"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#191c1e] mb-1">Primeira Mensagem</label>
                <textarea
                  rows={3}
                  value={newInitialMsg}
                  onChange={(e) => setNewInitialMsg(e.target.value)}
                  placeholder="Mensagem de abertura do atendimento..."
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#131b2e]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  Iniciar Conversa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
