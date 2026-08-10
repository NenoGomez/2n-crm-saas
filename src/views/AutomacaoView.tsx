import React, { useState } from "react";
import { AutomationWorkflow, AutomationNode, HermesConfig } from "../types";
import { initialAutomations } from "../data/initialData";

interface AutomacaoViewProps {
  onOpenHermes: () => void;
  hermesConfig?: HermesConfig;
  setHermesConfig?: React.Dispatch<React.SetStateAction<HermesConfig>>;
}

export const AutomacaoView: React.FC<AutomacaoViewProps> = ({
  onOpenHermes,
  hermesConfig,
  setHermesConfig,
}) => {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(initialAutomations);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("auto-1");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("node-1");
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Local state for Webhook & Token Form
  const [localWebhookUrl, setLocalWebhookUrl] = useState(
    hermesConfig?.webhookUrl || "https://api.hermes-bot.2npublicidade.co.ao/v1/webhook/whatsapp"
  );
  const [localApiToken, setLocalApiToken] = useState(
    hermesConfig?.apiToken || "hermes_live_tk_984729384729384729384"
  );
  const [showToken, setShowToken] = useState(false);
  const [autoNotify, setAutoNotify] = useState(
    hermesConfig?.autoNotifyOnQualityChange ?? true
  );
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<string | null>(null);

  const activeWorkflow =
    workflows.find((w) => w.id === selectedWorkflowId) || workflows[0] || { id: "", name: "", steps: [], isActive: false };

  const activeNode = activeWorkflow.steps?.find((s) => s.id === selectedNodeId);

  const handleSaveHermesConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (setHermesConfig) {
      setHermesConfig({
        webhookUrl: localWebhookUrl,
        apiToken: localApiToken,
        isConnected: true,
        autoNotifyOnQualityChange: autoNotify,
        lastSaved: "Agora",
      });
    }
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3500);
  };

  const handleTestWebhookConnection = () => {
    setIsTestingWebhook(true);
    setWebhookTestStatus(null);
    setTimeout(() => {
      setIsTestingWebhook(false);
      setWebhookTestStatus(
        "✅ Webhook conectado com sucesso! Resposta HTTP 200 OK do servidor Hermes WhatsApp."
      );
    }, 1200);
  };

  const toggleWorkflowStatus = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isActive: !w.isActive } : w))
    );
  };

  const handleAddNodeToFlow = (category: string, title: string, icon: string) => {
    const newNode: AutomationNode = {
      id: `node-${Date.now()}`,
      type: category.includes("Hermes") ? "hermes" : category.includes("Ação") ? "action" : "condition",
      category,
      title,
      description: "Nova etapa configurada no fluxo de automação.",
      icon,
      bgClass: category.includes("Hermes") ? "bg-[#ECFDF5] text-[#009668]" : "bg-white text-[#191c1e]",
    };

    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === selectedWorkflowId ? { ...w, steps: [...w.steps, newNode] } : w
      )
    );
    setSelectedNodeId(newNode.id);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (activeWorkflow.steps.length <= 1) return;
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === selectedWorkflowId
          ? { ...w, steps: w.steps.filter((s) => s.id !== nodeId) }
          : w
      )
    );
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(activeWorkflow.steps[0]?.id || null);
    }
  };

  const handleRunFlowTest = () => {
    setIsTestModalOpen(true);
    setTestResult(null);
    setTimeout(() => {
      setTestResult(
        "Sucesso! O fluxo simulou um novo Lead 'Maria Santos' (+244 923 000 999). E-mail de apresentação enviado e tarefa de follow-up criada no CRM via Hermes AI."
      );
    }, 1200);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner & Flow Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <div>
          <h2 className="text-xl font-bold text-[#191c1e] flex items-center gap-2">
            <span>Editor Visual de Automação</span>
            <span className="text-xs bg-[#ECFDF5] text-[#009668] border border-[#6ffbbe]/50 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">auto_awesome</span>
              <span>Hermes AI Flow</span>
            </span>
          </h2>
          <p className="text-xs text-[#45464d] mt-0.5">
            Crie fluxos automatizados com gatilhos, qualificações por IA e ações no CRM 2N Publicidade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunFlowTest}
            className="bg-slate-100 hover:bg-slate-200 text-[#191c1e] font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-blue-600">play_circle</span>
            <span>Testar Fluxo</span>
          </button>

          <button
            onClick={onOpenHermes}
            className="bg-[#ECFDF5] hover:bg-[#d0fbe3] text-[#005236] font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 border border-[#6ffbbe]/40 cursor-pointer hermes-glow"
          >
            <span className="material-symbols-outlined text-base text-[#009668]">auto_awesome</span>
            <span>Gerar com IA</span>
          </button>
        </div>
      </div>

      {/* Hermes WhatsApp API & Webhook Configuration Section */}
      <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] border border-[#6ffbbe]/50 flex items-center justify-center text-[#009668]">
              <span className="material-symbols-outlined text-xl">webhook</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
                <span>Configuração de Webhook & Token Hermes WhatsApp</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Conectado</span>
                </span>
              </h3>
              <p className="text-xs text-[#76777d]">
                Defina os parâmetros de integração HTTP/API para envio automático de orçamentos, faturas e notificações de status de produção.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestWebhookConnection}
              disabled={isTestingWebhook}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-[#191c1e] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isTestingWebhook ? (
                <span className="w-3.5 h-3.5 border-2 border-[#131b2e] border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span className="material-symbols-outlined text-sm text-blue-600">sync</span>
              )}
              <span>Testar Conexão</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveHermesConfig} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Webhook URL Input */}
            <div className="space-y-1">
              <label className="block font-bold text-[#191c1e]">
                URL do Webhook do Hermes WhatsApp
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">
                  link
                </span>
                <input
                  type="url"
                  required
                  value={localWebhookUrl}
                  onChange={(e) => setLocalWebhookUrl(e.target.value)}
                  placeholder="https://api.hermes-bot.com/v1/webhook/whatsapp"
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#131b2e] focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-[#191c1e] transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                Endereço de escuta para eventos e envio de mensagens pelo bot Hermes.
              </p>
            </div>

            {/* API Token Input */}
            <div className="space-y-1">
              <label className="block font-bold text-[#191c1e]">
                Token de Autenticação de API (Bearer Token)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">
                  key
                </span>
                <input
                  type={showToken ? "text" : "password"}
                  required
                  value={localApiToken}
                  onChange={(e) => setLocalApiToken(e.target.value)}
                  placeholder="hermes_live_tk_..."
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#131b2e] focus:bg-white rounded-xl pl-9 pr-10 py-2 text-xs font-mono text-[#191c1e] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-[#191c1e] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {showToken ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Chave secreta para autorizar as requisições enviadas ao WhatsApp.
              </p>
            </div>
          </div>

          {/* Auto Notification Toggle & Submit */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoNotify}
                onChange={(e) => setAutoNotify(e.target.checked)}
                className="w-4 h-4 rounded text-[#009668] focus:ring-[#009668] border-slate-300"
              />
              <span className="font-semibold text-[#191c1e]">
                Notificar cliente via WhatsApp automaticamente ao Aprovar ou Rejeitar pedidos na Produção
              </span>
            </label>

            <button
              type="submit"
              className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              <span>Salvar Configurações de Conexão</span>
            </button>
          </div>
        </form>

        {/* Feedback Banners */}
        {showSaveToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
              <span>Configurações do Hermes WhatsApp salvas com sucesso no estado global!</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-mono">Última atualização: Agora</span>
          </div>
        )}

        {webhookTestStatus && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-blue-600 text-base">verified</span>
            <span>{webhookTestStatus}</span>
          </div>
        )}
      </div>

      {/* Workflow Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {workflows.map((wf) => (
          <button
            key={wf.id}
            onClick={() => {
              setSelectedWorkflowId(wf.id);
              setSelectedNodeId(wf.steps[0]?.id || null);
            }}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
              selectedWorkflowId === wf.id
                ? "bg-[#131b2e] text-white border-[#131b2e] shadow-md"
                : "bg-white text-[#45464d] border-[#c6c6cd]/40 hover:bg-slate-50"
            }`}
          >
            <span className="material-symbols-outlined text-sm">schema</span>
            <span>{wf.name}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                wf.isActive ? "bg-emerald-400" : "bg-slate-300"
              }`}
            ></span>
          </button>
        ))}
      </div>

      {/* Main Flow Canvas & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Library Node Palette */}
        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4 h-fit">
          <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#131b2e]">add_box</span>
            Biblioteca de Nós
          </h3>
          <p className="text-[11px] text-[#76777d]">
            Clique para adicionar novos passos ao seu fluxo de trabalho:
          </p>

          <div className="space-y-2 text-xs">
            <div
              onClick={() => handleAddNodeToFlow("Gatilho", "Novo Contato WhatsApp", "chat")}
              className="p-3 rounded-xl border border-slate-200 hover:border-[#131b2e] hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-base">chat</span>
              </div>
              <div>
                <p className="font-bold text-[#191c1e] group-hover:text-[#009668] transition-colors">
                  Gatilho WhatsApp
                </p>
                <p className="text-[10px] text-slate-500">Ao receber mensagem</p>
              </div>
            </div>

            <div
              onClick={() => handleAddNodeToFlow("Hermes AI", "Análise de Qualificação", "auto_awesome")}
              className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/50 transition-all cursor-pointer flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#009668] text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-base">auto_awesome</span>
              </div>
              <div>
                <p className="font-bold text-[#005236] group-hover:underline">
                  Hermes AI Rating
                </p>
                <p className="text-[10px] text-[#005236]">Calcular Intenção %</p>
              </div>
            </div>

            <div
              onClick={() => handleAddNodeToFlow("Ação", "Criar Tarefa no CRM", "task")}
              className="p-3 rounded-xl border border-slate-200 hover:border-[#131b2e] hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-base">task</span>
              </div>
              <div>
                <p className="font-bold text-[#191c1e]">Criar Tarefa CRM</p>
                <p className="text-[10px] text-slate-500">Atribuir a vendedor</p>
              </div>
            </div>

            <div
              onClick={() => handleAddNodeToFlow("Lógica", "Aguardar 24h", "schedule")}
              className="p-3 rounded-xl border border-slate-200 hover:border-[#131b2e] hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-base">schedule</span>
              </div>
              <div>
                <p className="font-bold text-[#191c1e]">Atraso Temporal</p>
                <p className="text-[10px] text-slate-500">Pausa de 24h / 48h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Canvas Nodes Visual Flow */}
        <div className="lg:col-span-2 bg-slate-100 p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow relative min-h-[480px] flex flex-col items-center justify-start space-y-4 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
          {/* Header Canvas Control */}
          <div className="w-full flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs mb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#191c1e]">{activeWorkflow.name}</span>
              <span className="text-slate-400">({activeWorkflow.steps.length} etapas)</span>
            </div>

            <button
              onClick={() => toggleWorkflowStatus(activeWorkflow.id)}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeWorkflow.isActive
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {activeWorkflow.isActive ? "toggle_on" : "toggle_off"}
              </span>
              <span>{activeWorkflow.isActive ? "Fluxo Ativo" : "Fluxo Pausado"}</span>
            </button>
          </div>

          {/* Render Sequenced Nodes */}
          {activeWorkflow.steps.map((node, index) => {
            const isSelected = selectedNodeId === node.id;
            const isHermes = node.type === "hermes" || node.category.includes("Hermes");

            return (
              <React.Fragment key={node.id}>
                {/* Node Card */}
                <div
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full max-w-md p-4 rounded-2xl border-2 shadow-md transition-all cursor-pointer relative group ${
                    isSelected
                      ? "ring-2 ring-emerald-500 ring-offset-2 border-[#131b2e] bg-white scale-[1.02]"
                      : isHermes
                      ? "bg-[#ECFDF5] border-[#6ffbbe]/70 text-[#005236] hover:bg-emerald-100/60"
                      : "bg-white border-slate-200 text-[#191c1e] hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          isHermes
                            ? "bg-[#009668] text-white shadow-xs"
                            : "bg-[#131b2e] text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined">{node.icon}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-70">
                          Etapa {index + 1} • {node.category}
                        </span>
                        <h4 className="font-bold text-sm">{node.title}</h4>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(node.id);
                      }}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Excluir Etapa"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>

                  <p className="text-xs mt-2 text-slate-600 line-clamp-2">
                    {node.description}
                  </p>
                </div>

                {/* Connecting Line Connector Arrow */}
                {index < activeWorkflow.steps.length - 1 && (
                  <div className="flex flex-col items-center justify-center my-0.5">
                    <div className="w-0.5 h-6 bg-slate-400/80"></div>
                    <span className="material-symbols-outlined text-slate-500 text-sm -mt-2">
                      arrow_downward
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Right Node Step Details Inspector */}
        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4 h-fit">
          <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#131b2e]">tune</span>
            Inspeção da Etapa
          </h3>

          {activeNode ? (
            <div className="space-y-4 text-xs">
              <div className="bg-[#f8fafc] p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Identificador
                </span>
                <p className="font-bold font-mono text-[#131b2e]">{activeNode.id}</p>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Título da Etapa</label>
                <input
                  type="text"
                  value={activeNode.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkflows((prev) =>
                      prev.map((w) =>
                        w.id === selectedWorkflowId
                          ? {
                              ...w,
                              steps: w.steps.map((s) =>
                                s.id === activeNode.id ? { ...s, title: val } : s
                              ),
                            }
                          : w
                      )
                    );
                  }}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-[#191c1e]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Descrição / Parâmetros</label>
                <textarea
                  rows={3}
                  value={activeNode.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkflows((prev) =>
                      prev.map((w) =>
                        w.id === selectedWorkflowId
                          ? {
                              ...w,
                              steps: w.steps.map((s) =>
                                s.id === activeNode.id ? { ...s, description: val } : s
                              ),
                            }
                          : w
                      )
                    );
                  }}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-xl p-3 text-xs text-[#191c1e]"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
                <p className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Hermes Execution Engine
                </p>
                <p className="mt-1">
                  Esta etapa é validada automaticamente em tempo real sem latência.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Nenhum nó selecionado no canvas.</p>
          )}
        </div>
      </div>

      {/* Test Simulation Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 text-[#191c1e] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">play_circle</span>
                Simulação do Fluxo
              </h3>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {!testResult ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs text-slate-600 font-bold">
                  Executando testes e conectores Hermes AI...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed font-medium">
                  {testResult}
                </div>
                <button
                  onClick={() => setIsTestModalOpen(false)}
                  className="w-full py-2.5 bg-[#131b2e] text-white font-bold text-xs rounded-xl hover:bg-[#0b111f] transition-all cursor-pointer"
                >
                  Concluído
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
