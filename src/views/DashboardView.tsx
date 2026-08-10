import React, { useState } from "react";
import { ActivityItem, AlertItem, TaskItem, NavigationTab, DealCard } from "../types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface DashboardViewProps {
  setActiveTab: (tab: NavigationTab) => void;
  onOpenHermes: () => void;
  onOpenNewSale: () => void;
  activities: ActivityItem[];
  alerts: AlertItem[];
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  deals?: DealCard[];
  quotes?: any[];
  orders?: any[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  onOpenHermes,
  onOpenNewSale,
  activities,
  alerts,
  tasks,
  setTasks,
  deals = [],
  quotes = [],
  orders = [],
}) => {
  // Métricas reais derivadas do estado (não mock)
  const vendasMes = deals.reduce((s: number, d: any) => s + Number(d.estimatedValue || 0), 0);
  const orcamentosCount = quotes.length;
  const emProducao = orders.length;
  const pendentes = quotes.filter((q: any) => q.status === "Pendente" || q.status === "Enviado" || q.status === "Rascunho")
    .reduce((s: number, q: any) => s + Number(q.totalGeral || 0), 0);
  const leadsHermes = quotes.length + orders.length;

  const [revenueTimeframe, setRevenueTimeframe] = useState<"hoje" | "7d" | "30d" | "90d">("7d");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState<number>(15000000);
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [tempGoalInput, setTempGoalInput] = useState<string>("15000000");

  // Calculate real approved revenue from global state
  const approvedDealsValue = deals
    .filter((d) => d.stage === "APROVADO")
    .reduce((acc, d) => acc + d.estimatedValue, 0);
  
  // Total de vendas do mês = soma real dos deals (pipeline) + aprovados
  const totalMonthSales = vendasMes + approvedDealsValue;
  const goalProgressPercentage = Math.min(
    100,
    Math.round((totalMonthSales / monthlyTarget) * 100)
  );
  const remainingToGoal = Math.max(0, monthlyTarget - totalMonthSales);

  // Gráfico de vendas com dados REAIS (deals do pipeline), não mock
  const realDeals = deals.filter((d: any) => Number(d.estimatedValue || 0) > 0);
  const buildChart = (slice: number) => {
    const list = realDeals.slice(0, slice);
    if (list.length === 0) {
      return [{ label: "Sem dados", real: 0, meta: Math.round(monthlyTarget / 4) }];
    }
    const per = Math.round((monthlyTarget / list.length) || 1);
    return list.map((d: any, i: number) => ({
      label: (d.company || d.title || ("Negócio " + (i + 1))).slice(0, 10),
      real: Number(d.estimatedValue || 0),
      meta: per,
    }));
  };
  const chartDataMap = {
    hoje: buildChart(5),
    "7d": buildChart(7),
    "30d": buildChart(12),
    "90d": buildChart(20),
  };

  const currentChartData = chartDataMap[revenueTimeframe];

  // Recharts Donut Chart Data for Funnel Leads
  const funnelDonutData = [
    { name: "Novo Lead", value: 12, color: "#3b82f6" },
    { name: "Contactado", value: 10, color: "#06b6d4" },
    { name: "Orçamento", value: 15, color: "#f59e0b" },
    { name: "Negociação", value: 8, color: "#8b5cf6" },
    { name: "Aprovado", value: 7, color: "#10b981" },
  ];

  // Recharts AreaChart Data for Omnichannel Team Average Response Time (in minutes)
  const omnichannelResponseTimeData = [
    { dia: "Seg", whatsapp: 3.8, instagram: 7.2, email: 16.5, mediaGeral: 6.2 },
    { dia: "Ter", whatsapp: 3.1, instagram: 5.8, email: 14.0, mediaGeral: 5.1 },
    { dia: "Qua", whatsapp: 2.4, instagram: 4.9, email: 11.2, mediaGeral: 3.9 },
    { dia: "Qui", whatsapp: 2.9, instagram: 6.5, email: 13.8, mediaGeral: 4.8 },
    { dia: "Sex", whatsapp: 2.1, instagram: 4.2, email: 9.8, mediaGeral: 3.4 },
    { dia: "Sáb", whatsapp: 4.5, instagram: 8.4, email: 20.1, mediaGeral: 7.8 },
    { dia: "Dom", whatsapp: 5.8, instagram: 11.0, email: 25.0, mediaGeral: 10.2 },
  ];

  const totalLeadsCount = funnelDonutData.reduce((acc, curr) => acc + curr.value, 0);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTaskTitle,
      completed: false,
    };
    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle("");
  };

  const formatKz = (val: number) => {
    return `${val.toLocaleString("pt-BR")} Kz`;
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[#191c1e] tracking-tight">
            Bom dia, Nino! 👋
          </h2>
          <p className="text-xs md:text-sm text-[#45464d] mt-1">
            Resumo executivo do CRM 2N Publicidade. Hermes AI atendeu <strong className="text-[#009668]">12 novos leads</strong> hoje.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewSale}
            className="bg-[#131b2e] hover:bg-[#0b111f] text-white font-bold px-4 py-2 rounded-xl text-xs md:text-sm flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Nova Venda</span>
          </button>
          <button
            onClick={onOpenHermes}
            className="bg-[#ECFDF5] hover:bg-[#d0fbe3] text-[#005236] font-bold px-4 py-2 rounded-xl text-xs md:text-sm flex items-center gap-2 transition-all border border-[#6ffbbe]/40 cursor-pointer hermes-glow"
          >
            <span className="material-symbols-outlined text-base text-[#009668] animate-pulse">
              auto_awesome
            </span>
            <span>Hermes AI</span>
          </button>
        </div>
      </div>

      {/* Top Stat Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase tracking-wider block">
            Vendas Hoje
          </span>
          <div className="text-lg md:text-xl font-bold text-[#191c1e] mt-1">{vendasMes > 0 ? vendasMes.toLocaleString("pt-BR") + " Kz" : "0 Kz"}</div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[12px]">trending_up</span> Pipeline ativo
          </span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase tracking-wider block">
            Vendas Este Mês
          </span>
          <div className="text-lg md:text-xl font-bold text-[#191c1e] mt-1">{vendasMes > 0 ? vendasMes.toLocaleString("pt-BR") + " Kz" : "0 Kz"}</div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[12px]">trending_up</span> Pipeline total
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow relative overflow-hidden">
          <div className="absolute -right-2 -top-2 w-10 h-10 bg-[#4edea3]/10 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[#009668] text-lg">auto_awesome</span>
          </div>
          <span className="text-[11px] font-semibold text-[#45464d] uppercase tracking-wider block">
            Leads Hermes
          </span>
          <div className="text-lg md:text-xl font-bold text-[#191c1e] mt-1">{leadsHermes}</div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">
            {quotes.length} orçamentos + {orders.length} pedidos
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase tracking-wider block">
            Orçamentos
          </span>
          <div className="text-lg md:text-xl font-bold text-[#191c1e] mt-1">{orcamentosCount}</div>
          <span className="text-[10px] text-amber-600 font-bold mt-1 inline-block">
            {quotes.filter((q:any)=>q.status==="Pendente"||q.status==="Enviado").length} pendentes
          </span>
        </div>

        {/* Metric 5 */}
        <div className="bg-white p-4 rounded-xl border border-[#c6c6cd]/40 level-1-shadow">
          <span className="text-[11px] font-semibold text-[#45464d] uppercase tracking-wider block">
            Em Produção
          </span>
          <div className="text-lg md:text-xl font-bold text-[#191c1e] mt-1">{emProducao}</div>
          <span className="text-[10px] text-blue-600 font-bold mt-1 inline-block">
            pedidos em produção
          </span>
        </div>

        {/* Metric 6 */}
        <div className="bg-white p-4 rounded-xl border border-red-200 level-1-shadow bg-red-50/20">
          <span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider block">
            Valores Pendentes
          </span>
          <div className="text-lg md:text-xl font-bold text-red-700 mt-1">{pendentes > 0 ? pendentes.toLocaleString("pt-BR") + " Kz" : "0 Kz"}</div>
          <span className="text-[10px] text-red-600 font-bold mt-1 inline-block">
            Ação requerida
          </span>
        </div>
      </div>

      {/* Interactive Monthly Sales Goal Component */}
      <div className="bg-gradient-to-r from-[#131b2e] via-[#1a2540] to-[#131b2e] text-white p-6 rounded-2xl border border-white/10 level-1-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#009668]/20 border border-[#4edea3]/40 flex items-center justify-center text-[#4edea3]">
              <span className="material-symbols-outlined text-xl">flag</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>Meta de Vendas Mensal (2N Publicidade)</span>
                <span className="text-[10px] bg-[#009668] text-white px-2 py-0.5 rounded-full font-extrabold uppercase">
                  Agosto 2026
                </span>
              </h3>
              <p className="text-xs text-[#94a3b8]">
                Acompanhamento em tempo real do faturamento comercial comparado à meta definida.
              </p>
            </div>
          </div>

          {/* Goal Edit Button / Inline Form */}
          <div className="flex items-center gap-2">
            {isEditingGoal ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = parseFloat(tempGoalInput.replace(/\D/g, ""));
                  if (parsed && parsed > 0) {
                    setMonthlyTarget(parsed);
                  }
                  setIsEditingGoal(false);
                }}
                className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/20"
              >
                <input
                  type="text"
                  value={tempGoalInput}
                  onChange={(e) => setTempGoalInput(e.target.value)}
                  placeholder="Valor da meta em Kz"
                  className="bg-transparent text-white font-bold text-xs px-2 py-1 outline-none w-32 border-b border-[#4edea3]"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-[#009668] hover:bg-[#007d57] text-white font-bold text-xs px-3 py-1 rounded-lg cursor-pointer"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setTempGoalInput(monthlyTarget.toString());
                  setIsEditingGoal(true);
                }}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-[#4edea3]">edit</span>
                <span>Definir Meta</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[#94a3b8] block text-[10px] uppercase font-semibold">
              Meta Estipulada
            </span>
            <span className="text-lg font-extrabold text-white">
              Kz {monthlyTarget.toLocaleString("pt-BR")}
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[#94a3b8] block text-[10px] uppercase font-semibold">
              Realizado até Agora
            </span>
            <span className="text-lg font-extrabold text-[#4edea3]">
              Kz {totalMonthSales.toLocaleString("pt-BR")}
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[#94a3b8] block text-[10px] uppercase font-semibold">
              Faltante p/ Atingir
            </span>
            <span className="text-lg font-extrabold text-amber-400">
              Kz {remainingToGoal.toLocaleString("pt-BR")}
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[#94a3b8] block text-[10px] uppercase font-semibold">
              Progresso do Funil
            </span>
            <span className="text-lg font-extrabold text-white">
              {goalProgressPercentage}% Atingido
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] inline-block animate-ping" />
              Status: {goalProgressPercentage >= 100 ? "🎉 Meta Batida!" : `${goalProgressPercentage}% concluído`}
            </span>
            <span>{totalMonthSales.toLocaleString("pt-BR")} / {monthlyTarget.toLocaleString("pt-BR")} Kz</span>
          </div>

          <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/20 relative">
            <div
              className="h-full bg-gradient-to-r from-[#009668] via-[#10b981] to-[#4edea3] rounded-full transition-all duration-500 relative"
              style={{ width: `${goalProgressPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          {/* Milestone markers */}
          <div className="flex justify-between text-[10px] text-[#94a3b8] font-mono px-1">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span className="text-[#4edea3] font-bold">100% Meta</span>
          </div>
        </div>
      </div>

      {/* Middle Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Receita Bar Chart with Recharts (8 cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-base text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#131b2e] text-lg">bar_chart</span>
                Comparativo de Vendas Diárias & Metas
              </h3>
              <p className="text-xs text-[#45464d]">
                Comparação entre vendas realizadas vs meta estipulada (em Kz)
              </p>
            </div>

            {/* Timeframe selector */}
            <div className="flex bg-[#f2f4f6] p-1 rounded-xl border border-[#c6c6cd]/40 text-xs self-start">
              {(["hoje", "7d", "30d", "90d"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setRevenueTimeframe(tf)}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    revenueTimeframe === tf
                      ? "bg-[#131b2e] text-white shadow-xs"
                      : "text-[#45464d] hover:text-[#191c1e]"
                  }`}
                >
                  {tf === "hoje" ? "Hoje" : tf === "7d" ? "7 Dias" : tf === "30d" ? "30 Dias" : "90 Dias"}
                </button>
              ))}
            </div>
          </div>

          {/* Recharts BarChart Container */}
          <div className="w-full h-64 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k Kz`}
                />
                <RechartsTooltip
                  formatter={(value: number) => [formatKz(value)]}
                  contentStyle={{
                    backgroundColor: "#131b2e",
                    color: "#ffffff",
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                  itemStyle={{ color: "#4edea3" }}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  iconType="circle"
                />
                <Bar
                  dataKey="real"
                  name="Vendas Realizadas"
                  fill="#131b2e"
                  radius={[6, 6, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="meta"
                  name="Meta de Vendas"
                  fill="#009668"
                  radius={[6, 6, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-[#45464d] pt-3 border-t border-[#f2f4f6]">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#009668] inline-block" />
              Meta Mensal: 15.000.000 Kz (82.6% Atingida)
            </span>
            <button
              onClick={() => setActiveTab("relatorios")}
              className="font-bold text-[#009668] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Relatório Detalhado</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Pipeline Donut Chart & Hermes Status (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recharts Donut Chart Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-600 text-base">pie_chart</span>
                  Distribuição de Leads
                </h3>
                <p className="text-[11px] text-[#76777d]">Status atual dos leads no funil comercial</p>
              </div>
              <button
                onClick={() => setActiveTab("vendas")}
                className="text-xs text-[#009668] font-bold hover:underline"
              >
                Kanban
              </button>
            </div>

            {/* Recharts Donut Chart */}
            <div className="relative h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={funnelDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {funnelDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: number) => [`${val} leads (${Math.round((val / totalLeadsCount) * 100)}%)`]}
                    contentStyle={{
                      backgroundColor: "#191c1e",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "6px 10px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Donut Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-[#191c1e]">{totalLeadsCount}</span>
                <span className="text-[10px] text-[#76777d] uppercase tracking-wider font-semibold">
                  Leads
                </span>
              </div>
            </div>

            {/* Legend Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#f2f4f6]">
              {funnelDonutData.map((item) => (
                <div key={item.name} className="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[#45464d] font-medium truncate max-w-[80px]">{item.name}</span>
                  </div>
                  <span className="font-bold text-[#191c1e]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hermes AI Status Widget */}
          <div className="bg-[#131b2e] text-white p-5 rounded-2xl border border-white/10 level-1-shadow space-y-4 relative overflow-hidden hermes-glow-dark">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-xl animate-pulse">
                  auto_awesome
                </span>
                <h3 className="font-bold text-sm text-white">Hermes AI Status</h3>
              </div>
              <span className="text-[10px] font-bold text-[#4edea3] bg-[#4edea3]/20 px-2 py-0.5 rounded-full border border-[#4edea3]/40">
                ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="text-[#7c839b] block text-[10px]">Conversas Ativas</span>
                <span className="font-bold text-lg text-white">12</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="text-[#7c839b] block text-[10px]">Follow-ups Pendentes</span>
                <span className="font-bold text-lg text-white">8</span>
              </div>
            </div>

            <button
              onClick={onOpenHermes}
              className="w-full bg-[#4edea3] hover:bg-[#3bc28d] text-[#131b2e] font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Abrir Copiloto Hermes</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Omnichannel Average Response Time AreaChart Section */}
      <div className="bg-white p-6 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-[#191c1e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#009668] text-xl">speed</span>
              Média de Tempo de Resposta Omnichannel
            </h3>
            <p className="text-xs text-[#45464d]">
              Evolução semanal do tempo de primeira resposta da equipe por canal de atendimento (em minutos)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-[#009668] bg-[#ECFDF5] border border-[#6ffbbe]/50 px-3 py-1 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">trending_down</span>
              35% mais rápido que a semana anterior
            </span>
          </div>
        </div>

        {/* Omnichannel Performance Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-1.5 text-[#009668] font-bold text-[11px] mb-0.5">
              <span className="material-symbols-outlined text-sm">chat</span>
              WhatsApp (Hermes IA)
            </div>
            <div className="text-lg font-extrabold text-[#191c1e]">2.4 min</div>
            <span className="text-[10px] text-emerald-700 font-semibold">⚡ Resposta Quase Instantânea</span>
          </div>

          <div className="bg-cyan-50/70 p-3 rounded-xl border border-cyan-100">
            <div className="flex items-center gap-1.5 text-cyan-700 font-bold text-[11px] mb-0.5">
              <span className="material-symbols-outlined text-sm">photo_camera</span>
              Instagram & FB Direct
            </div>
            <div className="text-lg font-extrabold text-[#191c1e]">4.9 min</div>
            <span className="text-[10px] text-cyan-700 font-semibold">💬 Redes Sociais Integradas</span>
          </div>

          <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-100">
            <div className="flex items-center gap-1.5 text-purple-700 font-bold text-[11px] mb-0.5">
              <span className="material-symbols-outlined text-sm">mail</span>
              E-mail & Formulários
            </div>
            <div className="text-lg font-extrabold text-[#191c1e]">11.2 min</div>
            <span className="text-[10px] text-purple-700 font-semibold">✉️ Respostas de Formulário</span>
          </div>

          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-[#131b2e] font-bold text-[11px] mb-0.5">
              <span className="material-symbols-outlined text-sm">stars</span>
              Média Geral da Equipe
            </div>
            <div className="text-lg font-extrabold text-[#131b2e]">3.9 min</div>
            <span className="text-[10px] text-slate-600 font-semibold">🏆 Excelente Desempenho</span>
          </div>
        </div>

        {/* Recharts AreaChart */}
        <div className="w-full h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={omnichannelResponseTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorWhatsapp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#009668" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#009668" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorInstagram" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorEmail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="dia"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tickFormatter={(val) => `${val} min`}
              />
              <RechartsTooltip
                formatter={(val: number) => [`${val} minutos`]}
                contentStyle={{
                  backgroundColor: "#131b2e",
                  color: "#ffffff",
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
                labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} iconType="circle" />
              <Area
                type="monotone"
                dataKey="whatsapp"
                name="WhatsApp (Hermes IA)"
                stroke="#009668"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorWhatsapp)"
              />
              <Area
                type="monotone"
                dataKey="instagram"
                name="Instagram / Facebook"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInstagram)"
              />
              <Area
                type="monotone"
                dataKey="email"
                name="E-mail Corporativo"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorEmail)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom 3 Columns Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Atividade Recente */}
        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#131b2e]">history</span>
              Atividade Recente
            </h3>
            <span className="text-[10px] font-bold text-[#45464d] bg-[#f2f4f6] px-2 py-0.5 rounded-full">
              Tempo Real
            </span>
          </div>

          <div className="space-y-3 divide-y divide-[#f2f4f6]">
            {activities.map((act) => (
              <div key={act.id} className="pt-2.5 first:pt-0 flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs text-[#191c1e]">{act.title}</h4>
                  <p className="text-[11px] text-[#45464d] mt-0.5">{act.subtitle}</p>
                </div>
                <span className="text-[10px] text-[#76777d] whitespace-nowrap">{act.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas - Ação Requerida */}
        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-amber-500">warning</span>
              Alertas (Ação Requerida)
            </h3>
            <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              {alerts.length} Pendentes
            </span>
          </div>

          <div className="space-y-3">
            {alerts.map((alt) => (
              <div
                key={alt.id}
                className={`p-3 rounded-xl border flex items-start gap-3 ${
                  alt.type === "error"
                    ? "bg-red-50 border-red-200 text-red-900"
                    : alt.type === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                <span className="material-symbols-outlined text-lg mt-0.5">
                  {alt.type === "error" ? "error" : alt.type === "warning" ? "schedule" : "auto_awesome"}
                </span>
                <div>
                  <h4 className="font-bold text-xs">{alt.title}</h4>
                  <p className="text-[11px] opacity-80 mt-0.5">{alt.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tarefas de Hoje */}
        <div className="bg-white p-5 rounded-2xl border border-[#c6c6cd]/40 level-1-shadow space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#191c1e] flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#131b2e]">check_circle</span>
              Tarefas de Hoje
            </h3>
            <span className="text-[10px] font-bold text-[#131b2e] bg-[#f2f4f6] px-2 py-0.5 rounded-full">
              {tasks.filter((t) => t.completed).length}/{tasks.length}
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {tasks.map((task) => (
              <label
                key={task.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f2f4f6] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="w-4 h-4 rounded text-[#131b2e] focus:ring-[#131b2e]"
                />
                <span
                  className={`text-xs ${
                    task.completed ? "line-through text-[#76777d]" : "text-[#191c1e] font-medium"
                  }`}
                >
                  {task.title}
                </span>
              </label>
            ))}
          </div>

          <form onSubmit={handleAddTask} className="flex gap-2 pt-2 border-t border-[#f2f4f6]">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Adicionar nova tarefa..."
              className="flex-1 bg-[#f2f4f6] border border-[#c6c6cd]/40 rounded-lg px-3 py-1.5 text-xs text-[#191c1e] focus:outline-none focus:bg-white"
            />
            <button
              type="submit"
              className="bg-[#131b2e] text-white p-1.5 rounded-lg hover:bg-[#0b111f] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
