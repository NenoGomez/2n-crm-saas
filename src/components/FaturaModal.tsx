import React from "react";
import { Quote, CompanySettings } from "../types";

interface FaturaModalProps {
  quote: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  companySettings?: CompanySettings;
}

export const FaturaModal: React.FC<FaturaModalProps> = ({
  quote,
  isOpen,
  onClose,
  companySettings,
}) => {
  if (!isOpen || !quote) return null;

  const handlePrint = () => {
    window.print();
  };

  // Fallback defaults if companySettings is not yet loaded
  const company = companySettings || {
    commercialName: "2N Publicidade",
    corporateName: "2N Publicidade & Comunicação Visão Lda",
    nif: "5417098231",
    taxPayerNumber: "5417098231",
    logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
    phone: "+244 923 112 233",
    whatsapp: "+244 923 112 233",
    email: "geral@2npublicidade.co.ao",
    website: "www.2npublicidade.co.ao",
    googleMapsUrl: "",
    address: "Avenida Lenine, Edifício Sky Center, 5º Andar",
    city: "Luanda",
    province: "Luanda",
    country: "Angola",
    bankName: "Banco BAI (Banco Angolano de Investimentos)",
    accountHolder: "2N Publicidade & Comunicação Lda",
    iban: "AO06 0040 0000 1234 5678 9012 3",
    accountNumber: "123456789.10.001",
    agencyNumber: "0040 - Luanda Centro",
    swiftBic: "BAIAAO31",
    defaultCurrency: "Kz",
    numberFormat: "pt-AO",
    taxExemptionReason: "Isento de IVA nos termos do Artigo 12.º do CIVA",
    documentHeaderNote: "Agência de Comunicação Estratégica, Design de Performance & Mídia Impressa",
    documentFooterNote: "2N Publicidade Lda • Processado por computador / NIF: 5417098231",
    termsAndConditions: "1. Propostas válidas por 15 dias. Pagamento de 50% na adjudicação.",
    signatureTitle: "A Direção Comercial - 2N Publicidade",
    defaultObservations: "",
    language: "pt",
    timezone: "WAT",
    hermesAutoReply: true,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Top Actions Bar (Non-printable) */}
        <div className="bg-[#131b2e] text-white px-6 py-3.5 flex items-center justify-between print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6ffbbe]">receipt_long</span>
            <span className="font-bold text-sm">Visualização de Fatura / Proposta Oficial</span>
            <span className="text-xs text-slate-300">({quote.code})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-[#009668] hover:bg-[#007c57] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Imprimir / Exportar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer ml-2"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-[#191c1e] bg-white print:p-0 print:overflow-visible">
          {/* Header Banner - Single Source of Truth */}
          <div className="bg-[#131b2e] text-white p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row justify-between items-start gap-6 border border-slate-800 shadow-md">
            <div className="flex items-start gap-4">
              {company.logoUrl ? (
                <div className="w-20 h-20 bg-white rounded-xl p-2 flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
                  <img
                    src={company.logoUrl}
                    alt={company.commercialName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-emerald-500 text-slate-900 font-black rounded-xl flex items-center justify-center text-xl shrink-0">
                  {company.commercialName.substring(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-0.5">
                  {company.commercialName}
                </h1>
                <p className="text-[11px] font-semibold text-slate-300 mb-1">
                  {company.corporateName}
                </p>
                <p className="text-xs text-[#9ea3b5] leading-relaxed max-w-md">
                  {company.documentHeaderNote && (
                    <span className="block italic text-slate-300 mb-1">
                      {company.documentHeaderNote}
                    </span>
                  )}
                  {company.address}, {company.city}, {company.province} - {company.country}
                  <br />
                  <strong>NIF:</strong> {company.nif} • <strong>Tel:</strong> {company.phone}
                  <br />
                  <strong>Email:</strong> {company.email} • <strong>Web:</strong> {company.website}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <h2 className="text-lg font-bold text-emerald-400 mb-2 uppercase tracking-wide">
                FATURA / PROPOSTA
              </h2>
              <div className="space-y-1 text-xs text-[#9ea3b5]">
                <p>
                  <span className="font-semibold text-slate-300">Nº Fatura:</span>{" "}
                  <strong className="text-white font-mono">{quote.code}</strong>
                </p>
                <p>
                  <span className="font-semibold text-slate-300">Data Emissão:</span>{" "}
                  <span className="text-white">{quote.date}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-300">Vencimento:</span>{" "}
                  <span className="text-white">{quote.dueDate}</span>
                </p>
                <p className="pt-1">
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                    Moeda: {company.defaultCurrency} (Kwanza)
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Client & Billing Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 bg-[#f8fafc] rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">person</span>
                <span>Faturar a (Cliente):</span>
              </p>
              <h3 className="font-bold text-sm text-[#191c1e]">{quote.clientName}</h3>
              <p className="text-slate-600 font-medium">{quote.company}</p>
              {quote.nif && (
                <p className="text-slate-500 font-mono mt-0.5">NIF / NUIT: {quote.nif}</p>
              )}
            </div>

            <div className="text-left sm:text-right space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-end gap-1">
                <span className="material-symbols-outlined text-xs">info</span>
                <span>Contactos & Condições de Fornecimento:</span>
              </p>
              <p className="text-slate-600">{quote.email || "geral@cliente.co.ao"}</p>
              <p className="text-slate-600">{quote.phone || "+244 923 000 000"}</p>
              <p className="text-[#131b2e] font-bold pt-1">
                Condições: {quote.paymentTerms || "50% Adjudicação / 50% Entrega"}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Descrição do Produto / Serviço</th>
                  <th className="py-3 px-4 text-center w-16">Qtd.</th>
                  <th className="py-3 px-4 text-center w-20">Unidade</th>
                  <th className="py-3 px-4 text-right w-28">Preço Unit. ({company.defaultCurrency})</th>
                  <th className="py-3 px-4 text-right w-28">Total ({company.defaultCurrency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quote.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#191c1e]">{item.product}</p>
                      <p className="text-[11px] text-slate-500">{item.description}</p>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{item.quantity}</td>
                    <td className="py-3 px-4 text-center text-slate-500">{item.unit}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {item.unitPrice.toLocaleString("pt-BR")} {company.defaultCurrency}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#131b2e]">
                      {item.total.toLocaleString("pt-BR")} {company.defaultCurrency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Tax Note */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="text-xs text-slate-500 max-w-sm space-y-1 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
              <span className="font-bold text-amber-900 block text-[11px]">Enquadramento Fiscal:</span>
              <p className="text-[11px] text-amber-800">{company.taxExemptionReason}</p>
            </div>

            <div className="w-full sm:w-80 bg-[#f8fafc] p-4 rounded-xl border border-slate-200 space-y-2 text-xs shrink-0">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-[#191c1e]">
                  {quote.subtotal.toLocaleString("pt-BR")} {company.defaultCurrency}
                </span>
              </div>
              {quote.discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto Aplicado:</span>
                  <span className="font-semibold">
                    - {quote.discountTotal.toLocaleString("pt-BR")} {company.defaultCurrency}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>IVA (14%):</span>
                <span className="font-semibold text-[#191c1e]">
                  {quote.taxIva.toLocaleString("pt-BR")} {company.defaultCurrency}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-300 flex justify-between text-sm font-extrabold text-[#131b2e]">
                <span>Total a Pagar:</span>
                <span className="text-[#009668] text-base font-black">
                  {quote.totalGeral.toLocaleString("pt-BR")} {company.defaultCurrency}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Instructions (Dynamic Single Source of Truth) */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <h4 className="font-bold text-[#191c1e] flex items-center gap-1.5 text-xs">
                <span className="material-symbols-outlined text-base text-[#131b2e]">
                  account_balance
                </span>
                <span>Dados Oficiais para Pagamento Bancário</span>
              </h4>
              <p className="text-slate-500 text-[11px]">
                Efetue a transferência bancária para uma das contas abaixo e indique a referência{" "}
                <strong className="text-slate-900 font-mono">{quote.code}</strong> no descritivo.
              </p>

              {/* Main Bank Account Box */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1 shadow-2xs">
                <p className="font-bold font-sans text-xs text-[#131b2e] border-b border-slate-100 pb-1">
                  {company.bankName}
                </p>
                <p>
                  <span className="text-slate-400">Titular:</span>{" "}
                  <strong>{company.accountHolder}</strong>
                </p>
                <p>
                  <span className="text-slate-400">IBAN:</span>{" "}
                  <strong className="text-blue-700">{company.iban}</strong>
                </p>
                {company.accountNumber && (
                  <p>
                    <span className="text-slate-400">Nº Conta:</span> {company.accountNumber}
                  </p>
                )}
                {company.swiftBic && (
                  <p>
                    <span className="text-slate-400">SWIFT/BIC:</span> {company.swiftBic}
                  </p>
                )}
              </div>

              {/* Secondary Bank Account Box if configured */}
              {company.secondaryBankName && company.secondaryIban && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
                  <p className="font-bold font-sans text-xs text-slate-700 border-b border-slate-100 pb-1">
                    {company.secondaryBankName} (Conta Alternativa)
                  </p>
                  <p>
                    <span className="text-slate-400">IBAN:</span>{" "}
                    <strong className="text-slate-800">{company.secondaryIban}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Terms, Conditions & Official Signature */}
            <div className="flex flex-col justify-between space-y-4">
              <div>
                <h4 className="font-bold text-[#191c1e] text-xs mb-1">Termos & Condições:</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 max-h-32 overflow-y-auto">
                  {company.termsAndConditions}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 text-right space-y-2">
                <p className="text-xs font-bold text-[#191c1e]">{company.signatureTitle}</p>
                <p className="text-[10px] font-mono text-slate-400">
                  {company.documentFooterNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
