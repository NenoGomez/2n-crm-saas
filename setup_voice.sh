#!/usr/bin/env bash
# setup_voice.sh — Configura Twilio + ElevenLabs no CRM 2N
# Uso: bash /root/crm-saas/setup_voice.sh
set -e

ENV_FILE="/root/crm-saas/.env"
BAK="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"

echo "=============================================="
echo "  SETUP DE VOZ 2N — TWILIO + ELEVENLABS"
echo "=============================================="
echo

# 1) Twilio
echo "--- TWILIO ---"
read -rp "Twilio ACCOUNT SID (AC...): " TW_SID
read -rsp "Twilio AUTH TOKEN: " TW_TOKEN; echo
read -rp "Twilio NUMBER (+1... ou +244...): " TW_NUMBER

# 2) ElevenLabs
echo
echo "--- ELEVENLABS ---"
read -rsp "ElevenLabs API KEY (sk-... ou xi-...): " EL_KEY; echo
read -rp "ElevenLabs VOICE ID (deixa vazio p/ default Alice PT-BR): " EL_VOICE
EL_VOICE=${EL_VOICE:-"21m00Tcm4TlvDq8ikWAM"}

# 3) Public URL
read -rp "Public URL (default https://2npublicidade.online): " PUBLIC_URL
PUBLIC_URL=${PUBLIC_URL:-"https://2npublicidade.online"}

# Guardar em ficheiro seguro tambem (ja existe .twilio_key.txt)
echo "TWILIO_ACCOUNT_SID=$TW_SID" > /root/.twilio_key.txt
echo "TWILIO_AUTH_TOKEN=$TW_TOKEN" >> /root/.twilio_key.txt
echo "TWILIO_NUMBER=$TW_NUMBER" >> /root/.twilio_key.txt
chmod 600 /root/.twilio_key.txt

# Atualizar .env (com backup)
cp "$ENV_FILE" "$BAK"
echo "Backup: $BAK"

set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # substitui valor existente
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    # adiciona
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_env "TWILIO_ACCOUNT_SID" "$TW_SID"
set_env "TWILIO_AUTH_TOKEN" "$TW_TOKEN"
set_env "TWILIO_NUMBER" "$TW_NUMBER"
set_env "ELEVENLABS_API_KEY" "$EL_KEY"
set_env "ELEVENLABS_VOICE_ID" "$EL_VOICE"
set_env "PUBLIC_URL" "$PUBLIC_URL"

echo
echo "=============================================="
echo "  CONFIGURADO. A reiniciar o CRM..."
echo "=============================================="
systemctl restart crm-saas.service
sleep 3

# Verificar
echo "--- verificar health do módulo de voz ---"
curl -s --max-time 10 "http://localhost:8095/api/voice/calls" >/dev/null && echo "OK: /api/voice/calls responde" || echo "ERRO: endpoint nao responde"

echo
echo "Pronto! Agora configura no Twilio:"
echo "  Phone Numbers -> Manage -> (teu numero) -> Voice -> A call comes in"
echo "  URL: ${PUBLIC_URL}/api/voice/inbound  [POST]"
echo
echo "Para testar uma chamada outbound (confirmacao):"
echo "  curl -X POST ${PUBLIC_URL}/api/voice/outbound -H 'Content-Type: application/json' \\"
echo "    -d '{\"phone\":\"+244xxxxxx\",\"purpose\":\"confirmacao\",\"order_id\":\"PED-2026-000008\"}'"
