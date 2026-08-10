export type NavigationTab =
  | "principal"
  | "vendas"
  | "orcamentos"
  | "atendimento"
  | "producao"
  | "financeiro"
  | "produtividade"
  | "automacao"
  | "sistema"
  | "relatorios"
  | "calendario"
  | "configuracoes";

export type PipelineStage = "NOVO" | "CONTACTADO" | "ORÇAMENTO" | "NEGOCIAÇÃO" | "APROVADO" | "CONCLUÍDO";

export type ProductionStage = "PEDIDO" | "ARTE" | "APROVAÇÃO" | "IMPRESSÃO" | "ENTREGA";

export type PriorityLevel = "Alta" | "Média" | "Baixa" | "Urgente";

export interface Client {
  id: string;
  name: string;
  company: string;
  phone: string;
  email?: string;
  segment?: string;
  lastPurchase: string;
  totalSpent: number; // In Kwanzas (Kz) or currency
  ordersCount: number;
  manager: string;
  status: "Ativo" | "Inativo";
  isVip?: boolean;
  avatarUrl?: string;
  initials?: string;
}

export interface DealCard {
  id: string;
  title: string;
  company: string;
  service: string;
  estimatedValue: number;
  stage: PipelineStage;
  priority: PriorityLevel;
  assigneeInitials: string;
  isHermesQualified?: boolean;
  contactPerson?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: "client" | "user" | "hermes";
  text: string;
  timestamp: string;
  isRead?: boolean;
  status?: "sent" | "delivered" | "read";
}

export interface Conversation {
  id: string;
  clientId: string;
  clientName: string;
  company: string;
  role?: string;
  channel: "WhatsApp" | "Instagram" | "Email" | "Web";
  avatarUrl?: string;
  initials?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  tag?: "Lead Quente" | "Urgente" | "Atendimento" | "VIP";
  estimatedValue?: number;
  stage?: PipelineStage;
  messages: ChatMessage[];
  hermesSuggestedReply?: string;
  hermesSummary?: string;
}

export interface ProductionFile {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string;
  uploadedAt: string;
  status?: "Pendente" | "Aprovado" | "Rejeitado";
}

export interface ProductionOrder {
  id: string; // e.g. #ORD-492
  clientName: string;
  productDescription: string; // e.g. "Adesivo Vinil Recorte (50x)"
  stage: ProductionStage;
  dueDate: string; // e.g. "15/Nov" or "Hoje 18:00"
  statusBadge?: "URGENTE" | "ATRASADO" | "NORMAL";
  hermesLayoutNote?: string;
  assigneeAvatar?: string;
  createdAt: string;
  files?: ProductionFile[];
  qualityStatus?: "PENDENTE" | "APROVADO" | "REJEITADO";
  qualityNote?: string;
}

export interface HermesConfig {
  webhookUrl: string;
  apiToken: string;
  isConnected: boolean;
  autoNotifyOnQualityChange: boolean;
  lastSaved?: string;
}

export interface CompanySettings {
  // Empresa - Informações Gerais & Identificação
  commercialName: string; // Nome / Nome comercial da empresa
  corporateName: string; // Razão Social
  nif: string; // NIF
  taxPayerNumber: string; // Número de contribuinte
  logoUrl?: string; // URL ou Base64 do logótipo
  logoFilename?: string; // Nome do ficheiro enviado

  // Contactos & Redes
  phone: string; // Telefone
  whatsapp: string; // WhatsApp
  email: string; // Email
  website: string; // Website
  googleMapsUrl: string; // Localização / Google Maps

  // Endereço
  address: string; // Endereço completo
  city: string; // Cidade
  province: string; // Província
  country: string; // País

  // Financeiro & Dados Bancários
  bankName: string; // Banco Principal
  accountHolder: string; // Titular da conta
  iban: string; // IBAN
  accountNumber: string; // Número da conta
  agencyNumber: string; // Número da agência
  swiftBic: string; // SWIFT / BIC
  secondaryBankName?: string; // Banco Secundário
  secondaryAccountHolder?: string;
  secondaryIban?: string; // IBAN Secundário
  secondaryAccountNumber?: string;

  // Documentos Comerciais & Fiscais
  defaultCurrency: string; // Moeda padrão (Kz)
  numberFormat: string; // Formato de números
  taxExemptionReason: string; // Dados fiscais relevantes / Motivo de Isenção IVA
  documentHeaderNote: string; // Cabeçalho padrão
  documentFooterNote: string; // Rodapé padrão dos documentos
  termsAndConditions: string; // Termos e condições
  signatureTitle: string; // Assinatura padrão / Cargo
  defaultObservations: string; // Observações padrão

  // Sistema & Preferências
  language: string; // Idioma
  timezone: string; // Fuso horário
  hermesAutoReply: boolean; // Preferência de AI
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timeAgo: string;
  type: "client" | "budget" | "payment" | "production";
}

export interface AlertItem {
  id: string;
  title: string;
  subtitle: string;
  type: "warning" | "error" | "hermes";
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}

export interface HermesLayoutOption {
  title: string;
  headline: string;
  description: string;
}

export interface QuoteItem {
  id: string;
  product: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

export interface Quote {
  id: string;
  code: string;
  clientName: string;
  company: string;
  email?: string;
  phone?: string;
  nif?: string;
  paymentTerms?: string;
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  taxIva: number;
  totalGeral: number;
  status: "Rascunho" | "Enviado" | "Pendente" | "Aprovado" | "Recusado" | "Expirado";
  date: string;
  dueDate: string;
  manager: string;
  notes?: string;
  isHermesGenerated?: boolean;
}

export interface AutomationNode {
  id: string;
  type: "trigger" | "action" | "condition" | "hermes";
  category: string;
  title: string;
  description: string;
  icon: string;
  bgClass?: string;
  textClass?: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  leadsCount: number;
  steps: AutomationNode[];
  createdAt: string;
}
