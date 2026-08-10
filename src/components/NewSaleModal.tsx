import React, { useState } from "react";
import { DealCard, PipelineStage, PriorityLevel } from "../types";

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDeal: (deal: DealCard) => void;
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({ isOpen, onClose, onAddDeal }) => {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [service, setService] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("450000");
  const [stage, setStage] = useState<PipelineStage>("NOVO");
  const [priority, setPriority] = useState<PriorityLevel>("Alta");
  const [assigneeInitials, setAssigneeInitials] = useState("RM");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !company.trim()) return;

    const newDeal: DealCard = {
      id: `deal-${Date.now()}`,
      title,
      company,
      service: service || "Serviço Publicitário",
      estimatedValue: Number(estimatedValue) || 0,
      stage,
      priority,
      assigneeInitials: assigneeInitials.toUpperCase(),
      createdAt: "Agora",
      isHermesQualified: true,
    };

    onAddDeal(newDeal);
    onClose();
    setTitle("");
    setCompany("");
    setService("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#c6c6cd]/50 overflow-hidden text-[#191c1e]">
        <div className="px-6 py-4 bg-[#131b2e] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4edea3]">payments</span>
            <h3 className="font-bold text-base">Nova Venda / Negócio</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#45464d] mb-1">
              Nome do Projeto / Negócio *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Campanha Mídia OOH Q4"
              className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">
                Empresa / Cliente *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Banco BCA"
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">
                Valor Estimado (Kz)
              </label>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="450000"
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#45464d] mb-1">
              Descrição do Serviço
            </label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Ex: Painéis Publicitários & Mídia Digital"
              className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Etapa</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as PipelineStage)}
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e] bg-white"
              >
                <option value="NOVO">NOVO</option>
                <option value="CONTACTADO">CONTACTADO</option>
                <option value="ORÇAMENTO">ORÇAMENTO</option>
                <option value="NEGOCIAÇÃO">NEGOCIAÇÃO</option>
                <option value="APROVADO">APROVADO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e] bg-white"
              >
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Resp. (Iniciais)</label>
              <input
                type="text"
                value={assigneeInitials}
                onChange={(e) => setAssigneeInitials(e.target.value)}
                maxLength={3}
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e] uppercase"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#f2f4f6]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#45464d] hover:bg-[#f2f4f6] rounded-lg font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold rounded-lg text-sm transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <span>Salvar Venda</span>
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
