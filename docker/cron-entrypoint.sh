#!/bin/sh
# Generates the root crontab with CRON_SECRET inlined, then runs busybox crond
# in the foreground. Baking the secret in at startup avoids the usual problem
# of cron daemons not passing the container's environment to jobs.
set -eu

: "${CRON_SECRET:?CRON_SECRET is required}"
APP_URL="${APP_URL:-http://app:3000}"

mkdir -p /etc/crontabs
cat > /etc/crontabs/root <<EOF
# ZenScail scheduled jobs (replaces vercel.json "crons").
# Jobs hit the app over the internal compose network.

# Daily brief for every Corsair-connected user — 03:30 UTC
30 3 * * *    curl -fsS --max-time 290 -H "Authorization: Bearer ${CRON_SECRET}" ${APP_URL}/api/cron/daily-summary

# Re-surface snoozed threads whose time has come — every 5 min
*/5 * * * *   curl -fsS --max-time 55  -H "Authorization: Bearer ${CRON_SECRET}" ${APP_URL}/api/cron/snooze-wake

# Deliver pending "send later" / undo-window messages — every 5 min
*/5 * * * *   curl -fsS --max-time 115 -H "Authorization: Bearer ${CRON_SECRET}" ${APP_URL}/api/cron/scheduled-send

# Check armed follow-ups and nudge / clear them — hourly
0 * * * *     curl -fsS --max-time 115 -H "Authorization: Bearer ${CRON_SECRET}" ${APP_URL}/api/cron/follow-ups

# Warm mail + calendar cache for recently active users (backstop for when no
# tab is open — the 60s client pollers only run while someone is viewing the
# page) — every 10 min
*/10 * * * *  curl -fsS --max-time 290 -H "Authorization: Bearer ${CRON_SECRET}" ${APP_URL}/api/cron/sync
EOF

# -f: foreground, -d 8: log to stderr at debug level (visible in docker logs).
exec crond -f -d 8
