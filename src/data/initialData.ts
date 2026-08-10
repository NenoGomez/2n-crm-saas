import {
  Client,
  DealCard,
  Conversation,
  ProductionOrder,
  ActivityItem,
  AlertItem,
  TaskItem,
  Quote,
  AutomationWorkflow,
  HermesConfig,
  CompanySettings,
} from "../types";

// Dados de fallback vazios — o CRM carrega dados reais do backend (Postgres).
// Mantido apenas para estrutura/type-safety em caso de a API estar indisponível.
export const initialClients: Client[] = [];
export const initialDeals: DealCard[] = [];
export const initialConversations: Conversation[] = [];
export const initialOrders: ProductionOrder[] = [];
export const initialQuotes: Quote[] = [];
export const initialActivities: ActivityItem[] = [];
export const initialAlerts: AlertItem[] = [];
export const initialTasks: TaskItem[] = [];
export const initialAutomations: AutomationWorkflow[] = [];

export const initialHermesConfig: HermesConfig = {
  webhookUrl: "",
  apiToken: "",
  isConnected: true,
  autoNotifyOnQualityChange: true,
} as any;

export const initialCompanySettings: CompanySettings = {
  commercialName: "2N Publicidade",
  corporateName: "2N Publicidade Lda",
  nif: "",
  taxPayerNumber: "",
  logoUrl: "",
  phone: "",
  whatsapp: "",
  email: "geral@2npublicidade.online",
  website: "https://2npublicidade.online",
  googleMapsUrl: "",
  address: "Luanda, Angola",
  postalCode: "",
  city: "Luanda",
  province: "Luanda",
  country: "Angola",
  bankName: "",
  iban: "",
  primaryColor: "#131b2e",
  secondaryColor: "#009668",
} as any;
