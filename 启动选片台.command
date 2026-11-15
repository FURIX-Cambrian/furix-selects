#!/bin/bash
# FURIX SELECTS · macOS 启动器
# 双击即可：启动本地静态服务，并用 Chrome / Edge 的应用窗口打开
set -e
cd "$(dirname "$0")"

PORT=""
if [ -f .server.json ]; then
  OLD_PORT=$(/usr/bin/python3 - <<'PY' 2>/dev/null || true
import json
try:
    print(json.load(open(".server.json"))["port"])
except Exception:
    print("")
PY
)
  OLD_PID=$(/usr/bin/python3 - <<'PY' 2>/dev/null || true
import json
try:
    print(json.load(open(".server.json"))["pid"])
except Exception:
    print("")
PY
)
  if [ -n "$OLD_PORT" ] && [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    PORT="$OLD_PORT"
  fi
fi

if [ -z "$PORT" ]; then
  for P in $(seq 8731 8799); do
    if ! /usr/sbin/lsof -i :$P >/dev/null 2>&1; then PORT=$P; break; fi
  done
fi

if [ -z "$PORT" ]; then
  echo "没有空闲端口（8731-8799）"
  exit 1
fi

URL="http://127.0.0.1:$PORT/index.html"
if ! /usr/bin/curl -s -o /dev/null "$URL"; then
  /usr/bin/python3 -m http.server "$PORT" --bind 127.0.0.1 > .server.log 2> .server.err.log &
  PID=$!
  printf '{\n    "port": %s,\n    "pid": %s,\n    "url": "%s"\n}\n' "$PORT" "$PID" "$URL" > .server.json
  sleep 1
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL" --window-size=1600,1000
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$URL" --window-size=1600,1000
else
  open "$URL"
fi