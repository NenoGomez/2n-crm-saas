import React, { useState } from "react";

export const CalendarioView: React.FC = () => {
  const [events] = useState([
    { id: "1", title: "Reunião de Alinhamento - BCA Bank", time: "10:00 - 11:00", type: "reuniao" },
    { id: "2", title: "Aprovação de Layouts - Shopping Palladium", time: "14:30 - 15:00", type: "arte" },
    { id: "3", title: "Disparo Follow-up Hermes AI (3 Orçamentos)", time: "16:00", type: "hermes" },
    { id: "4", title: "Entrega Banners Lona 440g - Rest. Mar Sol", time: "17:30", type: "entrega" },
  ]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e]">Calendário Comercial & Entregas</h2>
          <p className="text-xs text-[#45464d] mt-0.5">
            Agendamentos de reuniões, follow-ups e prazos de produção da 2N Publicidade.
          </p>
        </div>

        <button
          onClick={() => alert("Agendar compromisso comercial.")}
          className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>Novo Agendamento</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <div className="flex items-center justify-between border-b border-[#f2f4f6] pb-3">
            <h3 className="font-bold text-base text-[#191c1e]">Hoje - Agenda de Compromissos</h3>
            <span className="text-xs font-bold text-[#009668] bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#6ffbbe]/40">
              4 Compromissos
            </span>
          </div>

          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-4 rounded-xl border border-[#c6c6cd]/40 bg-[#f7f9fb] flex items-center justify-between gap-4 hover:border-[#131b2e] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#131b2e] text-white flex items-center justify-center font-bold shrink-0">
                    <span className="material-symbols-outlined text-lg">
                      {ev.type === "hermes"
                        ? "auto_awesome"
                        : ev.type === "reuniao"
                        ? "groups"
                        : ev.type === "arte"
                        ? "palette"
                        : "local_shipping"}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#191c1e]">{ev.title}</h4>
                    <span className="text-[11px] text-[#45464d] font-mono">{ev.time}</span>
                  </div>
                </div>

                <span className="text-[10px] font-bold text-[#45464d] bg-white px-2.5 py-1 rounded-lg border border-[#c6c6cd]/40">
                  Confirmado
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <h3 className="font-bold text-sm text-[#191c1e]">Próximos Dias</h3>
          <div className="space-y-3 text-xs text-[#45464d]">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-[#191c1e] block">Amanhã - 11:00</span>
              <p>Apresentação do plano de mídia para Agência Mosaico.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-[#191c1e] block">Sexta - 16:00</span>
              <p>Revisão semanal do faturamento comercial com a diretoria.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
