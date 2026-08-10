#!/usr/bin/env python3
"""
Envia mensagem para uma conversa do Chatwoot (entrega ao cliente via WhatsApp/Email).
Uso:
  chatwoot_send.py --conv 991 --message "texto"
  echo '{"conv":991,"message":"texto"}' | chatwoot_send.py --stdin
Saida: ENVIADO | ERRO (+ JSON)
"""
import argparse, json, subprocess, sys

WEB = ["docker", "exec", "chatwoot_web", "bundle", "exec", "rails", "runner"]

def esc(s):
    return (s or "").replace("\\", "\\\\").replace("'", "''").replace("\n", " | ")

def send(conv_id, message):
    msg = esc(message)
    cmd = (f"c = Conversation.find({conv_id}); "
           f"c.messages.create!(content: '{msg}', sender: User.find(1), "
           f"message_type: :outgoing, inbox: c.inbox, account: c.account, status: 'sent'); "
           f"puts 'ENVIADO'")
    r = subprocess.run(WEB + [cmd], capture_output=True, text=True, timeout=180)
    out = r.stdout + r.stderr
    return "ENVIADO" in out, out[-300:]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--conv", type=int)
    ap.add_argument("--message")
    ap.add_argument("--stdin", action="store_true")
    a = ap.parse_args()
    conv, message = a.conv, a.message
    if a.stdin or not (conv and message):
        try:
            d = json.loads(sys.stdin.read() or "{}")
            conv = conv or d.get("conv") or d.get("conversation_id")
            message = message or d.get("message") or d.get("text")
        except Exception:
            pass
    if not conv or not message:
        print("ERRO"); print(json.dumps({"success": False, "reason": "missing args"})); return 2
    ok, out = send(int(conv), message)
    print("ENVIADO" if ok else "ERRO")
    print(json.dumps({"success": ok, "conversation_id": int(conv),
                      "detail": None if ok else out}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
