#!/usr/bin/env bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log() { echo -e "${CYAN}[INFO]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERROR]${NC} $*"; }

echo ""
echo "============================================================"
echo "  AI Document Review - Installer (Linux/macOS)"
echo "============================================================"
echo ""
log "Project root: $SCRIPT_DIR"

log "Checking Node.js and npm..."
command -v node >/dev/null 2>&1 || { err "Node.js not found. Install from https://nodejs.org/"; exit 1; }
command -v npm >/dev/null 2>&1 || { err "npm not found."; exit 1; }
ok "Node.js: $(node --version)"
ok "npm: $(npm --version)"

detect_python() {
  for c in python3.12 python3.11 python3.10 python3 python; do
    if command -v "$c" >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

PYTHON_CMD="$(detect_python || true)"
if [[ -z "${PYTHON_CMD}" ]]; then
  err "Python not found. Please install Python 3.10+."
  exit 1
fi
ok "$($PYTHON_CMD --version)"

log "Installing backend dependencies..."
cd app/api

if [[ ! -x "venv/bin/python" ]]; then
  log "Creating virtual environment in app/api/venv ..."
  "$PYTHON_CMD" -m venv venv
fi

if [[ ! -f "venv/bin/activate" ]]; then
  err "venv/bin/activate not found after venv creation."
  exit 1
fi
source venv/bin/activate

python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
ok "Python dependencies installed."

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.tpl" ]]; then
    cp .env.tpl .env
    ok "Created app/api/.env from template."
  else
    warn "app/api/.env.tpl not found, skip creating .env"
  fi
fi

LLM_PROVIDER="$(grep -E '^LLM_PROVIDER=' .env 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
OLLAMA_MODEL="$(grep -E '^OLLAMA_MODEL=' .env 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:7b-instruct-q4_K_M}"

if [[ "${LLM_PROVIDER}" == "ollama" ]]; then
  log "LLM_PROVIDER=ollama detected. Preparing Ollama and model..."
  OFFLINE_ROOT="$SCRIPT_DIR/offline_bundle"
  OFFLINE_MODELFILE="$OFFLINE_ROOT/models/Modelfile"
  OFFLINE_OLLAMA_LINUX_INSTALL="$OFFLINE_ROOT/ollama/linux/install.sh"

  if ! command -v ollama >/dev/null 2>&1; then
    if [[ -x "$OFFLINE_OLLAMA_LINUX_INSTALL" ]]; then
      log "Found offline Ollama installer script: $OFFLINE_OLLAMA_LINUX_INSTALL"
      bash "$OFFLINE_OLLAMA_LINUX_INSTALL" || true
    fi
  fi

  if ! command -v ollama >/dev/null 2>&1; then
    warn "Ollama not found. Install from https://ollama.com/download"
    warn "Then run: ollama pull ${OLLAMA_MODEL}"
  else
    model_exists() {
      ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -Fxq "${OLLAMA_MODEL}"
    }

    if ! model_exists; then
      if [[ -f "$OFFLINE_MODELFILE" ]]; then
        log "Found offline model Modelfile: $OFFLINE_MODELFILE"
        (
          cd "$OFFLINE_ROOT/models"
          ollama create "${OLLAMA_MODEL}" -f Modelfile
        ) || true
      fi
    fi

    if ! model_exists; then
      log "Offline model not found. Trying online pull..."
      set +e
      ollama pull "${OLLAMA_MODEL}"
      rc=$?
      set -e
      if [[ $rc -ne 0 ]]; then
        warn "Failed to pull model ${OLLAMA_MODEL}."
        warn "Ensure Ollama service is running, then run manually:"
        warn "  ollama pull ${OLLAMA_MODEL}"
      fi
    fi

    if model_exists; then
      ok "Ollama model ready: ${OLLAMA_MODEL}"
    else
      warn "Failed to prepare model: ${OLLAMA_MODEL}"
    fi
  fi
fi

cd "$SCRIPT_DIR/app/ui"
log "Installing frontend dependencies..."
npm install
ok "npm dependencies installed."

cd "$SCRIPT_DIR"
chmod +x install.sh start.sh stop.sh 2>/dev/null || true

echo ""
echo "============================================================"
echo "[DONE] Installation complete."
echo "[NEXT] 1) Review app/api/.env"
echo "[NEXT] 2) Start with ./start.sh (Linux/macOS)"
echo "============================================================"
echo ""
