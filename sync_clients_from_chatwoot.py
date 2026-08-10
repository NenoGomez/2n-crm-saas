#!/usr/bin/env python3
"""
Auto-popula os clientes do CRM a partir dos contactos/conversas do Chatwoot.

- Le contactos com conversa no Chatwoot (Postgres, via docker exec psql)
- Compara com GET /api/clients (match por telefone normalizado, senao por nome)
- Cria (POST) novos ou actualiza (PUT) existentes SEM duplicar
Imprime resumo JSON.
"""
import json, re, subprocess, sys, urllib.request

CRM = "http://localhost:8095/api"
PG = ["docker", "exec", "chatwoot-postgres-1", "psql", "-U", "postgres",
      "-d", "chatwoot_production", "-t", "-A", "-F", "|", "-c"]
SKIP_NAMES = {"nino ferreira"}  # dono, nao e cliente


def digits(s):
    return re.sub(r"\D", "", s or "")


def chatwoot_contacts(limit=500):
    q = ("select distinct on (ct.id) ct.id, coalesce(ct.name,''), "
         "coalesce(ct.phone_number,''), coalesce(ct.email,''), "
         "coalesce(co.name,''), to_char(coalesce(ct.last_activity_at, ct.created_at),'YYYY-MM-DD') "
         "from contacts ct join conversations c on c.contact_id = ct.id "
         "left join companies co on co.id = ct.company_id "
         "order by ct.id desc limit %d;" % limit)
    r = subprocess.run(PG + [q], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:300])
    out = []
    for line in r.stdout.strip().splitlines():
        p = line.split("|")
        if len(p) < 6:
            continue
        out.append({"cw_id": p[0], "name": p[1].strip(), "phone": p[2].strip(),
                    "email": p[3].strip(), "company": p[4].strip(), "last": p[5].strip()})
    return [c for c in out if c["name"] or c["phone"]]


def api(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(CRM + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read().decode()
    return json.loads(body) if body.strip() else {}


def main():
    contacts = chatwoot_contacts()
    existing = api("GET", "/clients")
    by_phone = {digits(c.get("phone"))[-9:]: c for c in existing if digits(c.get("phone"))}
    by_name = {(c.get("name") or "").strip().lower(): c for c in existing}

    created, updated, skipped = [], [], []
    for ct in contacts:
        if ct["name"].lower() in SKIP_NAMES:
            skipped.append(ct["name"]); continue
        d = digits(ct["phone"])[-9:]
        match = by_phone.get(d) if d else None
        if not match:
            match = by_name.get(ct["name"].lower())
        payload = {
            "name": ct["name"] or ct["phone"],
            "company": ct["company"] or (match or {}).get("company") or "—",
            "phone": ct["phone"] or (match or {}).get("phone") or "",
            "email": ct["email"] or (match or {}).get("email") or None,
            "source": "chatwoot",
            "chatwootContactId": ct["cw_id"],
        }
        if match:
            merged = {**match, **{k: v for k, v in payload.items() if v}}
            merged["id"] = match["id"]
            api("PUT", "/clients/" + match["id"], merged)
            updated.append(merged["name"])
        else:
            payload.update({"status": "Ativo", "manager": "—",
                            "lastPurchase": ct["last"] or "—",
                            "segment": "WhatsApp", "totalSpent": 0, "ordersCount": 0})
            res = api("POST", "/clients", payload)
            by_phone[d] = res if d else by_phone.get(d)
            by_name[payload["name"].lower()] = res
            created.append(payload["name"])

    print(json.dumps({"success": True, "chatwoot_contacts": len(contacts),
                      "created": created, "updated": updated, "skipped": skipped},
                     ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
