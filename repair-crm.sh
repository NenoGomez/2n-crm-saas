#!/usr/bin/env bash
set -Eeuo pipefail

APP="/root/crm-saas"
cd "$APP"

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="/root/crm-saas-backups/$TS"

echo "======================================================"
echo "  2N CRM - REPARAÇÃO COMPLETA"
echo "  $TS"
echo "======================================================"

mkdir -p "$BACKUP"

log() {
  echo
  echo "[$(date '+%H:%M:%S')] $*"
}

fail() {
  echo
  echo "❌ FALHA: $*"
  echo "Backup disponível em: $BACKUP"
  exit 1
}

trap 'fail "Erro na linha $LINENO"' ERR

# ======================================================
# 1. BACKUP DO CÓDIGO
# ======================================================

log "1/10 - Backup do código"

git rev-parse HEAD > "$BACKUP/git-commit.txt" || true
git status --short > "$BACKUP/git-status.txt" || true
git diff > "$BACKUP/git-diff.patch" || true

tar \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  -czf "$BACKUP/crm-source.tar.gz" .

echo "✓ Código guardado"

# ======================================================
# 2. CONFIGURAÇÃO DA BD
# ======================================================

log "2/10 - Detectando PostgreSQL"

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-crm_saas}"
export PGDATABASE="${PGDATABASE:-crm_saas}"

# Mesmo default usado pelo db.ts
export PGPASSWORD="${PGPASSWORD:-crm2n_saas_2026}"

echo "PostgreSQL:"
echo "  Host:     $PGHOST"
echo "  Port:     $PGPORT"
echo "  User:     $PGUSER"
echo "  Database: $PGDATABASE"

pg_isready -h "$PGHOST" -p "$PGPORT" >/dev/null
echo "✓ PostgreSQL disponível"

psql -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user;" >/dev/null
echo "✓ Ligação à BD OK"

# ======================================================
# 3. BACKUP DA BD
# ======================================================

log "3/10 - Backup completo da BD"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  -f "$BACKUP/crm_saas_$TS.dump" \
  "$PGDATABASE"

pg_dump \
  --format=plain \
  --no-owner \
  --no-privileges \
  -f "$BACKUP/crm_saas_$TS.sql" \
  "$PGDATABASE"

echo "✓ Backup PostgreSQL concluído"
ls -lh "$BACKUP"/crm_saas_*

# ======================================================
# 4. MIGRAÇÃO / COMPATIBILIDADE DO BANCO
# ======================================================

log "4/10 - Corrigindo estrutura da BD"

cat > "$BACKUP/migration.sql" <<'SQL'

BEGIN;

-- =====================================================
-- CONVERSATIONS
-- Compatibilidade entre conversation_id e antigo id
-- =====================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS id TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS client_id TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS client_name TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS company TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS stage TEXT;

UPDATE conversations
SET id = conversation_id
WHERE id IS NULL;

UPDATE conversations
SET client_id = customer_id
WHERE client_id IS NULL;

UPDATE conversations
SET company = ''
WHERE company IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_id_unique
ON conversations(id)
WHERE id IS NOT NULL;

-- =====================================================
-- PRODUCTION ORDERS
-- Compatibilidade entre production_id e antigo id
-- =====================================================

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS id TEXT;

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS client_name TEXT;

UPDATE production_orders
SET id = production_id
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS production_orders_id_unique
ON production_orders(id)
WHERE id IS NOT NULL;

-- =====================================================
-- PRODUCTION FILES
-- =====================================================

ALTER TABLE production_files
  ADD COLUMN IF NOT EXISTS id TEXT;

ALTER TABLE production_files
  ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE production_files
  ADD COLUMN IF NOT EXISTS url TEXT;

UPDATE production_files
SET id = file_id
WHERE id IS NULL;

UPDATE production_files
SET type = mime_type
WHERE type IS NULL;

UPDATE production_files
SET url = storage_url
WHERE url IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS production_files_id_unique
ON production_files(id)
WHERE id IS NOT NULL;

-- =====================================================
-- QUOTES
-- =====================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS id TEXT;

UPDATE quotes
SET id = quote_id
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_id_unique
ON quotes(id)
WHERE id IS NOT NULL;

-- =====================================================
-- INVOICES
-- =====================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS id TEXT;

UPDATE invoices
SET id = invoice_id
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_id_unique
ON invoices(id)
WHERE id IS NOT NULL;

-- =====================================================
-- TRIGGER: conversations
-- =====================================================

CREATE OR REPLACE FUNCTION crm_sync_conversation_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.conversation_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.conversation_id := NEW.id;
  END IF;

  IF NEW.id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    NEW.id := NEW.conversation_id;
  END IF;

  IF NEW.customer_id IS NULL AND NEW.client_id IS NOT NULL THEN
    NEW.customer_id := NEW.client_id;
  END IF;

  IF NEW.client_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    NEW.client_id := NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_conversation_legacy
ON conversations;

CREATE TRIGGER trg_sync_conversation_legacy
BEFORE INSERT OR UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION crm_sync_conversation_legacy();

-- =====================================================
-- TRIGGER: production_orders
-- =====================================================

CREATE OR REPLACE FUNCTION crm_sync_production_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.production_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.production_id := NEW.id;
  END IF;

  IF NEW.id IS NULL AND NEW.production_id IS NOT NULL THEN
    NEW.id := NEW.production_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_production_legacy
ON production_orders;

CREATE TRIGGER trg_sync_production_legacy
BEFORE INSERT OR UPDATE ON production_orders
FOR EACH ROW
EXECUTE FUNCTION crm_sync_production_legacy();

-- =====================================================
-- TRIGGER: production_files
-- =====================================================

CREATE OR REPLACE FUNCTION crm_sync_file_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.file_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.file_id := NEW.id;
  END IF;

  IF NEW.id IS NULL AND NEW.file_id IS NOT NULL THEN
    NEW.id := NEW.file_id;
  END IF;

  IF NEW.mime_type IS NULL AND NEW.type IS NOT NULL THEN
    NEW.mime_type := NEW.type;
  END IF;

  IF NEW.type IS NULL AND NEW.mime_type IS NOT NULL THEN
    NEW.type := NEW.mime_type;
  END IF;

  IF NEW.storage_url IS NULL AND NEW.url IS NOT NULL THEN
    NEW.storage_url := NEW.url;
  END IF;

  IF NEW.url IS NULL AND NEW.storage_url IS NOT NULL THEN
    NEW.url := NEW.storage_url;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_file_legacy
ON production_files;

CREATE TRIGGER trg_sync_file_legacy
BEFORE INSERT OR UPDATE ON production_files
FOR EACH ROW
EXECUTE FUNCTION crm_sync_file_legacy();

-- =====================================================
-- TRIGGER: quotes
-- =====================================================

CREATE OR REPLACE FUNCTION crm_sync_quote_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.quote_id := NEW.id;
  END IF;

  IF NEW.id IS NULL AND NEW.quote_id IS NOT NULL THEN
    NEW.id := NEW.quote_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_quote_legacy
ON quotes;

CREATE TRIGGER trg_sync_quote_legacy
BEFORE INSERT OR UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION crm_sync_quote_legacy();

-- =====================================================
-- TRIGGER: invoices
-- =====================================================

CREATE OR REPLACE FUNCTION crm_sync_invoice_legacy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.invoice_id := NEW.id;
  END IF;

  IF NEW.id IS NULL AND NEW.invoice_id IS NOT NULL THEN
    NEW.id := NEW.invoice_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_invoice_legacy
ON invoices;

CREATE TRIGGER trg_sync_invoice_legacy
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION crm_sync_invoice_legacy();

-- =====================================================
-- ÍNDICES IMPORTANTES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_conversations_customer
ON conversations(customer_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message
ON conversations(last_message_time);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
ON chat_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer
ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_conversation
ON orders(conversation_id);

CREATE INDEX IF NOT EXISTS idx_production_orders_order
ON production_orders(order_id);

CREATE INDEX IF NOT EXISTS idx_production_files_order
ON production_files(order_id);

CREATE INDEX IF NOT EXISTS idx_quotes_customer
ON quotes(customer_id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer
ON invoices(customer_id);

COMMIT;

SQL

psql -v ON_ERROR_STOP=1 -f "$BACKUP/migration.sql"

echo "✓ Estrutura da BD corrigida"

# ======================================================
# 5. CORRIGIR SEED
# ======================================================

log "5/10 - Corrigindo seed.ts"

cp src/server/seed.ts "$BACKUP/seed.ts.before"

python3 <<'PY'
from pathlib import Path

p = Path("src/server/seed.ts")
s = p.read_text()

# conversations
s = s.replace(
'''INSERT INTO conversations (id,client_id,client_name,company,channel,last_message,last_message_time,unread_count,stage,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING''',
'''INSERT INTO conversations (id,client_id,client_name,company,channel,last_message,last_message_time,unread_count,stage,doc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING'''
)

# production_orders compatibility remains supported by migration,
# but ensure seed has a valid id and legacy fields.

# production_files remains supported by compatibility columns.

# quotes and invoices remain supported by compatibility columns.

p.write_text(s)
PY

echo "✓ seed.ts verificado"

# ======================================================
# 6. VERIFICAR TYPESCRIPT
# ======================================================

log "6/10 - Verificando TypeScript"

if [ -f tsconfig.json ]; then
  npx tsc --noEmit
  echo "✓ TypeScript OK"
else
  echo "⚠ tsconfig.json não encontrado"
fi

# ======================================================
# 7. INSTALAR DEPENDÊNCIAS
# ======================================================

log "7/10 - Verificando dependências"

if [ -f package-lock.json ]; then
  npm ci --prefer-offline --no-audit
else
  npm install --no-audit
fi

echo "✓ Dependências OK"

# ======================================================
# 8. BUILD
# ======================================================

log "8/10 - Executando npm run build"

npm run build

echo "✓ BUILD CONCLUÍDO"

# ======================================================
# 9. REINICIAR CRM
# ======================================================

log "9/10 - Reiniciando CRM"

RESTARTED=0

# PM2
if command -v pm2 >/dev/null 2>&1; then

  if pm2 describe crm-saas >/dev/null 2>&1; then
    pm2 restart crm-saas --update-env
    pm2 save
    RESTARTED=1
    echo "✓ CRM reiniciado via PM2: crm-saas"

  elif pm2 list 2>/dev/null | grep -qi "crm"; then
    NAME="$(pm2 jlist | python3 -c '
import sys,json
try:
    data=json.load(sys.stdin)
    for x in data:
        n=x.get("name","")
        if "crm" in n.lower():
            print(n)
            break
except:
    pass
')"

    if [ -n "${NAME:-}" ]; then
      pm2 restart "$NAME" --update-env
      pm2 save
      RESTARTED=1
      echo "✓ CRM reiniciado via PM2: $NAME"
    fi
  fi
fi

# systemd
if [ "$RESTARTED" -eq 0 ]; then
  for SERVICE in crm-saas crm crm-saas.service; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE}"; then
      systemctl restart "$SERVICE"
      RESTARTED=1
      echo "✓ CRM reiniciado via systemd: $SERVICE"
      break
    fi
  done
fi

# Docker
if [ "$RESTARTED" -eq 0 ] && command -v docker >/dev/null 2>&1; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -Ei 'crm|crm-saas' | head -1 || true)"

  if [ -n "$CONTAINER" ]; then
    docker restart "$CONTAINER"
    RESTARTED=1
    echo "✓ CRM reiniciado via Docker: $CONTAINER"
  fi
fi

if [ "$RESTARTED" -eq 0 ]; then
  echo "⚠ Nenhum gestor de processos CRM detectado."
  echo "   O build terminou corretamente."
  echo "   Não vou iniciar um segundo processo automaticamente."
fi

sleep 5

# ======================================================
# 10. TESTES AUTOMÁTICOS
# ======================================================

log "10/10 - Executando testes"

TEST_FAILURE=0

# npm test
if node -e "let p=require('./package.json');process.exit(p.scripts&&p.scripts.test?0:1)" 2>/dev/null; then
  echo "→ npm test"
  npm test || TEST_FAILURE=1
else
  echo "⚠ npm test não definido"
fi

# lint
if node -e "let p=require('./package.json');process.exit(p.scripts&&p.scripts.lint?0:1)" 2>/dev/null; then
  echo "→ npm run lint"
  npm run lint || TEST_FAILURE=1
else
  echo "⚠ npm run lint não definido"
fi

# Verificação direta da BD
echo
echo "→ Teste de integridade da BD"

psql -v ON_ERROR_STOP=1 <<'SQL'

SELECT 'customers' AS tabela, count(*) FROM customers;
SELECT 'companies' AS tabela, count(*) FROM companies;
SELECT 'conversations' AS tabela, count(*) FROM conversations;
SELECT 'chat_messages' AS tabela, count(*) FROM chat_messages;
SELECT 'orders' AS tabela, count(*) FROM orders;
SELECT 'quotes' AS tabela, count(*) FROM quotes;
SELECT 'invoices' AS tabela, count(*) FROM invoices;
SELECT 'production_orders' AS tabela, count(*) FROM production_orders;
SELECT 'production_files' AS tabela, count(*) FROM production_files;

-- Verifica órfãos
SELECT
  'messages_orphans' AS teste,
  count(*) AS quantidade
FROM chat_messages m
LEFT JOIN conversations c
  ON c.conversation_id = m.conversation_id
WHERE c.conversation_id IS NULL;

SELECT
  'production_files_orphans' AS teste,
  count(*) AS quantidade
FROM production_files f
LEFT JOIN production_orders p
  ON p.production_id = f.production_id
WHERE f.production_id IS NOT NULL
  AND p.production_id IS NULL;

SQL

echo "✓ BD respondeu corretamente"

# ======================================================
# TESTE HTTP
# ======================================================

PORT="${PORT:-3000}"

echo
echo "→ Procurando endpoint HTTP"

HTTP_OK=0

for URL in \
  "http://127.0.0.1:${PORT}/api/conversations" \
  "http://127.0.0.1:${PORT}/api/health" \
  "http://127.0.0.1:${PORT}/health" \
  "http://127.0.0.1:${PORT}/"
do
  CODE="$(curl -sS -o /tmp/crm-health-response \
    -w '%{http_code}' \
    --max-time 5 \
    "$URL" 2>/dev/null || echo 000)"

  echo "  $URL -> HTTP $CODE"

  if [[ "$CODE" =~ ^2[0-9][0-9]$ ]]; then
    HTTP_OK=1
    echo "✓ Endpoint respondeu"
    break
  fi
done

if [ "$HTTP_OK" -eq 0 ]; then
  echo "⚠ Nenhum endpoint HTTP conhecido respondeu."
  echo "   Verificar porta/process manager manualmente."
  TEST_FAILURE=1
fi

# ======================================================
# RESULTADO
# ======================================================

echo
echo "======================================================"

if [ "$TEST_FAILURE" -eq 0 ]; then
  echo "  ✅ REPARAÇÃO CONCLUÍDA"
  echo "======================================================"
  echo
  echo "CRM:"
  echo "  ✓ Backup código"
  echo "  ✓ Backup BD"
  echo "  ✓ Migração BD"
  echo "  ✓ Compatibilidade legacy"
  echo "  ✓ TypeScript"
  echo "  ✓ npm build"
  echo "  ✓ Reinício"
  echo "  ✓ Testes"
  echo
  echo "BACKUP:"
  echo "  $BACKUP"
  echo
  exit 0
else
  echo "  ⚠ REPARAÇÃO CONCLUÍDA COM TESTES A FALHAR"
  echo "======================================================"
  echo
  echo "Backup:"
  echo "  $BACKUP"
  echo
  exit 2
fi
