#!/usr/bin/env python3
"""
Envia notificacao de producao ao CLIENTE via WhatsApp (Chatwoot).

Uso:
  notify_production.py --client "Nino Ferreira" --message "texto"
  echo '{"client":"...","message":"..."}' | notify_production.py --stdin

Saida: ENVIADO | NAO_ENCONTRADO | ERRO  (+ JSON na ultima linha)
"""
import argparse, json, re, subprocess, sys

PG = ["docker", "exec", "chatwoot-postgres-1", "psql", "-U", "postgres",
      "-d", "chatwoot_production", "-t", "-A", "-F", "|", "-c"]
WEB = ["docker", "exec", "chatwoot_web", "bundle", "exec", "rails", "runner"]


def sql(query):
    r = subprocess.run(PG + [query], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:300])
    return [l.split("|") for l in r.stdout.strip().splitlines() if l.strip()]


def esc_sql(s):
    return s.replace("'", "''")


def digits(s):
    return re.sub(r"\D", "", s or "")


def find_conversation(client):
    """Devolve conversation id do cliente (nome ou telefone), ou None."""
    name = esc_sql(client.strip())
    d = digits(client)
    rows = sql(
        "select c.id, ct.name, coalesce(ct.phone_number,'') from conversations c "
        "join contacts ct on ct.id=c.contact_id "
        f"where lower(ct.name) = lower('{name}') "
        "order by c.last_activity_at desc nulls last limit 1;")
    if not rows:
        rows = sql(
            "select c.id, ct.name, coalesce(ct.phone_number,'') from conversations c "
            "join contacts ct on ct.id=c.contact_id "
            f"where lower(ct.name) like lower('%{name}%') "
            "order by c.last_activity_at desc nulls last limit 1;")
    if not rows and len(d) >= 6:
        rows = sql(
            "select c.id, ct.name, coalesce(ct.phone_number,'') from conversations c "
            "join contacts ct on ct.id=c.contact_id "
            f"where regexp_replace(coalesce(ct.phone_number,''),'\\D','','g') like '%{d[-9:]}%' "
            "order by c.last_activity_at desc nulls last limit 1;")
    if not rows:
        return None, None
    return int(rows[0][0]), rows[0][1]


def send(conv_id, message):
    msg = message.replace("\\", "\\\\").replace("'", "''").replace("\n", " | ")
    cmd = (f"c = Conversation.find({conv_id}); "
           f"c.messages.create!(content: '{msg}', sender: User.find(1), "
           f"message_type: :outgoing, inbox: c.inbox, account: c.account, status: 'sent'); "
           f"puts 'ENVIADO'")
    r = subprocess.run(WEB + [cmd], capture_output=True, text=True, timeout=180)
    return "ENVIADO" in (r.stdout + r.stderr), (r.stdout + r.stderr)[-300:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--client")
    ap.add_argument("--message")
    ap.add_argument("--stdin", action="store_true")
    a = ap.parse_args()
    client, message = a.client, a.message
    if a.stdin or not (client and message):
        try:
            data = json.loads(sys.stdin.read() or "{}")
            client = client or data.get("client")
            message = message or data.get("message")
        except Exception:
            pass
    if not client or not message:
        print("ERRO"); print(json.dumps({"success": False, "reason": "missing args"})); return 2

    try:
        conv, cname = find_conversation(client)
    except Exception as e:
        print("ERRO"); print(json.dumps({"success": False, "reason": str(e)})); return 3

    if not conv:
        print("NAO_ENCONTRADO")
        print(json.dumps({"success": False, "reason": "no_chatwoot_conversation", "client": client}))
        return 0

    ok, out = send(conv, message)
    print("ENVIADO" if ok else "ERRO")
    print(json.dumps({"success": ok, "conversation_id": conv, "contact": cname,
                      "client": client, "detail": None if ok else out}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
