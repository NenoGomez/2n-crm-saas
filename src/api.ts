/**
 * Thin API layer for the 2N CRM SaaS.
 * All calls are prefixed with the Vite base (so it works under /crm/).
 * Every call is fail-safe: on error the caller keeps the local initialData,
 * so the UI never breaks when the API/DB is down.
 */

const BASE = (import.meta as any).env?.BASE_URL || "/";
export const apiUrl = (p: string) => `${BASE.replace(/\/$/, "")}/api${p.startsWith("/") ? p : `/${p}`}`;

async function req<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(apiUrl(path), {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export interface Bootstrap {
  clients: any[];
  deals: any[];
  conversations: any[];
  orders: any[];
  quotes: any[];
  tasks: any[];
  activities: any[];
  alerts: any[];
  automations: any[];
  companySettings: any | null;
  aiMode: string;
}

export const getBootstrap = () => req<Bootstrap>("/bootstrap");
export const health = () => req<any>("/health");

export const createClient = (c: any) => req("/clients", { method: "POST", body: JSON.stringify(c) });
export const updateClient = (c: any) => req(`/clients/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify(c) });
export const createDeal = (d: any) => req("/deals", { method: "POST", body: JSON.stringify(d) });
export const updateDeal = (d: any) => req(`/deals/${encodeURIComponent(d.id)}`, { method: "PUT", body: JSON.stringify(d) });
export const createOrder = (o: any) => req("/production", { method: "POST", body: JSON.stringify(o) });
export const updateOrder = (o: any) => req(`/production/${encodeURIComponent(o.id)}`, { method: "PUT", body: JSON.stringify(o) });
export const setOrderQuality = (id: string, status: string, note?: string) =>
  req(`/production/${encodeURIComponent(id)}/quality`, { method: "POST", body: JSON.stringify({ status, note }) });
export const decideFile = (orderId: string, fileId: string, action: "approve" | "reject") =>
  req(`/production/${encodeURIComponent(orderId)}/files/${encodeURIComponent(fileId)}/${action}`, { method: "POST" });
export const createQuote = (q: any) => req("/quotes", { method: "POST", body: JSON.stringify(q) });
export const updateQuote = (q: any) => req(`/quotes/${encodeURIComponent(q.id)}`, { method: "PUT", body: JSON.stringify(q) });
export const saveTask = (t: any) => req("/tasks", { method: "POST", body: JSON.stringify(t) });
export const logActivity = (a: any) => req("/activities", { method: "POST", body: JSON.stringify(a) });
export const saveSettings = (s: any) => req("/settings", { method: "PUT", body: JSON.stringify(s) });
export const getInvoices = () => req<any[]>("/invoices");
