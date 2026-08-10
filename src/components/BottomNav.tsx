import React from "react";
import { NavigationTab } from "../types";

interface BottomNavProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenHermes: () => void;
  onOpenNewSale: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenHermes,
  onOpenNewSale,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#131b2e] text-white border-t border-white/10 flex items-center justify-around z-40 px-2 pb-safe">
      <button
        onClick={() => setActiveTab("principal")}
        className={`flex flex-col items-center justify-center w-full h-full cursor-pointer ${
          activeTab === "principal" ? "text-[#4edea3]" : "text-[#7c839b] hover:text-white"
        }`}
      >
        <span className="material-symbols-outlined text-xl">dashboard</span>
        <span className="text-[10px] font-medium mt-0.5">Principal</span>
      </button>

      <button
        onClick={() => setActiveTab("vendas")}
        className={`flex flex-col items-center justify-center w-full h-full cursor-pointer ${
          activeTab === "vendas" ? "text-[#4edea3]" : "text-[#7c839b] hover:text-white"
        }`}
      >
        <span className="material-symbols-outlined text-xl">payments</span>
        <span className="text-[10px] font-medium mt-0.5">Vendas</span>
      </button>

      {/* Floating Center Action Button */}
      <div className="w-full flex justify-center -mt-6">
        <button
          onClick={onOpenNewSale}
          className="w-12 h-12 bg-[#4edea3] text-[#131b2e] rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-2 border-[#131b2e]"
          title="Nova Venda"
        >
          <span className="material-symbols-outlined text-2xl font-bold">add</span>
        </button>
      </div>

      <button
        onClick={() => setActiveTab("atendimento")}
        className={`flex flex-col items-center justify-center w-full h-full cursor-pointer ${
          activeTab === "atendimento" ? "text-[#4edea3]" : "text-[#7c839b] hover:text-white"
        }`}
      >
        <span className="material-symbols-outlined text-xl">support_agent</span>
        <span className="text-[10px] font-medium mt-0.5">Inbox</span>
      </button>

      <button
        onClick={onOpenHermes}
        className="flex flex-col items-center justify-center w-full h-full text-[#7c839b] hover:text-[#4edea3] relative cursor-pointer"
      >
        <span className="absolute top-1 right-3 w-2 h-2 bg-[#4edea3] rounded-full animate-ping" />
        <span className="material-symbols-outlined text-xl text-[#4edea3]">auto_awesome</span>
        <span className="text-[10px] font-medium mt-0.5 text-[#4edea3]">Hermes</span>
      </button>
    </nav>
  );
};
