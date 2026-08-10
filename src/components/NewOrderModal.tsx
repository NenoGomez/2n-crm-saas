import React, { useState } from "react";
import { ProductionOrder, ProductionStage } from "../types";

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddOrder: (order: ProductionOrder) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onAddOrder,
}) => {
  const [clientName, setClientName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [stage, setStage] = useState<ProductionStage>("PEDIDO");
  const [dueDate, setDueDate] = useState("Amanhã 17:00");
  const [statusBadge, setStatusBadge] = useState<"NORMAL" | "URGENTE" | "ATRASADO">("NORMAL");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !productDescription.trim()) return;

    const newOrder: ProductionOrder = {
      id: `#ORD-${Math.floor(100 + Math.random() * 900)}`,
      clientName,
      productDescription,
      stage,
      dueDate,
      statusBadge,
      createdAt: "Agora",
    };

    onAddOrder(newOrder);
    onClose();
    setClientName("");
    setProductDescription("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#c6c6cd]/50 overflow-hidden text-[#191c1e]">
        <div className="px-6 py-4 bg-[#131b2e] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4edea3]">precision_manufacturing</span>
            <h3 className="font-bold text-base">Novo Pedido de Produção</h3>
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
              Cliente / Empresa *
            </label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: Shopping Palladium"
              className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#45464d] mb-1">
              Descrição do Produto / Gráfica *
            </label>
            <input
              type="text"
              required
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Ex: Banner Lona 440g (10x) - 2x1m"
              className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Etapa Inicial</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as ProductionStage)}
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e] bg-white"
              >
                <option value="PEDIDO">PEDIDO</option>
                <option value="ARTE">ARTE</option>
                <option value="APROVAÇÃO">APROVAÇÃO</option>
                <option value="IMPRESSÃO">IMPRESSÃO</option>
                <option value="ENTREGA">ENTREGA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Status Urgência</label>
              <select
                value={statusBadge}
                onChange={(e) => setStatusBadge(e.target.value as "NORMAL" | "URGENTE" | "ATRASADO")}
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e] bg-white"
              >
                <option value="NORMAL">NORMAL</option>
                <option value="URGENTE">URGENTE</option>
                <option value="ATRASADO">ATRASADO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Prazo de Entrega</label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Amanhã 17:00"
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
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
              <span>Criar Ordem de Produção</span>
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
