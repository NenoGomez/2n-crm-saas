import React, { useState } from "react";
import { Client, Conversation, ProductionOrder, Quote } from "../types";
import { ClientProfileModal } from "../components/ClientProfileModal";

interface ClientesViewProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onOpenNewClient: () => void;
  onSelectClientForChat?: (clientId: string) => void;
  conversations?: Conversation[];
  orders?: ProductionOrder[];
  quotes?: Quote[];
  onOpenNewQuoteForClient?: (client: Client) => void;
}

export const ClientesView: React.FC<ClientesViewProps> = ({
  clients,
  setClients,
  onOpenNewClient,
  onSelectClientForChat,
  conversations = [],
  orders = [],
  quotes = [],
  onOpenNewQuoteForClient,
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"Todos" | "Ativo" | "Inativo" | "VIP">("Todos");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);

    if (filter === "Todos") return matchesSearch;
    if (filter === "VIP") return matchesSearch && c.isVip;
    return matchesSearch && c.status === filter;
  });

  const toggleClientStatus = (id: string) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === "Ativo" ? "Inativo" : "Ativo" } : c
      )
    );
  };

  const deleteClient = (id: string) => {
    if (confirm("Tem certeza que deseja remover este cliente do CRM?")) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e]">Gestão de Clientes</h2>
          <p className="text-xs text-[#45464d]">
            Base de contatos da 2N Publicidade com histórico financeiro e segmentação.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csvHeaders = "ID;Nome;Empresa;Telefone;E-mail;Responsavel;Pedidos;Total_Gasto_Kz;Status;VIP;Ultima_Compra\n";
              const csvRows = clients
                .map((c) =>
                  [
                    c.id,
                    `"${c.name.replace(/"/g, '""')}"`,
                    `"${c.company.replace(/"/g, '""')}"`,
                    `"${c.phone}"`,
                    `"${c.email || ""}"`,
                    `"${c.manager}"`,
                    c.ordersCount,
                    c.totalSpent,
                    c.status,
                    c.isVip ? "Sim" : "Nao",
                    `"${c.lastPurchase}"`,
                  ].join(";")
                )
                .join("\n");

              const blob = new Blob(["\uFEFF" + csvHeaders + csvRows], {
                type: "text/csv;charset=utf-8;",
              });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute(
                "download",
                `clientes_2N_publicidade_${new Date().toISOString().slice(0, 10)}.csv`
              );
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="bg-emerald-50 hover:bg-emerald-100 text-[#009668] border border-[#6ffbbe]/50 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="Exportar base completa para planilha Excel/CSV"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={onOpenNewClient}
            className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex bg-white p-1 rounded-xl border border-[#c6c6cd]/40 text-xs level-1-shadow overflow-x-auto">
          {(["Todos", "Ativo", "Inativo", "VIP"] as const).map((f) => {
            const count =
              f === "Todos"
                ? clients.length
                : f === "VIP"
                ? clients.filter((c) => c.isVip).length
                : clients.filter((c) => c.status === f).length;

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  filter === f
                    ? "bg-[#131b2e] text-white shadow-xs"
                    : "text-[#45464d] hover:text-[#191c1e]"
                }`}
              >
                <span>{f === "Ativo" ? "Ativos" : f === "Inativo" ? "Inativos" : f}</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#45464d] text-base">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#c6c6cd]/50 rounded-xl text-xs text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
          />
        </div>
      </div>

      {/* Desktop Data Table */}
      <div className="bg-white rounded-2xl border border-[#c6c6cd]/40 level-1-shadow overflow-hidden hidden md:block">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f7f9fb] text-[11px] font-bold text-[#45464d] uppercase border-b border-[#c6c6cd]/30 tracking-wider">
              <th className="py-3 px-4">Cliente</th>
              <th className="py-3 px-4">Empresa</th>
              <th className="py-3 px-4">Telefone</th>
              <th className="py-3 px-4">Última Compra</th>
              <th className="py-3 px-4">Total Gasto</th>
              <th className="py-3 px-4">Pedidos</th>
              <th className="py-3 px-4">Responsável</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f4f6] text-xs">
            {filteredClients.map((client) => (
              <tr
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="hover:bg-[#f7f9fb] transition-colors cursor-pointer group"
              >
                {/* Avatar & Name */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {client.avatarUrl ? (
                      <img
                        src={client.avatarUrl}
                        alt={client.name}
                        className="w-8 h-8 rounded-full object-cover border border-[#c6c6cd]"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#131b2e] text-white font-bold text-xs flex items-center justify-center">
                        {client.initials || "CL"}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-[#191c1e] group-hover:text-[#009668] transition-colors flex items-center gap-1.5">
                        <span>{client.name}</span>
                        {client.isVip && (
                          <span className="text-amber-500 text-xs" title="Cliente VIP">
                            ★
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#76777d]">{client.email}</span>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4 font-semibold text-[#191c1e]">{client.company}</td>
                <td className="py-3 px-4 text-[#45464d] font-mono text-[11px]">{client.phone}</td>
                <td className="py-3 px-4 text-[#45464d]">{client.lastPurchase}</td>

                <td className="py-3 px-4 font-bold text-[#131b2e]">
                  Kz {client.totalSpent.toLocaleString("pt-BR")}
                </td>

                <td className="py-3 px-4 font-semibold text-[#45464d]">{client.ordersCount}</td>

                <td className="py-3 px-4 font-medium text-[#45464d]">{client.manager}</td>

                <td className="py-3 px-4">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      client.status === "Ativo"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {client.status}
                  </span>
                </td>

                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {onSelectClientForChat && (
                      <button
                        onClick={() => onSelectClientForChat(client.id)}
                        className="p-1.5 hover:bg-emerald-50 text-[#009668] rounded-lg transition-colors cursor-pointer"
                        title="Iniciar Atendimento"
                      >
                        <span className="material-symbols-outlined text-base">chat</span>
                      </button>
                    )}
                    <button
                      onClick={() => toggleClientStatus(client.id)}
                      className="p-1.5 hover:bg-slate-100 text-[#45464d] rounded-lg transition-colors cursor-pointer"
                      title="Alternar Status"
                    >
                      <span className="material-symbols-outlined text-base">sync_alt</span>
                    </button>
                    <button
                      onClick={() => deleteClient(client.id)}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            onClick={() => setSelectedClient(client)}
            className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow space-y-3 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {client.avatarUrl ? (
                  <img
                    src={client.avatarUrl}
                    alt={client.name}
                    className="w-10 h-10 rounded-full object-cover border border-[#c6c6cd]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#131b2e] text-white font-bold text-xs flex items-center justify-center">
                    {client.initials || "CL"}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-sm text-[#191c1e]">{client.name}</h4>
                  <p className="text-xs text-[#45464d]">{client.company}</p>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  client.status === "Ativo"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {client.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#f2f4f6]">
              <div>
                <span className="text-[#76777d] block text-[10px]">Total Gasto</span>
                <span className="font-bold text-[#131b2e]">
                  Kz {client.totalSpent.toLocaleString("pt-BR")}
                </span>
              </div>
              <div>
                <span className="text-[#76777d] block text-[10px]">Telefone</span>
                <span className="font-medium text-[#45464d]">{client.phone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Client Details Modal / Drawer */}
      <ClientProfileModal
        isOpen={Boolean(selectedClient)}
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        conversations={conversations}
        orders={orders}
        quotes={quotes}
        onOpenChatWithClient={onSelectClientForChat}
        onOpenNewQuoteForClient={onOpenNewQuoteForClient}
      />
    </div>
  );
};
