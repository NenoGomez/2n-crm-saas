import React, { useState } from "react";
import { CompanySettings } from "../types";

interface ConfiguracoesViewProps {
  companySettings: CompanySettings;
  setCompanySettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  companySettings,
  setCompanySettings,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    "empresa" | "financeiro" | "documentos" | "sistema"
  >("empresa");

  // Local state initialized with current global companySettings
  const [formData, setFormData] = useState<CompanySettings>(companySettings);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [logoValidationError, setLogoValidationError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const handleInputChange = (
    field: keyof CompanySettings,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySettings(formData);
    setToastMessage(
      "✅ Dados da empresa atualizados com sucesso! Todas as faturas, orçamentos e recibos utilizarão automaticamente estes dados centralizados."
    );
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handle Logo Upload & Validation
  const handleLogoFile = (file: File) => {
    setLogoValidationError(null);
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    
    if (!validTypes.includes(file.type)) {
      setLogoValidationError(
        "Formato de imagem não suportado. Por favor utilize PNG, JPG, WEBP ou SVG."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoValidationError(
        "O ficheiro excede 5MB. A imagem será otimizada automaticamente para alta resolução em PDF."
      );
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFormData((prev) => ({
        ...prev,
        logoUrl: result,
        logoFilename: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({
      ...prev,
      logoUrl: undefined,
      logoFilename: undefined,
    }));
    setLogoValidationError(null);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="p-4 bg-[#ECFDF5] border border-[#6ffbbe] text-[#005236] rounded-2xl font-bold text-xs flex items-center justify-between shadow-lg animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-xl text-[#009668]">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[#005236] hover:opacity-75 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e] flex items-center gap-2">
            <span>Configurações — Dados da Empresa</span>
            <span className="text-[10px] font-mono font-bold bg-[#131b2e] text-white px-2 py-0.5 rounded-full">
              Single Source of Truth
            </span>
          </h2>
          <p className="text-xs text-[#45464d] mt-0.5">
            Cadastre as informações oficiais da sua empresa. Estes dados alimentarão automaticamente faturas, proformas, orçamentos e recibos do CRM.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-base">save</span>
          <span>Salvar Alterações</span>
        </button>
      </div>

      {/* Navigation Category Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-[#c6c6cd]/40 text-xs level-1-shadow overflow-x-auto gap-1">
        <button
          onClick={() => setActiveCategory("empresa")}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeCategory === "empresa"
              ? "bg-[#131b2e] text-white shadow-xs"
              : "text-[#45464d] hover:bg-slate-100"
          }`}
        >
          <span className="material-symbols-outlined text-base">domain</span>
          <span>Empresa & Identificação</span>
        </button>

        <button
          onClick={() => setActiveCategory("financeiro")}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeCategory === "financeiro"
              ? "bg-[#131b2e] text-white shadow-xs"
              : "text-[#45464d] hover:bg-slate-100"
          }`}
        >
          <span className="material-symbols-outlined text-base">account_balance</span>
          <span>Financeiro & Dados Bancários</span>
        </button>

        <button
          onClick={() => setActiveCategory("documentos")}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeCategory === "documentos"
              ? "bg-[#131b2e] text-white shadow-xs"
              : "text-[#45464d] hover:bg-slate-100"
          }`}
        >
          <span className="material-symbols-outlined text-base">description</span>
          <span>Configuração de Documentos</span>
        </button>

        <button
          onClick={() => setActiveCategory("sistema")}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeCategory === "sistema"
              ? "bg-[#131b2e] text-white shadow-xs"
              : "text-[#45464d] hover:bg-slate-100"
          }`}
        >
          <span className="material-symbols-outlined text-base">settings</span>
          <span>Sistema & Preferências</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* CATEGORY 1: EMPRESA */}
        {activeCategory === "empresa" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Logo Upload Box */}
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <div className="flex items-center justify-between border-b border-[#f2f4f6] pb-3">
                <div>
                  <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#131b2e]">
                      photo_library
                    </span>
                    <span>Logótipo Oficial da Empresa</span>
                  </h3>
                  <p className="text-xs text-[#76777d]">
                    O logótipo será impresso no topo de todas as faturas, proformas e orçamentos em alta qualidade.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                  Formatos: PNG, JPG, WEBP, SVG
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Logo Preview Box */}
                <div className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-3 min-h-[160px]">
                  {formData.logoUrl ? (
                    <div className="space-y-2">
                      <div className="w-36 h-24 bg-white rounded-xl p-2 border border-slate-200 flex items-center justify-center shadow-xs mx-auto">
                        <img
                          src={formData.logoUrl}
                          alt="Logo da Empresa"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 truncate max-w-[180px]">
                        {formData.logoFilename || "logo-empresa"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-3xl">image</span>
                      </div>
                      <p className="text-xs font-bold text-slate-500">Sem Logótipo Definido</p>
                      <p className="text-[10px] text-slate-400">Será exibido o nome em texto</p>
                    </div>
                  )}
                </div>

                {/* Upload & Controls */}
                <div className="md:col-span-2 space-y-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(true);
                    }}
                    onDragLeave={() => setIsDraggingLogo(false)}
                    onDrop={handleLogoDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                      isDraggingLogo
                        ? "border-[#009668] bg-[#ECFDF5]"
                        : "border-slate-300 hover:border-[#131b2e] bg-slate-50/50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl text-slate-400 block mb-1">
                      cloud_upload
                    </span>
                    <p className="text-xs font-bold text-[#191c1e]">
                      Arraste e solte o ficheiro do logótipo aqui
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ou clique no botão abaixo para selecionar do computador
                    </p>

                    <label className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs">
                      <span className="material-symbols-outlined text-sm">upload_file</span>
                      <span>Carregar Ficheiro</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp, image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleLogoFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {formData.logoUrl && (
                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs font-bold text-blue-700 hover:underline cursor-pointer flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">sync</span>
                        <span>Substituir logótipo</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleLogoFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>

                      <span className="text-slate-300">•</span>

                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span>Remover logótipo</span>
                      </button>
                    </div>
                  )}

                  {logoValidationError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                      ⚠️ {logoValidationError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Informações Gerais */}
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <h3 className="font-bold text-sm text-[#191c1e] border-b border-[#f2f4f6] pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#131b2e]">badge</span>
                <span>Informações Gerais & Identificação Oficial</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Nome Comercial / Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.commercialName}
                    onChange={(e) => handleInputChange("commercialName", e.target.value)}
                    placeholder="Ex: 2N Publicidade"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Razão Social Oficial *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.corporateName}
                    onChange={(e) => handleInputChange("corporateName", e.target.value)}
                    placeholder="Ex: 2N Publicidade & Comunicação Lda"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    NIF (Número de Identificação Fiscal) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nif}
                    onChange={(e) => handleInputChange("nif", e.target.value)}
                    placeholder="Ex: 5417098231"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-mono font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Número de Contribuinte
                  </label>
                  <input
                    type="text"
                    value={formData.taxPayerNumber}
                    onChange={(e) => handleInputChange("taxPayerNumber", e.target.value)}
                    placeholder="Ex: 5417098231"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-mono text-[#191c1e]"
                  />
                </div>
              </div>
            </div>

            {/* Endereço & Localização */}
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <h3 className="font-bold text-sm text-[#191c1e] border-b border-[#f2f4f6] pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#131b2e]">
                  location_on
                </span>
                <span>Endereço & Localização</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-[#191c1e] mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="Ex: Avenida Lenine, Edifício Sky Center, 5º Andar"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Cidade / Município</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="Ex: Luanda"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Província</label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => handleInputChange("province", e.target.value)}
                    placeholder="Ex: Luanda"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">País</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleInputChange("country", e.target.value)}
                    placeholder="Ex: Angola"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Link do Google Maps / Localização
                  </label>
                  <input
                    type="url"
                    value={formData.googleMapsUrl}
                    onChange={(e) => handleInputChange("googleMapsUrl", e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>
              </div>
            </div>

            {/* Contactos */}
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <h3 className="font-bold text-sm text-[#191c1e] border-b border-[#f2f4f6] pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#131b2e]">call</span>
                <span>Contactos Oficiais & Canais Digitais</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Telefone Principal</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="Ex: +244 923 112 233"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">WhatsApp Comercial</label>
                  <input
                    type="text"
                    value={formData.whatsapp}
                    onChange={(e) => handleInputChange("whatsapp", e.target.value)}
                    placeholder="Ex: +244 923 112 233"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Email Geral / Comercial</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="Ex: geral@2npublicidade.co.ao"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Website Oficial</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => handleInputChange("website", e.target.value)}
                    placeholder="Ex: www.2npublicidade.co.ao"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY 2: FINANCEIRO */}
        {activeCategory === "financeiro" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Banco Principal */}
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <div className="flex items-center justify-between border-b border-[#f2f4f6] pb-2">
                <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-[#009668]">
                    account_balance
                  </span>
                  <span>Dados Bancários Principais (Utilizado em Faturas e Proformas)</span>
                </h3>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Conta Principal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Nome do Banco *</label>
                  <input
                    type="text"
                    required
                    value={formData.bankName}
                    onChange={(e) => handleInputChange("bankName", e.target.value)}
                    placeholder="Ex: Banco BAI (Banco Angolano de Investimentos)"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Titular da Conta *</label>
                  <input
                    type="text"
                    required
                    value={formData.accountHolder}
                    onChange={(e) => handleInputChange("accountHolder", e.target.value)}
                    placeholder="Ex: 2N Publicidade Lda"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    IBAN (International Bank Account Number) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.iban}
                    onChange={(e) => handleInputChange("iban", e.target.value)}
                    placeholder="Ex: AO06 0040 0000 1234 5678 9012 3"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-mono font-bold text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Número da Conta</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                    placeholder="Ex: 123456789.10.001"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-mono text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Agência / Agência Nº</label>
                  <input
                    type="text"
                    value={formData.agencyNumber}
                    onChange={(e) => handleInputChange("agencyNumber", e.target.value)}
                    placeholder="Ex: 0040 - Luanda Centro"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Código SWIFT / BIC</label>
                  <input
                    type="text"
                    value={formData.swiftBic}
                    onChange={(e) => handleInputChange("swiftBic", e.target.value)}
                    placeholder="Ex: BAIAAO31"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-mono text-[#191c1e]"
                  />
                </div>
              </div>
            </div>

            {/* Banco Secundário */}
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <div className="flex items-center justify-between border-b border-[#f2f4f6] pb-2">
                <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-blue-600">
                    credit_card
                  </span>
                  <span>Dados Bancários Secundários / Alternativos (Opcional)</span>
                </h3>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                  Conta Adicional
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Nome do Banco Secundário</label>
                  <input
                    type="text"
                    value={formData.secondaryBankName || ""}
                    onChange={(e) => handleInputChange("secondaryBankName", e.target.value)}
                    placeholder="Ex: Banco BFA (Banco de Fomento Angola)"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">IBAN Secundário</label>
                  <input
                    type="text"
                    value={formData.secondaryIban || ""}
                    onChange={(e) => handleInputChange("secondaryIban", e.target.value)}
                    placeholder="Ex: AO06 0006 0000 9876 5432 1012 4"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-mono text-[#191c1e]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY 3: DOCUMENTOS */}
        {activeCategory === "documentos" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <h3 className="font-bold text-sm text-[#191c1e] border-b border-[#f2f4f6] pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#131b2e]">
                  receipt_long
                </span>
                <span>Parâmetros Padrão de Faturas, Proformas, Orçamentos e Recibos</span>
              </h3>

              <div className="grid grid-cols-1 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Cabeçalho Padrão do Documento (Abaixo do Nome da Empresa)
                  </label>
                  <input
                    type="text"
                    value={formData.documentHeaderNote}
                    onChange={(e) => handleInputChange("documentHeaderNote", e.target.value)}
                    placeholder="Ex: Agência de Comunicação Estratégica, Design de Performance e Impressão de Grandes Formatos"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Isenção de IVA / Enquadramento Fiscal
                  </label>
                  <input
                    type="text"
                    value={formData.taxExemptionReason}
                    onChange={(e) => handleInputChange("taxExemptionReason", e.target.value)}
                    placeholder="Ex: Isento de IVA nos termos da alínea e) do nº 1 do Artigo 12.º do CIVA"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Termos e Condições Padrão
                  </label>
                  <textarea
                    rows={3}
                    value={formData.termsAndConditions}
                    onChange={(e) => handleInputChange("termsAndConditions", e.target.value)}
                    placeholder="Escreva os termos de garantia, prazos de pagamento e validade das propostas..."
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e] leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Rodapé Padrão dos Documentos (Impressão no fim da folha)
                  </label>
                  <input
                    type="text"
                    value={formData.documentFooterNote}
                    onChange={(e) => handleInputChange("documentFooterNote", e.target.value)}
                    placeholder="Ex: 2N Publicidade Lda • Processado por computador / NIF: 5417098231"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">
                    Assinatura Padrão / Responsável Comercial
                  </label>
                  <input
                    type="text"
                    value={formData.signatureTitle}
                    onChange={(e) => handleInputChange("signatureTitle", e.target.value)}
                    placeholder="Ex: A Direção Comercial - 2N Publicidade"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>
              </div>
            </div>

            {/* Real-time Preview Card */}
            <div className="bg-[#131b2e] text-white p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <span className="font-bold text-xs flex items-center gap-2 text-[#6ffbbe]">
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>Pré-visualização em Tempo Real do Cabeçalho e Rodapé dos Documentos</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">PDF / A4 Layout</span>
              </div>

              {/* Simulated Document Header */}
              <div className="bg-white text-slate-900 p-5 rounded-xl space-y-4 font-sans text-xs shadow-inner">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-3">
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Logo"
                        className="h-10 max-w-[120px] object-contain"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#131b2e] text-white rounded-lg flex items-center justify-center font-black">
                        2N
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-[#131b2e]">
                        {formData.commercialName || "Sua Empresa"}
                      </h4>
                      <p className="text-[10px] text-slate-500">{formData.documentHeaderNote}</p>
                      <p className="text-[10px] text-slate-500">NIF: {formData.nif}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-xs text-[#131b2e] block">FATURA PROFORMA</span>
                    <span className="text-[10px] font-mono text-slate-400">#FT-2026/001</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[10px] space-y-0.5">
                  <p className="font-bold text-[#131b2e]">DADOS DE PAGAMENTO BANCÁRIO:</p>
                  <p>
                    <strong>Banco:</strong> {formData.bankName}
                  </p>
                  <p>
                    <strong>Titular:</strong> {formData.accountHolder}
                  </p>
                  <p className="font-mono">
                    <strong>IBAN:</strong> {formData.iban}
                  </p>
                </div>

                <div className="pt-2 text-[9px] text-slate-400 border-t border-slate-200 text-center font-mono">
                  {formData.documentFooterNote}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY 4: SISTEMA */}
        {activeCategory === "sistema" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <h3 className="font-bold text-sm text-[#191c1e] border-b border-[#f2f4f6] pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#131b2e]">
                  tune
                </span>
                <span>Moeda, Idioma e Localização do Sistema</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Moeda Padrão</label>
                  <select
                    value={formData.defaultCurrency}
                    onChange={(e) => handleInputChange("defaultCurrency", e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e] bg-white"
                  >
                    <option value="Kz">Kz - Kwanza (Angola)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="USD">USD - Dólar ($)</option>
                    <option value="BRL">BRL - Real (R$)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Idioma do CRM</label>
                  <select
                    value={formData.language}
                    onChange={(e) => handleInputChange("language", e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl font-bold text-[#191c1e] bg-white"
                  >
                    <option value="pt">Português (Angola / Portugal)</option>
                    <option value="en">English (United States)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Fuso Horário</label>
                  <input
                    type="text"
                    value={formData.timezone}
                    onChange={(e) => handleInputChange("timezone", e.target.value)}
                    placeholder="Ex: WAT (UTC+1) - Luanda"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#191c1e] mb-1">Formato Numérico</label>
                  <input
                    type="text"
                    value={formData.numberFormat}
                    onChange={(e) => handleInputChange("numberFormat", e.target.value)}
                    placeholder="Ex: pt-AO (1.250.000,00 Kz)"
                    className="w-full px-3.5 py-2 border border-slate-300 focus:border-[#131b2e] rounded-xl text-[#191c1e]"
                  />
                </div>
              </div>
            </div>

            {/* Hermes AI Preferences */}
            <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
              <h3 className="font-bold text-sm text-[#191c1e] border-b border-[#f2f4f6] pb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#009668]">
                  auto_awesome
                </span>
                <span>Integração e Automação do Hermes AI</span>
              </h3>

              <div className="flex items-center justify-between p-4 bg-[#ECFDF5] border border-[#6ffbbe]/40 rounded-xl text-xs">
                <div>
                  <span className="font-bold text-[#005236] block">
                    Respostas Inteligentes e Gerador de Faturas via IA
                  </span>
                  <span className="text-[11px] text-[#005236]/80">
                    Ativa a utilização automática dos dados da empresa nas respostas sugeridas pelo Hermes AI.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.hermesAutoReply}
                  onChange={(e) => handleInputChange("hermesAutoReply", e.target.checked)}
                  className="w-5 h-5 text-[#009668] rounded border-emerald-300 focus:ring-[#009668]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Button Bar */}
        <div className="pt-4 flex items-center justify-between bg-white p-4 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-xs text-slate-500 font-medium">
            💡 As alterações serão guardadas centralmente e aplicadas instantaneamente a todas as impressões.
          </span>

          <button
            type="submit"
            className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">save</span>
            <span>Salvar Dados da Empresa</span>
          </button>
        </div>
      </form>
    </div>
  );
};
