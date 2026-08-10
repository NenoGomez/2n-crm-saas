import React from "react";

export const CalendarioView: React.FC<{ events?: any[] }> = ({ events = [] }) => {
  const sorted = [...events].sort((a: any, b: any) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());
  const iconFor = (t?: string) =>
    t === "hermes" ? "auto_awesome" : t === "reuniao" ? "groups" : t === "arte" ? "palette" : "local_shipping";

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e]">Calendário Comercial & Entregas</h2>
          <p className="text-xs text-[#45464d] mt-0.5">
            Agendamentos e prazos sincronizados das conversas, pedidos e produção (fonte única: backend).
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
            <h3 className="font-bold text-base text-[#191c1e]">Agenda de Compromissos</h3>
            <span className="text-xs font-bold text-[#009668] bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#6ffbbe]/40">
              {sorted.length} Compromissos
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#76777d]">Nenhum evento agendado. Os prazos das conversas aparecem aqui automaticamente.</div>
          ) : (
            <div className="space-y-3">
              {sorted.map((ev) => {
                const start = ev.start ? new Date(ev.start) : null;
                const time = start
                  ? start.toLocaleString("pt-AO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <div
                    key={ev.id}
                    className="p-4 rounded-xl border border-[#c6c6cd]/40 bg-[#f7f9fb] flex items-center justify-between gap-4 hover:border-[#131b2e] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#131b2e] text-white flex items-center justify-center font-bold shrink-0">
                        <span className="material-symbols-outlined text-lg">{iconFor(ev.type)}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-[#191c1e]">{ev.title}</h4>
                        <span className="text-[11px] text-[#45464d] font-mono">{time}</span>
                        {ev.orderId && <span className="text-[10px] text-[#009668] block font-bold">{ev.orderId}</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${ev.done ? "text-[#009668] bg-[#ECFDF5] border-[#6ffbbe]/40" : "text-[#45464d] bg-white border-[#c6c6cd]/40"}`}>
                      {ev.done ? "Concluído" : (ev.priority || "Agendado")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <h3 className="font-bold text-sm text-[#191c1e]">Próximos Dias</h3>
          <div className="space-y-3 text-xs text-[#45464d]">
            {sorted.slice(0, 4).length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">Sem eventos próximos.</div>
            ) : (
              sorted.slice(0, 4).map((ev) => {
                const start = ev.start ? new Date(ev.start) : null;
                const when = start ? start.toLocaleString("pt-AO", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
                return (
                  <div key={ev.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-[#191c1e] block">{when}</span>
                    <p>{ev.title}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
