import React, { useState } from "react";
import { DealCard, PipelineStage } from "../types";

interface PipelineViewProps {
  deals: DealCard[];
  setDeals: React.Dispatch<React.SetStateAction<DealCard[]>>;
  onOpenNewSale: () => void;
  onOpenHermes: () => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  deals,
  setDeals,
  onOpenNewSale,
  onOpenHermes,
}) => {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("Todos");
  const [priorityFilter, setPriorityFilter] = useState("Todos");
  const [hermesOnlyFilter, setHermesOnlyFilter] = useState(false);

  const stages: PipelineStage[] = ["NOVO", "CONTACTADO", "ORÇAMENTO", "NEGOCIAÇÃO", "APROVADO"];

  // Unique list of assignees for the filter
  const uniqueAssignees = Array.from(
    new Set(deals.map((d) => d.assigneeInitials).filter(Boolean))
  );

  const filteredDeals = deals.filter((d) => {
    const matchesSearch =
      searchQuery === "" ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.clientName && d.clientName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAssignee =
      assigneeFilter === "Todos" || d.assigneeInitials === assigneeFilter;

    const matchesPriority =
      priorityFilter === "Todos" || d.priority === priorityFilter;

    const matchesHermes = !hermesOnlyFilter || d.isHermesQualified;

    return matchesSearch && matchesAssignee && matchesPriority && matchesHermes;
  });

  const stageColorMap: Record<PipelineStage, string> = {
    NOVO: "border-blue-500 bg-blue-50 text-blue-900",
    CONTACTADO: "border-purple-500 bg-purple-50 text-purple-900",
    ORÇAMENTO: "border-amber-500 bg-amber-50 text-amber-900",
    NEGOCIAÇÃO: "border-orange-500 bg-orange-50 text-orange-900",
    APROVADO: "border-emerald-500 bg-emerald-50 text-emerald-900",
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCardId(id);
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedCardId;
    if (!id) return;

    setDeals((prev) =>
      prev.map((card) => (card.id === id ? { ...card, stage: targetStage } : card))
    );
    setDraggedCardId(null);
  };

  const moveCard = (id: string, nextStage: PipelineStage) => {
    setDeals((prev) =>
      prev.map((card) => (card.id === id ? { ...card, stage: nextStage } : card))
    );
  };

  const totalValue = deals.reduce((acc, d) => acc + d.estimatedValue, 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner & KPI Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e]">Pipeline de Vendas (Kanban)</h2>
          <p className="text-xs text-[#45464d]">
            Gestão visual de negócios da 2N Publicidade com qualificação automática por Hermes AI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenHermes}
            className="bg-[#ECFDF5] hover:bg-[#d0fbe3] text-[#005236] font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-[#6ffbbe]/40 cursor-pointer hermes-glow"
          >
            <span className="material-symbols-outlined text-sm text-[#009668] animate-pulse">
              auto_awesome
            </span>
            <span>Otimizar com IA</span>
          </button>
          <button
            onClick={onOpenNewSale}
            className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Novo Negócio</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#45464d] block">Pipeline Total</span>
            <span className="text-xl font-bold text-[#191c1e]">
              Kz {totalValue.toLocaleString("pt-BR")}
            </span>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
            +12% vs mês anterior
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#45464d] block">Negócios Ativos</span>
            <span className="text-xl font-bold text-[#191c1e]">{deals.length}</span>
          </div>
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
            8 aguardando retorno
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#45464d] block">Taxa de Conversão</span>
            <span className="text-xl font-bold text-[#191c1e]">28.4%</span>
          </div>
          <span className="text-xs font-bold text-[#009668] bg-[#ECFDF5] px-2 py-1 rounded-lg border border-[#6ffbbe]/40">
            Hermes AI Otimizado
          </span>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#76777d] text-base">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, empresa, serviço ou cliente..."
            className="w-full pl-9 pr-3 py-2 bg-[#f2f4f6] border border-[#c6c6cd]/40 rounded-xl text-xs text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#131b2e]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Selectors Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Assignee Filter */}
          <div className="flex items-center gap-1.5 bg-[#f2f4f6] px-3 py-1.5 rounded-xl border border-[#c6c6cd]/40">
            <span className="material-symbols-outlined text-sm text-[#45464d]">person</span>
            <span className="font-semibold text-[#45464d]">Responsável:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="bg-transparent font-bold text-[#191c1e] outline-none cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {uniqueAssignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 bg-[#f2f4f6] px-3 py-1.5 rounded-xl border border-[#c6c6cd]/40">
            <span className="material-symbols-outlined text-sm text-[#45464d]">priority_high</span>
            <span className="font-semibold text-[#45464d]">Prioridade:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent font-bold text-[#191c1e] outline-none cursor-pointer"
            >
              <option value="Todos">Todas</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>

          {/* Hermes AI Qualified Toggle */}
          <button
            onClick={() => setHermesOnlyFilter(!hermesOnlyFilter)}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              hermesOnlyFilter
                ? "bg-[#009668] text-white border-[#009668]"
                : "bg-[#ECFDF5] text-[#005236] border-[#6ffbbe]/50 hover:bg-[#d0fbe3]"
            }`}
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span>Qualificados IA</span>
          </button>

          {/* Clear Filters Button */}
          {(searchQuery || assigneeFilter !== "Todos" || priorityFilter !== "Todos" || hermesOnlyFilter) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setAssigneeFilter("Todos");
                setPriorityFilter("Todos");
                setHermesOnlyFilter(false);
              }}
              className="text-xs text-red-600 font-bold hover:underline px-2 py-1 cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {stages.map((stg) => {
          const stageDeals = filteredDeals.filter((d) => d.stage === stg);
          const stageTotal = stageDeals.reduce((sum, d) => sum + d.estimatedValue, 0);

          return (
            <div
              key={stg}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stg)}
              className="bg-[#f2f4f6]/80 rounded-2xl p-3 border border-[#c6c6cd]/30 min-w-[240px] flex flex-col h-[650px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageColorMap[stg]}`}
                  >
                    {stg}
                  </span>
                  <span className="text-xs font-bold text-[#191c1e]">{stageDeals.length}</span>
                </div>
                <button
                  onClick={onOpenNewSale}
                  className="text-[#45464d] hover:text-[#191c1e] p-1 rounded-md transition-colors cursor-pointer"
                  title="Adicionar negócio nesta etapa"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>

              {/* Stage Total Value */}
              <div className="text-[11px] font-semibold text-[#76777d] px-1 mb-3">
                Kz {stageTotal.toLocaleString("pt-BR")}
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {stageDeals.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    className="bg-white p-3.5 rounded-xl border border-[#c6c6cd]/50 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2 relative group"
                  >
                    {/* Card Top Row */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {card.company}
                      </span>

                      {/* Priority Tag */}
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                          card.priority === "Alta"
                            ? "bg-red-100 text-red-800"
                            : card.priority === "Média"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {card.priority}
                      </span>
                    </div>

                    {/* Card Title & Service */}
                    <h4 className="font-bold text-xs text-[#191c1e] group-hover:text-[#009668] transition-colors">
                      {card.title}
                    </h4>
                    <p className="text-[11px] text-[#45464d] line-clamp-2">{card.service}</p>

                    {/* Hermes Qualification Badge */}
                    {card.isHermesQualified && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#009668] bg-[#ECFDF5] px-2 py-0.5 rounded-md border border-[#6ffbbe]/40">
                        <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                        Qualificado por IA
                      </div>
                    )}

                    {/* Value & Assignee Footer */}
                    <div className="pt-2 border-t border-[#f2f4f6] flex items-center justify-between text-xs">
                      <span className="font-bold text-[#131b2e]">
                        Kz {card.estimatedValue.toLocaleString("pt-BR")}
                      </span>

                      <div className="flex items-center gap-1">
                        <span className="w-6 h-6 rounded-full bg-[#131b2e] text-white font-bold text-[10px] flex items-center justify-center">
                          {card.assigneeInitials}
                        </span>

                        {/* Move card drop menu */}
                        <select
                          value={card.stage}
                          onChange={(e) => moveCard(card.id, e.target.value as PipelineStage)}
                          className="text-[10px] bg-slate-100 border border-slate-300 rounded px-1 py-0.5 cursor-pointer text-slate-700 font-medium"
                        >
                          {stages.map((s) => (
                            <option key={s} value={s}>
                              Mover p/ {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className="border-2 border-dashed border-[#c6c6cd]/50 rounded-xl p-6 text-center text-xs text-[#76777d]">
                    Nenhum negócio nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
