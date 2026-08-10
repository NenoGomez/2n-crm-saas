import { useEffect, useState } from "react";
import {
  NavigationTab,
  Client,
  DealCard,
  Conversation,
  ProductionOrder,
  ActivityItem,
  AlertItem,
  TaskItem,
  Quote,
  HermesConfig,
  CompanySettings,
} from "./types";
import {
  initialClients,
  initialDeals,
  initialConversations,
  initialOrders,
  initialActivities,
  initialAlerts,
  initialTasks,
  initialQuotes,
  initialHermesConfig,
  initialCompanySettings,
} from "./data/initialData";
import * as api from "./api";

// Components
import { Sidebar } from "./components/Sidebar";
import { TopHeader } from "./components/TopHeader";
import { BottomNav } from "./components/BottomNav";
import { HermesAssistantModal } from "./components/HermesAssistantModal";
import { NewSaleModal } from "./components/NewSaleModal";
import { NewClientModal } from "./components/NewClientModal";
import { NewOrderModal } from "./components/NewOrderModal";

// Views
import { DashboardView } from "./views/DashboardView";
import { PipelineView } from "./views/PipelineView";
import { OrcamentosView } from "./views/OrcamentosView";
import { ClientesView } from "./views/ClientesView";
import { AtendimentoView } from "./views/AtendimentoView";
import { ProducaoView } from "./views/ProducaoView";
import { FinanceiroView } from "./views/FinanceiroView";
import { AutomacaoView } from "./views/AutomacaoView";
import { RelatoriosView } from "./views/RelatoriosView";
import { CalendarioView } from "./views/CalendarioView";
import { ConfiguracoesView } from "./views/ConfiguracoesView";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>("principal");

  // CRM Global State
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [deals, setDeals] = useState<DealCard[]>(initialDeals);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [orders, setOrders] = useState<ProductionOrder[]>(initialOrders);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [alerts] = useState<AlertItem[]>(initialAlerts);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [hermesConfig, setHermesConfig] = useState<HermesConfig>(initialHermesConfig);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(initialCompanySettings);

  const [dataSource, setDataSource] = useState<"local" | "api">("local");

  // Load real data from the Postgres-backed API. If it fails, keep initialData
  // so the UI always renders (never breaks when the API/DB is down).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const boot = await api.getBootstrap();
      if (cancelled || !boot) return;
      if (boot.clients?.length) setClients(boot.clients as Client[]);
      if (boot.deals?.length) setDeals(boot.deals as DealCard[]);
      if (boot.conversations?.length) setConversations(boot.conversations as Conversation[]);
      if (boot.orders?.length) setOrders(boot.orders as ProductionOrder[]);
      if (boot.quotes?.length) setQuotes(boot.quotes as Quote[]);
      if (boot.tasks?.length) setTasks(boot.tasks as TaskItem[]);
      if (boot.activities?.length) setActivities(boot.activities as ActivityItem[]);
      if (boot.companySettings) setCompanySettings(boot.companySettings as CompanySettings);
      setDataSource("api");
      console.info("[2N CRM] dados carregados da API (Postgres). Hermes AI:", boot.aiMode);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Modals & Drawers
  const [isHermesOpen, setIsHermesOpen] = useState(false);
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedChatClientId, setSelectedChatClientId] = useState<string | undefined>(undefined);

  // Quality change WhatsApp Notification Handler
  const handleNotifyQualityStatusChange = (order: ProductionOrder, status: "APROVADO" | "REJEITADO", note?: string) => {
    const isApproved = status === "APROVADO";
    const statusText = isApproved ? "APROVADO na Qualidade" : "REJEITADO na Qualidade";
    const statusMsg = isApproved
      ? `Olá ${order.clientName}! O seu pedido ${order.id} (${order.productDescription}) foi APROVADO no controle de qualidade da 2N Publicidade e seguiu para produção/impressão! 🚀`
      : `Olá ${order.clientName}! O seu pedido ${order.id} (${order.productDescription}) necessita de revisão/ajuste na arte (${note || "Ajuste técnico"}). Nossa equipe entrará em contato! ⚠️`;

    // 0. Persist to API (updates DB + logs/dispatches the notification server-side)
    void api.setOrderQuality(order.id, status, note);

    // 1. Log activity
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      title: `Qualidade ${status}: ${order.id}`,
      subtitle: `${order.clientName} - Notificação Hermes enviada via WhatsApp`,
      timeAgo: "Agora",
      type: "production",
    };
    setActivities((prev) => [newActivity, ...prev]);

    // 2. Dispatch message to conversation matching clientName
    setConversations((prev) => {
      const matchIndex = prev.findIndex(
        (c) => c.clientName.toLowerCase().includes(order.clientName.toLowerCase()) || order.clientName.toLowerCase().includes(c.clientName.toLowerCase())
      );

      const newMessage = {
        id: `m-q-${Date.now()}`,
        sender: "hermes" as const,
        text: `🤖 [Hermes WhatsApp Webhook Dispatch]\n\n${statusMsg}`,
        timestamp: "Agora",
        status: "delivered" as const,
      };

      if (matchIndex !== -1) {
        const updated = [...prev];
        updated[matchIndex] = {
          ...updated[matchIndex],
          lastMessage: `[Status Qualidade ${status}] ${order.id}`,
          lastMessageTime: "Agora",
          messages: [...updated[matchIndex].messages, newMessage],
        };
        return updated;
      }
      return prev;
    });
  };

  // Handlers
  const handleAddDeal = (newDeal: DealCard) => {
    setDeals((prev) => [newDeal, ...prev]);
    void api.createDeal(newDeal);
    // Add real-time activity entry
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      title: "Nova Venda registrada",
      subtitle: `${newDeal.title} (${newDeal.company}) - Kz ${newDeal.estimatedValue.toLocaleString("pt-BR")}`,
      timeAgo: "Agora",
      type: "budget",
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  const handleAddClient = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    void api.createClient(newClient);
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      title: "Novo cliente cadastrado",
      subtitle: `${newClient.name} (${newClient.company})`,
      timeAgo: "Agora",
      type: "client",
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  const handleAddOrder = (newOrder: ProductionOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
    void api.createOrder(newOrder);
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      title: "Ordem de Produção criada",
      subtitle: `${newOrder.id} - ${newOrder.clientName}`,
      timeAgo: "Agora",
      type: "production",
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  const handleSelectClientForChat = (clientId: string) => {
    setSelectedChatClientId(clientId);
    setActiveTab("atendimento");
  };

  return (
    <div data-source={dataSource} className="min-h-screen bg-[#F8FAFC] text-[#191c1e] font-sans antialiased flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewSale={() => setIsNewSaleOpen(true)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 md:ml-[260px] flex flex-col min-w-0">
        {/* Top Fixed Header */}
        <TopHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenHermes={() => setIsHermesOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          unreadNotificationsCount={alerts.length}
        />

        {/* Dynamic Screen View Content */}
        <main className="flex-1 pt-20 px-4 md:px-8 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {activeTab === "principal" && (
            <DashboardView
              setActiveTab={setActiveTab}
              onOpenHermes={() => setIsHermesOpen(true)}
              onOpenNewSale={() => setIsNewSaleOpen(true)}
              activities={activities}
              alerts={alerts}
              tasks={tasks}
              setTasks={setTasks}
              deals={deals}
              quotes={quotes}
              orders={orders}
            />
          )}

          {activeTab === "vendas" && (
            <PipelineView
              deals={deals}
              setDeals={setDeals}
              onOpenNewSale={() => setIsNewSaleOpen(true)}
              onOpenHermes={() => setIsHermesOpen(true)}
            />
          )}

          {activeTab === "orcamentos" && (
            <OrcamentosView
              quotes={quotes}
              setQuotes={setQuotes}
              clients={clients}
              onOpenHermes={() => setIsHermesOpen(true)}
              companySettings={companySettings}
            />
          )}

          {activeTab === "atendimento" && (
            <AtendimentoView
              conversations={conversations}
              setConversations={setConversations}
              selectedConvId={selectedChatClientId}
              onOpenHermes={() => setIsHermesOpen(true)}
            />
          )}

          {activeTab === "producao" && (
            <ProducaoView
              orders={orders}
              setOrders={setOrders}
              onOpenNewOrder={() => setIsNewOrderOpen(true)}
              onOpenHermes={() => setIsHermesOpen(true)}
              hermesConfig={hermesConfig}
              onNotifyQualityStatusChange={handleNotifyQualityStatusChange}
            />
          )}

          {activeTab === "financeiro" && <FinanceiroView />}

          {activeTab === "produtividade" && (
            <ClientesView
              clients={clients}
              setClients={setClients}
              onOpenNewClient={() => setIsNewClientOpen(true)}
              onSelectClientForChat={handleSelectClientForChat}
              conversations={conversations}
              orders={orders}
              quotes={quotes}
              onOpenNewQuoteForClient={() => setActiveTab("orcamentos")}
            />
          )}

          {activeTab === "automacao" && (
            <AutomacaoView
              onOpenHermes={() => setIsHermesOpen(true)}
              hermesConfig={hermesConfig}
              setHermesConfig={setHermesConfig}
            />
          )}

          {activeTab === "sistema" && (
            <ConfiguracoesView
              companySettings={companySettings}
              setCompanySettings={setCompanySettings}
            />
          )}

          {activeTab === "relatorios" && (
            <RelatoriosView deals={deals} clients={clients} orders={orders} />
          )}

          {activeTab === "calendario" && <CalendarioView />}

          {activeTab === "configuracoes" && (
            <ConfiguracoesView
              companySettings={companySettings}
              setCompanySettings={setCompanySettings}
            />
          )}
        </main>
      </div>

      {/* Bottom Mobile Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenHermes={() => setIsHermesOpen(true)}
        onOpenNewSale={() => setIsNewSaleOpen(true)}
      />

      {/* Hermes AI Assistant Drawer/Modal */}
      <HermesAssistantModal
        isOpen={isHermesOpen}
        onClose={() => setIsHermesOpen(false)}
        clients={clients}
        orders={orders}
        crmMetricsSummary={{
          salesToday: "840.500 Kz",
          salesMonth: "12.400.000 Kz",
          activeDealsCount: deals.length,
          pendingAmount: "2.100.000 Kz",
          activeOrders: orders.length,
        }}
      />

      {/* Creation Modals */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onAddDeal={handleAddDeal}
      />

      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        onAddClient={handleAddClient}
      />

      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onAddOrder={handleAddOrder}
      />
    </div>
  );
}
