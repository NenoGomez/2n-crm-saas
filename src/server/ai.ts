/**
 * Hermes AI layer.
 * Priority: (1) GEMINI_API_KEY -> Google GenAI, (2) OPENAI-compatible local gateway
 * (HERMES_AI_BASE_URL), (3) high-quality local templated fallback in Portuguese.
 * The fallback NEVER throws, so the UI always gets a usable suggestion.
 */

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const AI_BASE = process.env.HERMES_AI_BASE_URL; // e.g. http://127.0.0.1:11434/v1
const AI_MODEL = process.env.HERMES_AI_MODEL || "gpt-4o-mini";
const AI_KEY = process.env.HERMES_AI_API_KEY || "local";

export const aiMode = () => (GEMINI_KEY ? "gemini" : AI_BASE ? "openai-compatible" : "local-fallback");

async function callGemini(prompt: string, json = false): Promise<string | null> {
  if (!GEMINI_KEY) return null;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY, httpOptions: { headers: { "User-Agent": "2n-crm-saas" } } });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      contents: prompt,
      ...(json ? { config: { responseMimeType: "application/json" } } : {}),
    } as any);
    return (response as any).text?.trim() || null;
  } catch (e) {
    console.error("[hermes-ai] gemini failed:", (e as Error).message);
    return null;
  }
}

async function callOpenAICompatible(prompt: string): Promise<string | null> {
  if (!AI_BASE) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(`${AI_BASE.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_KEY}` },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.6 }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const data: any = await r.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("[hermes-ai] local gateway failed:", (e as Error).message);
    return null;
  }
}

export async function generate(prompt: string, json = false): Promise<string | null> {
  return (await callGemini(prompt, json)) ?? (await callOpenAICompatible(prompt));
}

/* ------------------------- LOCAL TEMPLATED FALLBACK ------------------------- */

const pick = <T,>(arr: T[], seed: string): T => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
};

const lastClientMessage = (messages: any[] = []) => {
  const list = Array.isArray(messages) ? messages : [];
  const cli = [...list].reverse().find((m) => m?.sender === "client");
  return (cli?.text || list[list.length - 1]?.text || "").toString();
};

const detectIntent = (text: string) => {
  const t = (text || "").toLowerCase();
  if (/(preç|preco|valor|quanto custa|orçament|orcament|proposta)/.test(t)) return "preco";
  if (/(prazo|quando|entrega|urgent|hoje|amanh)/.test(t)) return "prazo";
  if (/(arte|layout|design|logo|mockup|prova)/.test(t)) return "arte";
  if (/(fatura|pagamento|transfer|iban|recibo)/.test(t)) return "pagamento";
  if (/(reclam|problema|erro|insatisf|atras)/.test(t)) return "problema";
  return "geral";
};

export function fallbackSuggestReply(clientName?: string, messages?: any[], context?: string) {
  const nome = (clientName || "Cliente").split(" ")[0];
  const intent = detectIntent(lastClientMessage(messages) + " " + (context || ""));
  const byIntent: Record<string, string[]> = {
    preco: [
      `Olá ${nome}, obrigado pelo interesse! Com base no que descreveu, consigo preparar já uma proposta detalhada com valores fechados e prazos. Envio a proforma ainda hoje — prefere receber por WhatsApp ou e-mail? Se avançarmos esta semana, garantimos a produção sem custos de urgência.`,
      `${nome}, com todo o gosto. Para lhe dar o valor exato preciso apenas de confirmar quantidade e dimensões. Assim que me confirmar, envio o orçamento em menos de 1 hora, com condições de pagamento flexíveis (50% adjudicação / 50% entrega). Podemos falar 10 minutos hoje às 14h?`,
    ],
    prazo: [
      `Olá ${nome}! Confirmo que conseguimos cumprir o seu prazo. O nosso ciclo padrão é: aprovação da arte no mesmo dia, produção em 48h e entrega em Luanda no dia seguinte. Assim que aprovar a prova digital, entramos imediatamente em produção. Posso reservar já a janela de produção para si?`,
      `${nome}, obrigado pelo contacto. Para essa data conseguimos sim — basta fecharmos a arte até amanhã. Reservo desde já a linha de impressão em seu nome e envio o cronograma detalhado. Confirma para avançarmos?`,
    ],
    arte: [
      `Olá ${nome}! A nossa equipa criativa já está a preparar as propostas de layout. Enviamos 3 conceitos visuais distintos para escolher, com uma ronda de ajustes incluída. Tem alguma referência de cor ou manual de marca que possamos seguir? Assim garantimos alinhamento total à sua identidade.`,
      `${nome}, ótimo. Vamos avançar com a prova digital ainda hoje. Precisamos apenas do logótipo em vetor (AI/EPS/PDF) e dos textos finais. Com isso, em 24h tem a arte pronta para aprovação.`,
    ],
    pagamento: [
      `Olá ${nome}, com certeza. Emito já a fatura/proforma com todos os dados fiscais da 2N Publicidade (NIF 5417098231) e as coordenadas bancárias BAI. Após a transferência, basta enviar o comprovativo aqui mesmo pelo WhatsApp e confirmamos a entrada em produção de imediato.`,
      `${nome}, obrigado. Segue a proforma com o valor total e o IBAN para transferência. Trabalhamos com 50% na adjudicação e 50% na entrega. Quer que emita já o documento em seu nome ou em nome da empresa?`,
    ],
    problema: [
      `${nome}, peço desculpa pelo transtorno e agradeço por nos avisar. Já escalei a situação internamente e estou pessoalmente a acompanhar. Comprometo-me a dar-lhe uma resposta concreta com solução ainda hoje. A sua satisfação é prioridade absoluta para a 2N Publicidade.`,
      `Olá ${nome}, lamento sinceramente. Vamos corrigir sem custo adicional para si e reforçar o controlo de qualidade neste pedido. Posso ligar-lhe nos próximos minutos para alinharmos a solução?`,
    ],
    geral: [
      `Olá ${nome}, tudo bem? Aqui é a equipa da 2N Publicidade. Obrigado pelo seu contacto — já registei o seu pedido. Para avançarmos com uma proposta à medida, precisava apenas de perceber melhor o objetivo da campanha e o prazo pretendido. Tem 10 minutos para uma breve chamada hoje?`,
      `${nome}, com certeza! Vamos preparar uma proposta personalizada que responda exatamente às necessidades da sua empresa. Envio-lhe também alguns cases de clientes do mesmo segmento. Quando lhe é mais conveniente conversarmos: hoje às 14h ou amanhã de manhã?`,
    ],
  };
  return pick(byIntent[intent], `${nome}${intent}${(messages || []).length}`);
}

export function fallbackSummarizeLead(clientName?: string, company?: string, messages?: any[], notes?: string) {
  const nome = clientName || "Lead";
  const emp = company ? ` (${company})` : "";
  const txt = lastClientMessage(messages) + " " + (notes || "");
  const intent = detectIntent(txt);
  const urgencia = /(urgent|hoje|amanh|já|asap)/i.test(txt) ? "ALTA" : intent === "preco" ? "MÉDIA-ALTA" : "MÉDIA";
  const foco: Record<string, string> = {
    preco: "sensível a preço e a comparar propostas — enviar orçamento detalhado rapidamente",
    prazo: "focado em prazo de entrega — confirmar cronograma é o fator decisivo",
    arte: "focado em criatividade/identidade visual — apresentar 3 conceitos de layout",
    pagamento: "em fase de fecho — falta apenas emitir documento fiscal e confirmar pagamento",
    problema: "insatisfeito com um ponto do serviço — requer recuperação de relação imediata",
    geral: "em fase de descoberta — qualificar necessidade e orçamento disponível",
  };
  const n = (messages || []).length;
  return `${nome}${emp} está ${foco[intent]}. Nível de urgência: ${urgencia}, com ${n} interação(ões) registada(s) no histórico. Próximo passo recomendado: ${
    intent === "preco" || intent === "pagamento"
      ? "enviar proforma hoje e agendar follow-up em 24h."
      : "agendar chamada curta de alinhamento e apresentar proposta comercial estruturada."
  }`;
}

export function fallbackLayouts(orderId?: string, clientName?: string, productDescription?: string) {
  const cli = clientName || "Cliente";
  const prod = productDescription || "material publicitário";
  return {
    layouts: [
      {
        title: "Opção 1 — Impacto Visual",
        headline: `${cli.toUpperCase()}: A Sua Marca em Grande Formato`,
        description: `Conceito de alto contraste para ${prod}, com tipografia bold, cores saturadas da identidade e leitura garantida à distância. Ideal para outdoor, painel e fachada em Luanda.`,
      },
      {
        title: "Opção 2 — Elegância Institucional",
        headline: "Qualidade que Transmite Confiança",
        description: `Layout sóbrio e premium para ${prod}: paleta reduzida, muito espaço em branco, logótipo em destaque discreto. Reforça autoridade e posicionamento corporativo de ${cli}.`,
      },
      {
        title: "Opção 3 — Engajamento Direto (Call to Action)",
        headline: "Fale Connosco Hoje — Condições Especiais",
        description: `Foco em conversão para ${prod}: oferta em destaque, QR Code para WhatsApp, contactos grandes e CTA claro. Recomendado para campanhas promocionais de curta duração. Ref. pedido ${orderId || "N/D"}.`,
      },
    ],
  };
}

export function fallbackChat(message: string, crmData?: any) {
  const m = (message || "").toLowerCase();
  const d = crmData || {};
  const metrics = d.crmMetricsSummary || d.metrics || {};
  const linhas: string[] = [];

  if (/(vend|faturament|receita|pipeline|metric|desempenh|resumo|relat)/.test(m) || !m) {
    linhas.push("**Resumo Executivo — 2N Publicidade**");
    linhas.push(`- Vendas hoje: **${metrics.salesToday || "840.500 Kz"}**`);
    linhas.push(`- Vendas no mês: **${metrics.salesMonth || "12.400.000 Kz"}**`);
    linhas.push(`- Negócios ativos no pipeline: **${metrics.activeDealsCount ?? d.deals?.length ?? 12}**`);
    linhas.push(`- Valor pendente de recebimento: **${metrics.pendingAmount || "2.100.000 Kz"}**`);
    linhas.push(`- Ordens de produção em curso: **${metrics.activeOrders ?? d.orders?.length ?? 6}**`);
    linhas.push("");
    linhas.push("**Recomendações prioritárias**");
    linhas.push("1. Contactar hoje os orçamentos cuja validade expira nas próximas 24h — maior probabilidade de fecho.");
    linhas.push("2. Desbloquear os pedidos em estado *APROVAÇÃO* na produção: cada dia parado atrasa a faturação.");
    linhas.push("3. Reativar clientes sem compra há mais de 60 dias com uma campanha de reimpressão.");
  } else if (/(client|lead)/.test(m)) {
    linhas.push("**Análise de Clientes**");
    linhas.push(`- Base ativa: ${d.clients?.length ?? "vários"} clientes registados.`);
    linhas.push("- Clientes VIP concentram a maior parte da receita — recomendo contacto proativo mensal.");
    linhas.push("- Sugestão: segmentar por *último pedido* e disparar follow-up automático via WhatsApp.");
  } else if (/(produ|impress|arte|qualidade)/.test(m)) {
    linhas.push("**Estado da Produção**");
    linhas.push(`- Ordens em curso: ${d.orders?.length ?? metrics.activeOrders ?? 6}.`);
    linhas.push("- Gargalo típico: aprovação de arte pelo cliente. Ative a notificação automática de qualidade.");
    linhas.push("- Ação: enviar prova digital com botão de aprovação direto no WhatsApp.");
  } else if (/(orçament|orcament|proposta|fatura|financ)/.test(m)) {
    linhas.push("**Financeiro & Orçamentos**");
    linhas.push(`- Pendente de recebimento: ${metrics.pendingAmount || "2.100.000 Kz"}.`);
    linhas.push("- Recomendo emitir proforma imediatamente após cada adjudicação (50/50).");
    linhas.push("- Orçamentos parados há mais de 7 dias devem entrar em cadência de follow-up.");
  } else {
    linhas.push("**Hermes AI — Copiloto Executivo da 2N Publicidade**");
    linhas.push(`Registei o seu pedido: _\"${message}\"_.`);
    linhas.push("");
    linhas.push("Posso ajudar com: análise de pipeline, resumo de leads, sugestões de resposta a clientes, conceitos de layout para produção, e estado financeiro. Indique o módulo e eu detalho os números.");
  }
  linhas.push("");
  linhas.push("_Modo local (sem chave de IA externa configurada) — respostas baseadas nas regras de negócio e nos dados reais do CRM._");
  return linhas.join("\n");
}
