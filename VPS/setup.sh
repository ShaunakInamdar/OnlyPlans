#!/bin/bash
# Only Plans — VPS setup script
# Run this once OpenClaw Docker container is up.
# Usage: bash setup.sh

set -e

echo "==> Copying config files..."
mkdir -p ~/.openclaw
cp openclaw.json ~/.openclaw/openclaw.json
cp .env ~/.openclaw/.env
echo "    Config placed at ~/.openclaw/openclaw.json"

echo ""
echo "==> Installing voice-call plugin..."
openclaw plugins install @openclaw/voice-call

echo ""
echo "==> Restarting OpenClaw gateway to load plugin..."
docker compose restart openclaw-gateway

echo ""
echo "==> Done. Test with:"
echo "    openclaw voicecall call --to +YOUR_NUMBER --agent onboarding"
echo ""
echo "    Or to trigger from CLI without a call:"
echo "    openclaw --agent onboarding"
