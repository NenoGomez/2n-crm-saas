import { q } from "./db";
import {
  initialClients,
  initialDeals,
  initialConversations,
  initialOrders,
  initialActivities,
  initialAlerts,
  initialTasks,
  initialQuotes,
  initialAutomations,
  initialCompanySettings,
} from "../data/initialData";

export async function seedIfEmpty() {
  const { rows } = await q("SELECT count(*)::int AS n FROM clients");
  if (rows[0].n > 0) return false;

  for (const c of initialClients) {
    await q(
      `INSERT INTO clients (id,name,company,phone,email,segment,last_purchase,total_spent,orders_count,manager,status,is_vip,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.name, c.company, c.phone, c.email || null, c.segment || null, c.lastPurchase,
       c.totalSpent, c.ordersCount, c.manager, c.status, !!c.isVip, JSON.stringify(c)]
    );
  }
  for (const d of initialDeals) {
    await q(
      `INSERT INTO deals (id,title,company,service,estimated_value,stage,priority,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [d.id, d.title, d.company, d.service, d.estimatedValue, d.stage, d.priority, JSON.stringify(d)]
    );
  }
  for (const cv of initialConversations) {
    const { messages, ...head } = cv as any;
    await q(
      `INSERT INTO conversations (id,client_id,client_name,company,channel,last_message,last_message_time,unread_count,stage,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [cv.id, cv.clientId, cv.clientName, cv.company, cv.channel, cv.lastMessage,
       cv.lastMessageTime, cv.unreadCount, cv.stage || null, JSON.stringify(head)]
    );
    for (const m of messages || []) {
      await q(
        `INSERT INTO chat_messages (id,conversation_id,sender,text,timestamp,status)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [`${cv.id}-${m.id}`, cv.id, m.sender, m.text, m.timestamp, m.status || null]
      );
    }
  }
  for (const o of initialOrders) {
    const { files, ...head } = o as any;
    await q(
      `INSERT INTO production_orders (id,client_name,product_description,stage,due_date,status_badge,quality_status,quality_note,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [o.id, o.clientName, o.productDescription, o.stage, o.dueDate, o.statusBadge || null,
       o.qualityStatus || "PENDENTE", o.qualityNote || null, JSON.stringify(head)]
    );
    for (const f of files || []) {
      await q(
        `INSERT INTO production_files (id,order_id,name,size,type,url,uploaded_at,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [`${o.id}-${f.id}`, o.id, f.name, f.size, f.type, f.url || null, f.uploadedAt, f.status || "Pendente"]
      );
    }
  }
  for (const qt of initialQuotes) {
    await q(
      `INSERT INTO quotes (id,code,client_name,company,status,total_geral,date,due_date,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [qt.id, qt.code, qt.clientName, qt.company, qt.status, qt.totalGeral, qt.date, qt.dueDate, JSON.stringify(qt)]
    );
    // Derive a proforma/invoice shadow record for the Financeiro module
    await q(
      `INSERT INTO invoices (id,kind,code,client_name,status,total,date,due_date,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [`inv-${qt.id}`, "proforma", qt.code.replace("ORC", "PRF"), qt.clientName,
       qt.status === "Aprovado" ? "Paga" : "Pendente", qt.totalGeral, qt.date, qt.dueDate, JSON.stringify(qt)]
    );
  }
  for (const t of initialTasks) {
    await q(`INSERT INTO tasks (id,title,completed,due_date,doc) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.title, t.completed, t.dueDate || null, JSON.stringify(t)]);
  }
  for (const a of initialActivities) {
    await q(`INSERT INTO activities (id,title,subtitle,time_ago,type) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [a.id, a.title, a.subtitle, a.timeAgo, a.type]);
  }
  for (const a of initialAlerts) {
    await q(`INSERT INTO alerts (id,title,subtitle,type) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [a.id, a.title, a.subtitle, a.type]);
  }
  for (const w of initialAutomations) {
    await q(`INSERT INTO automations (id,name,description,is_active,leads_count,doc) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [w.id, w.name, w.description, w.isActive, w.leadsCount, JSON.stringify(w)]);
  }
  await q(`INSERT INTO company_settings (id,doc) VALUES (1,$1) ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(initialCompanySettings)]);

  return true;
}
