import React, { useState, useEffect } from "react";
import { NavigationTab } from "../types";

interface TopHeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenHermes: () => void;
  onOpenMobileMenu: () => void;
  unreadNotificationsCount?: number;
  isDndEnabled?: boolean;
  onToggleDnd?: (enabled: boolean) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenHermes,
  onOpenMobileMenu,
  unreadNotificationsCount = 2,
  isDndEnabled: externalDnd,
  onToggleDnd,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Local state initialized with LocalStorage
  const [isDndEnabled, setIsDndEnabled] = useState<boolean>(() => {
    return localStorage.getItem("crm_dnd_enabled") === "true";
  });

  useEffect(() => {
    if (externalDnd !== undefined && externalDnd !== isDndEnabled) {
      setIsDndEnabled(externalDnd);
    }
  }, [externalDnd]);

  const toggleDnd = () => {
    const nextVal = !isDndEnabled;
    setIsDndEnabled(nextVal);
    localStorage.setItem("crm_dnd_enabled", String(nextVal));
    if (onToggleDnd) {
      onToggleDnd(nextVal);
    }
  };

  return (
    <header className="h-16 fixed top-0 right-0 left-0 md:left-[260px] z-30 bg-[#f7f9fb] text-[#191c1e] border-b border-[#c6c6cd]/50 flex items-center justify-between px-4 md:px-6 w-full">
      {/* Left Area: Mobile Toggle & Global Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden text-[#191c1e] hover:bg-black/5 p-2 rounded-lg transition-colors cursor-pointer"
          title="Abrir Menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        {/* Global Search Input */}
        <div className="relative w-full max-w-xs focus-within:ring-2 focus-within:ring-[#131b2e] rounded-lg transition-all">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar negócios, clientes..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#f2f4f6] border border-[#c6c6cd]/40 rounded-lg text-sm text-[#191c1e] placeholder:text-[#45464d] focus:outline-none focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Center Links (Desktop only) */}
      <div className="hidden lg:flex items-center gap-6 h-16">
        <button
          onClick={() => setActiveTab("principal")}
          className={`h-full flex items-center text-sm font-semibold transition-colors px-2 border-b-2 cursor-pointer ${
            activeTab === "principal"
              ? "text-[#191c1e] border-[#191c1e]"
              : "text-[#45464d] border-transparent hover:text-[#191c1e]"
          }`}
        >
          Dashboard
        </button>

        <button
          onClick={() => setActiveTab("vendas")}
          className={`h-full flex items-center text-sm font-semibold transition-colors px-2 border-b-2 cursor-pointer ${
            activeTab === "vendas"
              ? "text-[#191c1e] border-[#191c1e]"
              : "text-[#45464d] border-transparent hover:text-[#191c1e]"
          }`}
        >
          Pipeline
        </button>

        <button
          onClick={() => setActiveTab("atendimento")}
          className={`h-full flex items-center text-sm font-semibold transition-colors px-2 border-b-2 cursor-pointer ${
            activeTab === "atendimento"
              ? "text-[#191c1e] border-[#191c1e]"
              : "text-[#45464d] border-transparent hover:text-[#191c1e]"
          }`}
        >
          Inbox
        </button>

        <button
          onClick={() => setActiveTab("relatorios")}
          className={`h-full flex items-center text-sm font-semibold transition-colors px-2 border-b-2 cursor-pointer ${
            activeTab === "relatorios"
              ? "text-[#191c1e] border-[#191c1e]"
              : "text-[#45464d] border-transparent hover:text-[#191c1e]"
          }`}
        >
          Relatórios
        </button>

        <button
          onClick={() => setActiveTab("calendario")}
          className={`h-full flex items-center text-sm font-semibold transition-colors px-2 border-b-2 cursor-pointer ${
            activeTab === "calendario"
              ? "text-[#191c1e] border-[#191c1e]"
              : "text-[#45464d] border-transparent hover:text-[#191c1e]"
          }`}
        >
          Calendário
        </button>
      </div>

      {/* Right Area: Hermes AI CTA, DND Button, Notifications & User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Hermes AI Button */}
        <button
          onClick={onOpenHermes}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ECFDF5] text-[#005236] border border-[#6ffbbe]/40 hover:bg-[#d0fbe3] active:scale-95 transition-all cursor-pointer hermes-glow shadow-xs"
        >
          <span className="material-symbols-outlined text-[18px] text-[#009668] animate-pulse">
            auto_awesome
          </span>
          <span className="text-xs font-bold tracking-tight">Hermes AI</span>
        </button>

        {/* Non Disturb (Não Perturbe) Button */}
        <button
          onClick={toggleDnd}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
            isDndEnabled
              ? "bg-amber-100 text-amber-900 border-amber-300 shadow-xs ring-1 ring-amber-400"
              : "bg-[#f2f4f6] text-[#45464d] hover:text-[#191c1e] border-[#c6c6cd]/40"
          }`}
          title={isDndEnabled ? "Não Perturbe Ativo (Silenciado)" : "Ativar Modo Não Perturbe"}
        >
          <span className={`material-symbols-outlined text-[18px] ${isDndEnabled ? "text-amber-800 font-bold" : ""}`}>
            {isDndEnabled ? "notifications_off" : "notifications"}
          </span>
          <span className="hidden sm:inline font-medium">
            {isDndEnabled ? "Não Perturbe" : "Silenciar"}
          </span>
          {isDndEnabled && (
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
          )}
        </button>

        {/* Notifications Bell Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-[#45464d] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-full transition-all relative cursor-pointer"
            title={isDndEnabled ? "Notificações (Silenciadas)" : "Notificações"}
          >
            <span className="material-symbols-outlined text-xl">
              {isDndEnabled ? "notifications_paused" : "notifications"}
            </span>
            {!isDndEnabled && unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full ring-2 ring-white" />
            )}
            {isDndEnabled && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full ring-1 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-[#c6c6cd]/50 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-[#f2f4f6] flex items-center justify-between">
                <span className="font-semibold text-sm text-[#191c1e]">Notificações</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isDndEnabled
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {isDndEnabled ? "Silenciado" : `${unreadNotificationsCount} novas`}
                </span>
              </div>

              {isDndEnabled && (
                <div className="bg-amber-50 border-b border-amber-200/80 px-3 py-2 text-[11px] text-amber-900 font-medium flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-amber-700">
                    notifications_off
                  </span>
                  <span>Modo Não Perturbe Ativo — Avisos visuais em segundo plano silenciados.</span>
                </div>
              )}

              <div className="divide-y divide-[#f2f4f6] max-h-64 overflow-y-auto text-xs">
                <div className="p-3 hover:bg-[#f7f9fb] cursor-pointer">
                  <p className="font-semibold text-[#191c1e]">3 Orçamentos prestes a expirar</p>
                  <p className="text-[#45464d] mt-0.5">Validade em 24h - Hermes agendou lembretes.</p>
                  <span className="text-[10px] text-[#76777d] mt-1 block">Há 15 minutos</span>
                </div>
                <div className="p-3 hover:bg-[#f7f9fb] cursor-pointer">
                  <p className="font-semibold text-[#191c1e]">Proposta Aprovada - Mar Sol</p>
                  <p className="text-[#45464d] mt-0.5">Valor total de Kz 1.200.000 confirmado.</p>
                  <span className="text-[10px] text-[#76777d] mt-1 block">Há 1 hora</span>
                </div>
              </div>

              <div className="p-2 border-t border-[#f2f4f6] text-center">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-[#009668] font-semibold hover:underline"
                >
                  Marcar todas como lidas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help Button */}
        <button
          onClick={() => alert("Central de Ajuda da 2N Publicidade: Suporte técnico disponível 24/7.")}
          className="hidden sm:block p-2 text-[#45464d] hover:text-[#191c1e] hover:bg-[#f2f4f6] rounded-full transition-all cursor-pointer"
          title="Ajuda"
        >
          <span className="material-symbols-outlined text-xl">help_outline</span>
        </button>

        {/* User Avatar */}
        <div
          onClick={() => setActiveTab("configuracoes")}
          className="w-9 h-9 rounded-full overflow-hidden border border-[#c6c6cd] cursor-pointer hover:ring-2 hover:ring-[#131b2e] transition-all shrink-0 ml-1"
          title="Nino - Perfil de Executivo"
        >
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCN3Nws1QGCp7S2tNg9Q_JsiG2qRuKhA36dNcvdWbp10OQfq7pfI4Aa8YTXJoX8WLtdMIwqAfhLM28CP_AOe1ge42manK1PiYk6_2GK2-uHgDA5q9LL-cGMFgu8qeMGf0U9k5flHBPjo8BjfkDLjSaifmnOMwXiBs1JD-v7PNGEo13ePgOArFIGZXlk3OUjFCi3g3xylEX_8ubou_FfntffCPp-7gzHJsLe9RPAu5LuT0TxRA5WF4lx"
            alt="Nino - Executivo"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
};
