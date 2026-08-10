import React from "react";
import { NavigationTab } from "../types";

interface SidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenNewSale: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewSale,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const mainNavItems: { tab: NavigationTab; label: string; icon: string; hasDot?: boolean }[] = [
    { tab: "principal", label: "Principal", icon: "dashboard" },
    { tab: "vendas", label: "Vendas (Pipeline)", icon: "payments" },
    { tab: "orcamentos", label: "Orçamentos & Faturas", icon: "request_quote" },
    { tab: "atendimento", label: "Inbox & Chat", icon: "forum", hasDot: true },
    { tab: "producao", label: "Produção Gráfica", icon: "precision_manufacturing" },
    { tab: "financeiro", label: "Financeiro", icon: "account_balance" },
    { tab: "produtividade", label: "Base de Clientes", icon: "group" },
    { tab: "automacao", label: "Automações IA", icon: "auto_awesome" },
    { tab: "sistema", label: "Configurações", icon: "settings" },
  ];

  const handleSelect = (tab: NavigationTab) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-[260px] h-full bg-[#131b2e] text-white flex flex-col py-6 select-none border-r border-white/10 shadow-lg">
      {/* Brand Header */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-bold text-[#131b2e] text-xl shrink-0 shadow-sm">
            2N
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight tracking-tight">2N Publicidade</h1>
            <p className="text-xs text-[#7c839b] font-medium tracking-wide">CRM Executivo</p>
          </div>
        </div>
      </div>

      {/* New Sale CTA */}
      <div className="px-6 mb-6">
        <button
          onClick={() => {
            onOpenNewSale();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full bg-[#0F172A] hover:bg-white/10 active:scale-95 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 border border-white/10 shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Nova Venda</span>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {mainNavItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => handleSelect(item.tab)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
                isActive
                  ? "text-[#4edea3] border-l-4 border-[#4edea3] bg-white/10 font-semibold"
                  : "text-[#7c839b] hover:text-white hover:bg-white/5 border-l-4 border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`material-symbols-outlined ${
                    isActive && item.icon === "auto_awesome" ? "text-[#4edea3]" : ""
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.hasDot && (
                <span className="w-2 h-2 rounded-full bg-[#4edea3] shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Navigation */}
      <div className="mt-auto px-3 pt-4 border-t border-white/10 space-y-1">
        <button
          onClick={() => handleSelect("configuracoes")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
            activeTab === "configuracoes"
              ? "text-[#4edea3] border-l-4 border-[#4edea3] bg-white/10 font-semibold"
              : "text-[#7c839b] hover:text-white hover:bg-white/5 border-l-4 border-transparent"
          }`}
        >
          <span className="material-symbols-outlined">settings</span>
          <span>Configurações</span>
        </button>
        <button
          onClick={() => {
            alert("Sessão finalizada com segurança.");
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[#7c839b] hover:text-red-400 hover:bg-white/5 transition-colors duration-200 cursor-pointer border-l-4 border-transparent"
        >
          <span className="material-symbols-outlined">logout</span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-screen z-40">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
