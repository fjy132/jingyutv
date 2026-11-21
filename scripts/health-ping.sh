#!/usr/bin/env bash
#
# 鲸鱼TV 健康拨测 / 保活脚本
#
# 用途：
#   1. 探测站点首页与状态接口是否可达；
#   2. 定时低频访问可降低 Vercel Hobby 函数闲置被回收后的冷启动概率。
#
# 用法（单次）：
#   bash scripts/health-ping.sh
#
# 可通过环境变量覆盖：
#   BASE_URL   站点地址，默认 https://jingyu.xyz
#   RETRIES    每个端点失败后重试次数，默认 2
#   RETRY_WAIT 重试间隔秒数，默认 3
#   TIMEOUT    单次请求超时秒数，默认 15
#
# 退出码：全部端点成功为 0；任一端点最终失败为 1（便于 cron / 监控判断）。
#
# 接入定时任务示例（Linux / WSL，每 10 分钟一次）：
#   */10 * * * *  /bin/bash /path/to/jingyutv/scripts/health-ping.sh >> /var/log/jingyutv-ping.log 2>&1
#

set -u

BASE_URL="${BASE_URL:-https://jingyu.xyz}"
RETRIES="${RETRIES:-2}"
RETRY_WAIT="${RETRY_WAIT:-3}"
TIMEOUT="${TIMEOUT:-15}"

# 拨测端点：路径|必须出现的关键字段（状态接口校验 JSON，首页校验 HTML）
ENDPOINTS=(
  "/"
  "/api/status|passwordRequired"
)

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

fail=0

for entry in "${ENDPOINTS[@]}"; do
  path="${entry%%|*}"
  expect="${entry#*|}"
  [ "$expect" = "$entry" ] && expect=""

  url="${BASE_URL}${path}"
  attempt=0
  ok=0

  while [ "$attempt" -le "$RETRIES" ]; do
    attempt=$((attempt + 1))
    body="$(curl -sS -L --max-time "$TIMEOUT" -A "health-ping/1.0" -w $'\n%{http_code}' "$url" 2>/dev/null)"
    code="$(printf '%s' "$body" | tail -n1)"
    payload="$(printf '%s' "$body" | sed '$d')"

    if [ "$code" = "200" ]; then
      if [ -z "$expect" ] || printf '%s' "$payload" | grep -q "$expect"; then
        log "OK   ${url} (200, 第 ${attempt} 次)"
        ok=1
        break
      else
        log "WARN ${url} 200 但响应缺少「${expect}」"
      fi
    else
      log "FAIL ${url} HTTP ${code:-000} (第 ${attempt}/${RETRIES} 次)"
    fi

    if [ "$attempt" -le "$RETRIES" ]; then
      sleep "$RETRY_WAIT"
    fi
  done

  if [ "$ok" -ne 1 ]; then
    log "DEAD ${url} 多次重试后仍不可达"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  log "站点健康检查通过：${BASE_URL}"
else
  log "站点健康检查存在异常：${BASE_URL}"
fi

exit "$fail"
