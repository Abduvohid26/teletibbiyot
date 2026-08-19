#!/usr/bin/env bash
# LiveKit (SFU) rejimida E2E suite.
#
# scripts/test-all.sh E2E=true qo'yadi, bu esa LivekitService'ni o'chiradi —
# ya'ni barcha qayta-ulanish testlari FAQAT P2P yo'lini sinaydi. Production
# esa SFU'da ishlaydi. Bu skript o'sha suitening o'zini SFU rejimida yuritadi.
set -euo pipefail

export E2E=true
export E2E_LIVEKIT=true
export LIVEKIT_ENABLED=true

: "${LIVEKIT_PUBLIC_URL:?LIVEKIT_PUBLIC_URL kerak (masalan ws://localhost:7880)}"
: "${LIVEKIT_API_KEY:?LIVEKIT_API_KEY kerak}"
: "${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET kerak}"

echo "==> LiveKit SFU rejimida E2E: ${LIVEKIT_PUBLIC_URL}"
npx playwright test \
  e2e/video-live-reconnect.spec.ts \
  e2e/meet-video-room.spec.ts \
  e2e/video-connection.spec.ts \
  "$@"
