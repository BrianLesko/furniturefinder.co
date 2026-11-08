#!/bin/bash
# Rebuild and restart the production site on 6030. The running server is only
# stopped once the new build has succeeded.
set -e

export PATH=/home/lesko/.nvm/versions/node/v24.11.1/bin:$PATH
cd "$(dirname "$(realpath "$0")")"
mkdir -p logs

if ! NODE_ENV=production npm run build >> logs/next-build.log 2>&1; then
  echo "Build failed; the running site was left alone. See logs/next-build.log"
  exit 1
fi

pid=$(ss -ltnp | grep ":6030 " | grep -o "pid=[0-9]*" | cut -d= -f2 || true)
[ -n "$pid" ] && kill "$pid" && sleep 2
NODE_ENV=production nohup npx next start -p 6030 >> logs/next.log 2>&1 &
sleep 5
curl -s -o /dev/null -w "furniturefinder.co on 6030: %{http_code}\n" http://localhost:6030/
