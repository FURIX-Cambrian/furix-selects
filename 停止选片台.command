#!/bin/bash
# FURIX SELECTS · macOS 停止后台服务
cd "$(dirname "$0")"
if [ -f .server.json ]; then
  PID=$(/usr/bin/python3 - <<'PY' 2>/dev/null || true
import json
try:
    print(json.load(open(".server.json"))["pid"])
except Exception:
    print("")
PY
)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "已停止选片台服务（PID $PID）"
  else
    echo "服务没有在运行"
  fi
  rm -f .server.json
else
  echo "没有找到 .server.json，服务可能没启动"
fi