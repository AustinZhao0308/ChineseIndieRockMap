#!/bin/bash
set -euo pipefail

git pull --ff-only
npm install --legacy-peer-deps
npm run build
npm run check:production

if pm2 describe map >/dev/null 2>&1; then
  pm2 reload map --update-env
else
  pm2 start npm --name map -- start
fi

pm2 save
