#!/usr/bin/env python3
"""
Sincroniza conversas reais do Chatwoot -> CRM (Postgres crm_saas).
Exporta via `rails runner` (Chatwoot) e insere/atualiza em conversations + chat_messages.

Uso:
  chatwoot_sync.py            # sincroniza tudo (limit 50 conv, 200 msgs/conv)
  chatwoot_sync.py --conv 991 # sincroniza so uma conversa
"""
import argparse, json, subprocess, sys

WEB = ["docker", "exec", "chatwoot_web", "bundle", "exec", "rails", "runner"]
# CRM Postgres acessivel no host (127.0.0.1)
CRM = ["psql", "-h", "127.0.0.1", "-U", "crm_saas", "-d", "crm_saas", "-t", "-A", "-F", "\t", "-c"]

RAILS_EXPORT = """
limit_n = (ARGV[0] || 50).to_i
conv_filter = ARGV[1]
conv_ids = []
if conv_filter.present?
  conv_ids = [conv_filter.to_i]
end
scope = Conversation.order(last_activity_at: :desc)
unless conv_ids.empty?
  scope = scope.where(id: conv_ids)
else
  scope = scope.limit(limit_n)
end
out = []
scope.each do |c|
  contact = c.contact
  inbox = c.inbox
  last_msg = c.messages.order(created_at: :desc).first
  msgs = c.messages.order(created_at: :asc).limit(200).map do |m|
    { id: "cw-#{m.id}", sender: (m.sender_type == 'User' ? 'agent' : 'client'),
      text: m.content.to_s, timestamp: (m.created_at&.iso8601 || ''),
      status: (m.status || 'sent') }
  end
  out << {
    id: c.id,
    contact_name: (contact&.name || 'Cliente'),
    phone: (contact&.phone_number || ''),
    email: (contact&.email || ''),
    channel: (inbox&.channel_type == 'Channel::Whatsapp' ? 'whatsapp' : (inbox&.name || 'chat')),
    inbox: (inbox&.name || ''),
    last_message: (last_msg&.content || '').to_s,
    last_message_time: (c.last_activity_at&.iso8601 || ''),
    unread: 0,
    messages: msgs
  }
end
puts '___JSON_START___'
puts out.to_json
puts '___JSON_END___'
"""

def esc(s):
    return (s or "").replace("'", "''").replace("\\", "\\\\")

def run_export(limit=50, conv=None):
    args = [str(limit)]
    if conv:
        args.append(str(conv))
    r = subprocess.run(WEB + [RAILS_EXPORT] + args, capture_output=True, text=True, timeout=180)
    out = r.stdout + r.stderr
    if "___JSON_START___" in out:
        blob = out.split("___JSON_START___", 1)[1].split("___JSON_END___", 1)[0].strip()
        return json.loads(blob)
    raise RuntimeError("rails export falhou: " + out[-400:])

def upsert(conv):
    cid = conv["id"]
    name = esc(conv["contact_name"])
    phone = esc(conv["phone"])
    email = esc(conv["email"])
    channel = esc(conv["channel"])
    inbox = esc(conv["inbox"])
    last = esc((conv["last_message"] or "")[:500])
    lmt = conv["last_message_time"] or "now()"
    # customer resolve
    r1 = subprocess.run(CRM + [
        f"INSERT INTO customers (customer_id,name,phone,email,status) VALUES ('CUS-SYNC-{cid}','{name}','{phone}','{email}','Ativo') "
        f"ON CONFLICT (customer_id) DO UPDATE SET name=EXCLUDED.name, phone=EXCLUDED.phone, email=EXCLUDED.email RETURNING customer_id;"
    ], capture_output=True, text=True, timeout=60)
    if r1.returncode != 0:
        sys.stderr.write(f"[cust {cid}] {r1.stderr[-200:]}\n")
    cust = f"CUS-SYNC-{cid}"
    # conversation
    r2 = subprocess.run(CRM + [
        f"INSERT INTO conversations (conversation_id, customer_id, channel, last_message, last_message_time, unread_count, doc) "
        f"VALUES ('{cid}','{cust}','{channel}','{last}','{lmt}',{int(conv['unread'] or 0)},'{{\"source\":\"chatwoot\"}}') "
        f"ON CONFLICT (conversation_id) DO UPDATE SET customer_id=EXCLUDED.customer_id, channel=EXCLUDED.channel, "
        f"last_message=EXCLUDED.last_message, last_message_time=EXCLUDED.last_message_time, unread_count=EXCLUDED.unread_count;"
    ], capture_output=True, text=True, timeout=60)
    if r2.returncode != 0:
        sys.stderr.write(f"[conv {cid}] {r2.stderr[-200:]}\n")
    # messages
    for m in conv["messages"]:
        mid = esc(m["id"])
        sender = esc(m["sender"])
        txt = esc((m["text"] or "")[:2000])
        ts = m["timestamp"] or "now()"
        status = esc(m.get("status") or "sent")
        subprocess.run(CRM + [
            f"INSERT INTO chat_messages (id, conversation_id, sender, text, timestamp, status) "
            f"VALUES ('{mid}','{cid}','{sender}','{txt}','{ts}','{status}') "
            f"ON CONFLICT (id) DO NOTHING;"
        ], capture_output=True, text=True, timeout=30)
    return cust

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--conv", type=int, default=None)
    a = ap.parse_args()
    try:
        convs = run_export(a.limit, a.conv)
    except Exception as e:
        print("ERRO"); print(json.dumps({"success": False, "reason": str(e)})); return 3
    synced = 0
    for c in convs:
        try:
            upsert(c); synced += 1
        except Exception as e:
            sys.stderr.write(f"falha conv {c.get('id')}: {e}\n")
    print(json.dumps({"success": True, "synced": synced, "total": len(convs)}))

if __name__ == "__main__":
    sys.exit(main())
