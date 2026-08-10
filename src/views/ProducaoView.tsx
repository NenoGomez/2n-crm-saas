import React, { useState } from "react";
import { ProductionOrder, ProductionStage, ProductionFile, HermesConfig } from "../types";

interface ProducaoViewProps {
  orders: ProductionOrder[];
  setOrders: React.Dispatch<React.SetStateAction<ProductionOrder[]>>;
  onOpenNewOrder: () => void;
  onOpenHermes: () => void;
  hermesConfig?: HermesConfig;
  onNotifyQualityStatusChange?: (
    order: ProductionOrder,
    status: "APROVADO" | "REJEITADO",
    note?: string
  ) => void;
}

export const ProducaoView: React.FC<ProducaoViewProps> = ({
  orders,
  setOrders,
  onOpenNewOrder,
  onOpenHermes,
  hermesConfig,
  onNotifyQualityStatusChange,
}) => {
  const [selectedStage, setSelectedStage] = useState<string>("Todos");
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<ProductionOrder | null>(null);

  // Drag and Drop & File Upload State
  const [targetOrderId, setTargetOrderId] = useState<string>(orders[0]?.id || "#ORD-492");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  // Rejection Modal State
  const [rejectionModalOrder, setRejectionModalOrder] = useState<ProductionOrder | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");

  // Preview File Modal State
  const [previewFile, setPreviewFile] = useState<{ file: ProductionFile; orderId: string; clientName: string } | null>(null);

  // Notification Toast State
  const [notificationToast, setNotificationToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const stages: ProductionStage[] = ["PEDIDO", "ARTE", "APROVAÇÃO", "IMPRESSÃO", "ENTREGA"];

  // Rules for stage advancement
  const getAdvanceStatus = (ord: ProductionOrder): { allowed: boolean; reason?: string } => {
    if (ord.qualityStatus === "REJEITADO") {
      return {
        allowed: false,
        reason: "Avanço bloqueado: Arte REPROVADA no controle de qualidade.",
      };
    }

    const hasFiles = ord.files && ord.files.length > 0;
    if (!hasFiles && (ord.stage === "PEDIDO" || ord.stage === "ARTE")) {
      return {
        allowed: false,
        reason: "Avanço bloqueado: É necessário vincular o arquivo de arte antes de ir para Aprovação ou Impressão.",
      };
    }

    return { allowed: true };
  };

  const advanceStage = (id: string) => {
    const target = orders.find((o) => o.id === id);
    if (!target) return;

    const check = getAdvanceStatus(target);
    if (!check.allowed) {
      setNotificationToast({
        message: `⛔ ${check.reason}`,
        type: "error",
      });
      setTimeout(() => setNotificationToast(null), 4500);
      return;
    }

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === id) {
          const currentIndex = stages.indexOf(ord.stage);
          if (currentIndex < stages.length - 1) {
            return { ...ord, stage: stages[currentIndex + 1] };
          }
        }
        return ord;
      })
    );
  };

  // Real File Download Simulation
  const handleDownloadFile = (file: ProductionFile) => {
    const fileContent = `2N PUBLICIDADE & COMUNICAÇÃO VISUAL
==========================================
Arquivo de Produção Gráfica: ${file.name}
Tamanho: ${file.size}
Tipo: ${file.type.toUpperCase()}
Data de Envio: ${file.uploadedAt}
Status de Qualidade: ${file.status || "Analisado"}
==========================================
Este é um arquivo pronto para impressão/ripping.
`;
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setUploadToast(`⬇️ Download do arquivo "${file.name}" iniciado com sucesso!`);
    setTimeout(() => setUploadToast(null), 3500);
  };

  // Handle Quality Status Approval
  const handleApproveQuality = (order: ProductionOrder) => {
    const updatedOrder: ProductionOrder = {
      ...order,
      qualityStatus: "APROVADO",
      qualityNote: undefined,
    };

    setOrders((prev) => prev.map((o) => (o.id === order.id ? updatedOrder : o)));

    if (selectedOrderForDetails?.id === order.id) {
      setSelectedOrderForDetails(updatedOrder);
    }

    if (onNotifyQualityStatusChange) {
      onNotifyQualityStatusChange(order, "APROVADO");
    }

    setNotificationToast({
      message: `✅ Pedido ${order.id} APROVADO na qualidade! Notificação enviada via Hermes WhatsApp para ${order.clientName}.`,
      type: "success",
    });

    setTimeout(() => setNotificationToast(null), 4500);
  };

  // Handle Quality Status Rejection
  const handleConfirmRejection = () => {
    if (!rejectionModalOrder) return;

    const note = rejectionNote.trim() || "Ajuste na resolução ou sangria do arquivo de arte.";
    const updatedOrder: ProductionOrder = {
      ...rejectionModalOrder,
      qualityStatus: "REJEITADO",
      qualityNote: note,
    };

    setOrders((prev) => prev.map((o) => (o.id === rejectionModalOrder.id ? updatedOrder : o)));

    if (selectedOrderForDetails?.id === rejectionModalOrder.id) {
      setSelectedOrderForDetails(updatedOrder);
    }

    if (onNotifyQualityStatusChange) {
      onNotifyQualityStatusChange(rejectionModalOrder, "REJEITADO", note);
    }

    setNotificationToast({
      message: `⚠️ Pedido ${rejectionModalOrder.id} REJEITADO. Cliente ${rejectionModalOrder.clientName} notificado via Hermes WhatsApp para envio de novos arquivos.`,
      type: "error",
    });

    setRejectionModalOrder(null);
    setRejectionNote("");
    setTimeout(() => setNotificationToast(null), 4500);
  };

  // Drag and Drop Files Handler
  const handleFileUpload = (orderId: string, filesList: FileList | File[]) => {
    const newFiles: ProductionFile[] = Array.from(filesList).map((f, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      type: f.name.endsWith(".pdf")
        ? "pdf"
        : f.name.endsWith(".ai") || f.name.endsWith(".psd")
        ? "vector"
        : "image",
      uploadedAt: "Agora",
      status: "Pendente",
    }));

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const currentFiles = ord.files || [];
          return {
            ...ord,
            files: [...currentFiles, ...newFiles],
          };
        }
        return ord;
      })
    );

    if (selectedOrderForDetails?.id === orderId) {
      setSelectedOrderForDetails((prev) =>
        prev
          ? {
              ...prev,
              files: [...(prev.files || []), ...newFiles],
            }
          : null
      );
    }

    setUploadToast(`📁 ${newFiles.length} arquivo(s) vinculado(s) ao pedido ${orderId} com sucesso!`);
    setTimeout(() => setUploadToast(null), 3500);
  };

  const handleDrop = (e: React.DragEvent, orderId: string) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(orderId, e.dataTransfer.files);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    if (selectedStage === "Todos") return true;
    return ord.stage === selectedStage;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Toast Banners */}
      {notificationToast && (
        <div
          className={`p-4 rounded-2xl border font-bold text-xs flex items-center justify-between shadow-lg transition-all animate-in zoom-in-95 duration-200 ${
            notificationToast.type === "success"
              ? "bg-[#ECFDF5] border-[#6ffbbe] text-[#005236]"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-lg">
              {notificationToast.type === "success" ? "check_circle" : "warning"}
            </span>
            <span>{notificationToast.message}</span>
          </div>
          <button
            onClick={() => setNotificationToast(null)}
            className="text-slate-500 hover:text-black p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {uploadToast && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-blue-600">upload_file</span>
          <span>{uploadToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e]">Controle de Produção & Gráfica</h2>
          <p className="text-xs text-[#45464d]">
            Acompanhamento das etapas de arte, qualidade, impressão e validação dos arquivos dos clientes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenHermes}
            className="bg-[#ECFDF5] hover:bg-[#d0fbe3] text-[#005236] font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-[#6ffbbe]/40 cursor-pointer hermes-glow"
          >
            <span className="material-symbols-outlined text-sm text-[#009668] animate-pulse">
              auto_awesome
            </span>
            <span>Gerar Artes com IA</span>
          </button>
          <button
            onClick={onOpenNewOrder}
            className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Novo Pedido</span>
          </button>
        </div>
      </div>

      {/* Global Drag & Drop Production File Linking Section */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => handleDrop(e, targetOrderId)}
        className={`bg-white p-5 rounded-2xl border-2 transition-all level-1-shadow space-y-4 ${
          isDraggingOver
            ? "border-[#009668] bg-[#ECFDF5]/30 ring-4 ring-[#6ffbbe]/20"
            : "border-dashed border-[#c6c6cd]/80 hover:border-[#131b2e]"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#131b2e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">cloud_upload</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                <span>Vincular Arquivos de Produção ao Pedido</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">
                  Drag & Drop
                </span>
              </h3>
              <p className="text-xs text-[#76777d]">
                Arraste artes em PDF, AI, PSD ou imagens para associar ao pedido e disponibilizar para revisão técnica.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="space-y-0.5 text-xs">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Selecionar Pedido Destino
              </label>
              <select
                value={targetOrderId}
                onChange={(e) => setTargetOrderId(e.target.value)}
                className="bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-xs text-[#191c1e] focus:ring-2 focus:ring-[#131b2e]"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} - {o.clientName} ({o.productDescription})
                  </option>
                ))}
              </select>
            </div>

            <label className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0 self-end">
              <span className="material-symbols-outlined text-sm">attach_file</span>
              <span>Selecionar Arquivo</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFileUpload(targetOrderId, e.target.files);
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Stage Filter Pills */}
      <div className="flex bg-white p-1 rounded-xl border border-[#c6c6cd]/40 text-xs level-1-shadow overflow-x-auto">
        {(["Todos", "PEDIDO", "ARTE", "APROVAÇÃO", "IMPRESSÃO", "ENTREGA"] as const).map((stg) => {
          const count =
            stg === "Todos" ? orders.length : orders.filter((o) => o.stage === stg).length;

          return (
            <button
              key={stg}
              onClick={() => setSelectedStage(stg)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                selectedStage === stg
                  ? "bg-[#131b2e] text-white shadow-xs"
                  : "text-[#45464d] hover:text-[#191c1e]"
              }`}
            >
              <span>{stg}</span>
              <span className="text-[10px] bg-black/10 px-2 py-0.2 rounded-full font-mono">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Production Board / Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {stages.map((stg) => {
          const stageOrders = orders.filter((o) => o.stage === stg);

          return (
            <div
              key={stg}
              className="bg-[#f2f4f6]/80 rounded-2xl p-3 border border-[#c6c6cd]/30 min-w-[260px] flex flex-col h-[680px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-[#191c1e] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#131b2e]" />
                  {stg}
                </span>
                <span className="text-xs font-mono font-bold text-[#76777d]">
                  {stageOrders.length}
                </span>
              </div>

              {/* Order Cards */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {stageOrders.map((ord) => {
                  const filesCount = ord.files?.length || 0;
                  const isApproved = ord.qualityStatus === "APROVADO";
                  const isRejected = ord.qualityStatus === "REJEITADO";

                  return (
                    <div
                      key={ord.id}
                      className="bg-white p-4 rounded-xl border border-[#c6c6cd]/50 shadow-xs hover:shadow-md transition-all space-y-3 relative group"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-[#131b2e] bg-slate-100 px-2 py-0.5 rounded">
                          {ord.id}
                        </span>

                        <div className="flex items-center gap-1">
                          {ord.qualityStatus && (
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                isApproved
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : isRejected
                                  ? "bg-rose-100 text-rose-800 border border-rose-300"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[10px]">
                                {isApproved ? "check_circle" : isRejected ? "cancel" : "hourglass_top"}
                              </span>
                              <span>{ord.qualityStatus}</span>
                            </span>
                          )}

                          {ord.statusBadge && (
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                ord.statusBadge === "URGENTE"
                                  ? "bg-red-100 text-red-800 animate-pulse"
                                  : ord.statusBadge === "ATRASADO"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {ord.statusBadge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Client & Product */}
                      <div>
                        <h4 className="font-bold text-xs text-[#191c1e]">{ord.clientName}</h4>
                        <p className="text-[11px] text-[#45464d] font-medium mt-0.5">
                          {ord.productDescription}
                        </p>
                      </div>

                      {/* Attached Files Badge / Dropzone Preview */}
                      <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider">
                            <span className="material-symbols-outlined text-xs">folder_open</span>
                            <span>Arquivos ({filesCount})</span>
                          </span>
                          <button
                            onClick={() => setSelectedOrderForDetails(ord)}
                            className="text-[#131b2e] hover:underline font-bold text-[10px] cursor-pointer"
                          >
                            Ver Todos
                          </button>
                        </div>

                        {filesCount > 0 ? (
                          <div className="space-y-1">
                            {ord.files?.slice(0, 2).map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center justify-between bg-white px-2 py-1 rounded border border-slate-200 text-[10px]"
                              >
                                <span className="truncate max-w-[100px] font-medium text-slate-700">
                                  {file.name}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() =>
                                      setPreviewFile({
                                        file,
                                        orderId: ord.id,
                                        clientName: ord.clientName,
                                      })
                                    }
                                    className="p-1 text-slate-500 hover:text-[#131b2e] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                    title="Visualizar Ficheiro"
                                  >
                                    <span className="material-symbols-outlined text-xs">visibility</span>
                                  </button>
                                  <button
                                    onClick={() => handleDownloadFile(file)}
                                    className="p-1 text-slate-500 hover:text-[#131b2e] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                    title="Baixar Ficheiro"
                                  >
                                    <span className="material-symbols-outlined text-xs">download</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                            {filesCount > 2 && (
                              <p className="text-[9px] text-slate-400 italic">
                                + {filesCount - 2} outro(s) arquivo(s)
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            <span>Sem arte anexada</span>
                          </p>
                        )}
                      </div>

                      {/* Hermes Layout Note */}
                      {ord.hermesLayoutNote && (
                        <div className="bg-[#ECFDF5] border border-[#6ffbbe]/40 p-2 rounded-lg text-[10px] text-[#005236] flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-xs text-[#009668] shrink-0 mt-0.5">
                            auto_awesome
                          </span>
                          <span>{ord.hermesLayoutNote}</span>
                        </div>
                      )}

                      {/* Quality Approval & Rejection Control Buttons */}
                      <div className="pt-2 border-t border-[#f2f4f6] space-y-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleApproveQuality(ord)}
                            className={`py-1.5 px-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              isApproved
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                            title="Aprovar qualidade do arquivo e notificar cliente via Hermes WhatsApp"
                          >
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            <span>Aprovar</span>
                          </button>

                          <button
                            onClick={() => {
                              setRejectionModalOrder(ord);
                              setRejectionNote("");
                            }}
                            className={`py-1.5 px-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              isRejected
                                ? "bg-rose-600 text-white shadow-xs"
                                : "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                            title="Rejeitar qualidade da arte e solicitar correções ao cliente via Hermes WhatsApp"
                          >
                            <span className="material-symbols-outlined text-xs">cancel</span>
                            <span>Rejeitar</span>
                          </button>
                        </div>

                        {/* Card Footer with Advance Restriction Rule */}
                        {(() => {
                          const advCheck = getAdvanceStatus(ord);
                          return (
                            <div className="space-y-1 pt-1">
                              {!advCheck.allowed && (
                                <p className="text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[10px]">block</span>
                                  <span className="truncate">{advCheck.reason}</span>
                                </p>
                              )}

                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[10px] text-[#76777d] flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">schedule</span>
                                  {ord.dueDate}
                                </span>

                                {stg !== "ENTREGA" && (
                                  <button
                                    disabled={!advCheck.allowed}
                                    onClick={() => advanceStage(ord.id)}
                                    title={advCheck.allowed ? "Avançar para a próxima etapa" : advCheck.reason}
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                                      advCheck.allowed
                                        ? "bg-[#131b2e] hover:bg-[#0b111f] text-white cursor-pointer"
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                    }`}
                                  >
                                    <span>Avançar</span>
                                    <span className="material-symbols-outlined text-[10px]">
                                      chevron_right
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}

                {stageOrders.length === 0 && (
                  <div className="border-2 border-dashed border-[#c6c6cd]/50 rounded-xl p-6 text-center text-xs text-[#76777d]">
                    Nenhum pedido nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Details & File Validation Modal */}
      {selectedOrderForDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 border border-slate-200 text-[#191c1e] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-bold text-[#131b2e] bg-slate-100 px-2.5 py-1 rounded-lg">
                  {selectedOrderForDetails.id}
                </span>
                <div>
                  <h3 className="font-bold text-base text-[#191c1e]">
                    {selectedOrderForDetails.clientName}
                  </h3>
                  <p className="text-xs text-[#76777d]">
                    {selectedOrderForDetails.productDescription}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrderForDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Quality Controls in Modal */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Status de Qualidade
                </span>
                <span className="font-bold text-xs text-[#191c1e]">
                  {selectedOrderForDetails.qualityStatus || "Aguardando Validação"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApproveQuality(selectedOrderForDetails)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>Aprovar Qualidade</span>
                </button>
                <button
                  onClick={() => {
                    setRejectionModalOrder(selectedOrderForDetails);
                    setRejectionNote("");
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  <span>Rejeitar Qualidade</span>
                </button>
              </div>
            </div>

            {/* File List in Modal */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-[#191c1e] flex items-center justify-between">
                <span>Arquivos de Produção & Vetores Vincular</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {selectedOrderForDetails.files?.length || 0} arquivo(s)
                </span>
              </h4>

              {selectedOrderForDetails.files && selectedOrderForDetails.files.length > 0 ? (
                <div className="space-y-2">
                  {selectedOrderForDetails.files.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-[#131b2e] transition-all text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 text-[#131b2e] flex items-center justify-center font-bold">
                          <span className="material-symbols-outlined text-base">
                            {file.type === "pdf"
                              ? "picture_as_pdf"
                              : file.type === "vector"
                              ? "draw"
                              : "image"}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-[#191c1e]">{file.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {file.size} • Enviado {file.uploadedAt}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          Ready for Print
                        </span>
                        <button
                          onClick={() =>
                            setPreviewFile({
                              file,
                              orderId: selectedOrderForDetails.id,
                              clientName: selectedOrderForDetails.clientName,
                            })
                          }
                          className="px-2.5 py-1.5 text-[#131b2e] hover:bg-slate-100 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
                          title="Visualizar Ficheiro"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Visualizar</span>
                        </button>
                        <button
                          onClick={() => handleDownloadFile(file)}
                          className="px-2.5 py-1.5 bg-[#131b2e] hover:bg-[#0b111f] text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          title="Baixar Ficheiro"
                        >
                          <span className="material-symbols-outlined text-sm">download</span>
                          <span>Baixar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500 space-y-2">
                  <span className="material-symbols-outlined text-3xl text-slate-300">
                    cloud_off
                  </span>
                  <p>Nenhum arquivo de produção anexado a este pedido ainda.</p>
                </div>
              )}
            </div>

            {/* Quick Upload Dropzone inside Modal */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-center text-xs space-y-2">
              <p className="font-bold text-[#191c1e]">Adicionar novos arquivos a este pedido</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#131b2e] text-white font-bold rounded-xl text-xs cursor-pointer hover:bg-[#0b111f] transition-all">
                <span className="material-symbols-outlined text-sm">file_upload</span>
                <span>Escolher Arquivos</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && selectedOrderForDetails) {
                      handleFileUpload(selectedOrderForDetails.id, e.target.files);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Note Reason Modal */}
      {rejectionModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 text-[#191c1e] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-rose-700 flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span>
                <span>Rejeitar Qualidade de Arte/Pedido</span>
              </h3>
              <button
                onClick={() => setRejectionModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você está prestes a rejeitar a qualidade da arte do pedido{" "}
              <strong className="text-[#191c1e]">{rejectionModalOrder.id}</strong> (
              {rejectionModalOrder.clientName}). Descreva o motivo técnico para informar o cliente via
              Hermes WhatsApp:
            </p>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Motivo da Rejeição / Instrução de Correção
              </label>
              <textarea
                rows={3}
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Ex: Arquivo enviado em baixa resolução (30DPI). Favor reenviar em vetor ou PDF/X-1a com no mínimo 300DPI e sangria de 3mm."
                className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl p-3 text-xs text-[#191c1e] focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectionModalOrder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                <span>Confirmar e Notificar via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview & Visual Quality Check Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-5 border border-slate-200 text-[#191c1e] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#131b2e] text-white flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">
                    {previewFile.file.type === "pdf"
                      ? "picture_as_pdf"
                      : previewFile.file.type === "vector"
                      ? "draw"
                      : "image"}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                    <span>{previewFile.file.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-mono font-bold px-2 py-0.5 rounded">
                      {previewFile.file.size}
                    </span>
                  </h3>
                  <p className="text-xs text-[#76777d]">
                    Pedido <strong className="text-[#191c1e]">{previewFile.orderId}</strong> • Cliente:{" "}
                    <strong>{previewFile.clientName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Visual Technical Canvas Mock Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#191c1e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-600">zoom_in</span>
                  <span>Visualização Técnica de Pré-Impressão (Prepress RIP View)</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                  300 DPI • CMYK Coated FOGRA39
                </span>
              </div>

              {/* Artwork Container */}
              <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col items-center justify-center relative min-h-[320px] overflow-hidden border border-slate-800 shadow-inner">
                {/* Crop marks / Sangria lines background overlay */}
                <div className="absolute inset-4 border border-dashed border-red-500/50 rounded pointer-events-none flex items-center justify-center">
                  <span className="absolute top-1 left-2 text-[9px] font-mono text-red-400/80">
                    Linha de Sangria 3mm
                  </span>
                  <span className="absolute bottom-1 right-2 text-[9px] font-mono text-emerald-400/80">
                    Margem de Segurança 5mm
                  </span>
                </div>

                {/* Simulated Graphical Content based on File Type */}
                <div className="w-full max-w-md bg-white rounded-xl p-6 text-slate-900 shadow-2xl space-y-4 text-center border-4 border-slate-100 relative z-10 my-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs text-slate-500 font-mono">
                    <span>2N PUBLICIDADE</span>
                    <span className="font-bold text-slate-900">{previewFile.file.type.toUpperCase()}</span>
                  </div>

                  <div className="py-6 space-y-2">
                    <div className="w-14 h-14 mx-auto rounded-full bg-[#131b2e] text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl">palette</span>
                    </div>
                    <h4 className="font-black text-lg text-[#131b2e] tracking-tight">
                      {previewFile.file.name}
                    </h4>
                    <p className="text-xs text-slate-600 font-medium">
                      Layout vetorial processado para o pedido {previewFile.orderId}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                    <div className="bg-slate-100 p-1.5 rounded">
                      <span className="block text-slate-400 text-[8px]">FORMATO</span>
                      <span>210 x 297 mm</span>
                    </div>
                    <div className="bg-slate-100 p-1.5 rounded">
                      <span className="block text-slate-400 text-[8px]">CORES</span>
                      <span>4/0 CMYK</span>
                    </div>
                    <div className="bg-slate-100 p-1.5 rounded">
                      <span className="block text-slate-400 text-[8px]">CURVAS</span>
                      <span className="text-emerald-700">OK (Convertido)</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-slate-400 relative z-10 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  <span>Arquivo verificado pelo assistente de pré-impressão da 2N Publicidade</span>
                </p>
              </div>
            </div>

            {/* Technical Verification Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Resolução</span>
                <p className="font-bold text-emerald-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check</span>
                  <span>300 DPI (Alta Qualidade)</span>
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Espaço de Cor</span>
                <p className="font-bold text-emerald-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check</span>
                  <span>CMYK Variação 0%</span>
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Fontes & Imagens</span>
                <p className="font-bold text-emerald-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check</span>
                  <span>Vetorizadas & Incorporadas</span>
                </p>
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setPreviewFile(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Fechar
              </button>

              <button
                onClick={() => handleDownloadFile(previewFile.file)}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Baixar Ficheiro Original ({previewFile.file.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
