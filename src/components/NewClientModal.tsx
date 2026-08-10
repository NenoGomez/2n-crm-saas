import React, { useState } from "react";
import { Client } from "../types";

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClient: (client: Client) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onAddClient,
}) => {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("+244 923 000 000");
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState("Corporativo");
  const [isVip, setIsVip] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) return;

    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      name,
      company,
      phone,
      email: email || `${name.toLowerCase().replace(/\s+/g, ".")}@${company.toLowerCase().replace(/\s+/g, "")}.co.ao`,
      segment,
      lastPurchase: "Hoje",
      totalSpent: 0,
      ordersCount: 1,
      manager: "Nino",
      status: "Ativo",
      isVip,
      initials,
    };

    onAddClient(newClient);
    onClose();
    setName("");
    setCompany("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#c6c6cd]/50 overflow-hidden text-[#191c1e]">
        <div className="px-6 py-4 bg-[#131b2e] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4edea3]">person_add</span>
            <h3 className="font-bold text-base">Novo Cliente</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">
                Nome do Responsável *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Empresa *</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Moda & Co."
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Telefone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+244 923 000 000"
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#45464d] mb-1">Segmento</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e] bg-white"
              >
                <option value="Corporativo">Corporativo</option>
                <option value="Eventos & Mídia">Eventos & Mídia</option>
                <option value="Varejo & Moda">Varejo & Moda</option>
                <option value="Arquitetura & Design">Arquitetura & Design</option>
                <option value="Tecnologia">Tecnologia</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#45464d] mb-1">E-mail Corporativo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@empresa.co.ao"
              className="w-full px-3 py-2 border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#131b2e]"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="vipCheck"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="w-4 h-4 text-[#131b2e] rounded border-[#c6c6cd] focus:ring-[#131b2e]"
            />
            <label htmlFor="vipCheck" className="text-sm font-semibold text-[#191c1e] cursor-pointer">
              Marcar como Cliente VIP ★
            </label>
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
              <span>Cadastrar Cliente</span>
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
