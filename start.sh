#!/bin/bash

export PATH=/home/lesko/.nvm/versions/node/v24.11.1/bin:$PATH

OS_PATH="$(dirname "$(realpath "$0")")"
cd "$OS_PATH"
echo "cd to $OS_PATH"

mkdir -p logs

# Python model services the site calls: room layout (6021), piece cutouts (6022),
# and local Hunyuan3D image-to-3D (6023; its own venv, models load on first use).
listening() { ss -ltn | grep -q ":$1 "; }
(
  cd "$OS_PATH/ml"
  listening 6021 || nohup .venv/bin/python -u serve.py >> "$OS_PATH/logs/layout.log" 2>&1 &
  listening 6022 || nohup .venv/bin/python -u pieces.py >> "$OS_PATH/logs/pieces.log" 2>&1 &
  [ -x hy3d-venv/bin/python ] && { listening 6023 || nohup hy3d-venv/bin/python -u hy3d_local.py >> "$OS_PATH/logs/hy3d.log" 2>&1 & }
)

# Start the Next.js site (production build) on port 6030; 6020 is the dev server.
# Build first so a fresh clone / new commit is always served.
echo "Starting Next.js site on port 6030..."
(
  NODE_ENV=production npm run build >> "$OS_PATH/logs/next-build.log" 2>&1 \
    && NODE_ENV=production npx next start -p 6030 >> "$OS_PATH/logs/next.log" 2>&1
) &

echo "Using static Caddyfile configuration"
