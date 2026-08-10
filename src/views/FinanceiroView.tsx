import React from "react";

export const FinanceiroView: React.FC = () => {
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <h2 className="text-xl font-bold text-[#191c1e]">Financeiro & Faturamento</h2>
        <p className="text-xs text-[#45464d] mt-0.5">
          Controle de contas a receber, faturamento por cliente e fluxo de caixa da 2N Publicidade.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-xs font-semibold text-[#45464d] block">Faturamento do Mês</span>
          <div className="text-2xl font-bold text-[#191c1e] mt-1">12.400.000 Kz</div>
          <span className="text-xs text-emerald-600 font-bold mt-1 inline-block">+14% vs meta</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-xs font-semibold text-[#45464d] block">A Receber (Pendentes)</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">2.100.000 Kz</div>
          <span className="text-xs text-amber-700 font-medium mt-1 inline-block">5 clientes pendentes</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-xs font-semibold text-[#45464d] block">Ticket Médio por Venda</span>
          <div className="text-2xl font-bold text-[#131b2e] mt-1">850.000 Kz</div>
          <span className="text-xs text-blue-600 font-bold mt-1 inline-block">OOH & Mídia Impressa</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
        <h3 className="font-bold text-base text-[#191c1e]">Faturas Recentes & Pagamentos</h3>
        <div className="divide-y divide-[#f2f4f6] text-xs">
          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#191c1e]">Restaurante Mar Sol</p>
              <p className="text-[11px] text-[#76777d]">Rebranding Total & Fachada Luminescente</p>
            </div>
            <span className="font-bold text-emerald-600">1.200.000 Kz (PAGO)</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#191c1e]">BCA Bank</p>
              <p className="text-[11px] text-[#76777d]">Painéis Publicitários (OOH)</p>
            </div>
            <span className="font-bold text-amber-600">2.100.000 Kz (PENDENTE)</span>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#191c1e]">João Silva (JS Eventos)</p>
              <p className="text-[11px] text-[#76777d]">Material Gráfico Evento Anual</p>
            </div>
            <span className="font-bold text-emerald-600">185.000 Kz (PAGO)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
