#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# setup.sh — Bootstrap a clean checkout of nx-launchpad
# Run this once after cloning. Safe to re-run (idempotent).
# -----------------------------------------------------------------------------
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
info() { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[setup]${NC} $1"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_VERSION="24.12.0"

# ── Homebrew ──────────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  info "Homebrew already installed"
fi

# ── Volta + Node ──────────────────────────────────────────────────────────────
if ! command -v volta &>/dev/null; then
  info "Installing Volta..."
  curl https://get.volta.sh | bash
else
  info "Volta already installed: $(volta --version)"
fi

# Make Volta available in this shell session even on first install
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"

info "Installing Node $NODE_VERSION via Volta..."
volta install node@"$NODE_VERSION"

# ── uv (Python) ───────────────────────────────────────────────────────────────
if ! command -v uv &>/dev/null; then
  info "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
else
  info "uv already installed: $(uv --version)"
fi

# ── Maven ─────────────────────────────────────────────────────────────────────
if ! command -v mvn &>/dev/null; then
  info "Installing Maven..."
  brew install maven
else
  info "Maven already installed: $(mvn --version | head -1)"
fi

# ── Cloud CLIs ────────────────────────────────────────────────────────────────
for cli in gh awscli terraform jq; do
  if ! brew list "$cli" &>/dev/null; then
    info "Installing $cli..."
    brew install "$cli"
  else
    info "$cli already installed"
  fi
done

# ── Java 21 (Temurin) — optional ──────────────────────────────────────────────
if [ "${INSTALL_JAVA:-false}" = "true" ]; then
  if java -version 2>&1 | grep -q "21"; then
    info "Java 21 already installed"
  else
    info "Installing Java 21 (Temurin)..."
    brew install --cask temurin@21
  fi
else
  info "Java install skipped (set INSTALL_JAVA=true to install)"
fi

# ── Node modules ──────────────────────────────────────────────────────────────
info "Installing node modules..."
cd "$REPO_ROOT"
npm ci --legacy-peer-deps

# ── Husky pre-commit hooks ────────────────────────────────────────────────────
info "Setting up husky pre-commit hooks..."
npm run prepare

# ── VSCode extensions ─────────────────────────────────────────────────────────
if command -v code &>/dev/null && [ -f "$REPO_ROOT/.vscode/extensions.json" ]; then
  info "Installing VSCode extensions..."
  jq -r '.recommendations[]' "$REPO_ROOT/.vscode/extensions.json" | xargs -n 1 code --install-extension
else
  warn "VSCode CLI not found — install extensions manually or run: code --install-extension <id>"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
info "Setup complete! Open a new terminal to ensure all PATH changes take effect."
info "If invoked outside /dev-onboard, configure git manually:"
echo "  git config pull.rebase true"
echo "  git config push.autoSetupRemote true"
echo "  git config user.name \"Your Name\""
echo "  git config user.email \"you@example.com\""
