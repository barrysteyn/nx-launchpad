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

# ── NVM + Node ────────────────────────────────────────────────────────────────
if [ ! -d "$HOME/.nvm" ]; then
  info "Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

info "Installing Node $NODE_VERSION via NVM..."
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
nvm use default

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

# ── Java 21 (Temurin) ─────────────────────────────────────────────────────────
if java -version 2>&1 | grep -q "21"; then
  info "Java 21 already installed"
else
  info "Installing Java 21 (Temurin)..."
  brew install --cask temurin@21
fi

# ── Node modules ──────────────────────────────────────────────────────────────
info "Installing node modules..."
cd "$REPO_ROOT"
npm ci

# ── VSCode extensions ─────────────────────────────────────────────────────────
if command -v code &>/dev/null && [ -f "$REPO_ROOT/.vscode/extensions.json" ]; then
  info "Installing VSCode extensions..."
  jq -r '.recommendations[]' "$REPO_ROOT/.vscode/extensions.json" | xargs -n 1 code --install-extension
else
  warn "VSCode CLI not found — install extensions manually or run: code --install-extension <id>"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
warn "Don't forget to configure git if you haven't already:"
echo "  git config --global pull.rebase true"
echo "  git config user.name \"Your Name\""
echo "  git config user.email \"your.name@project.com\""
echo ""
info "Setup complete! Open a new terminal to ensure all PATH changes take effect."
