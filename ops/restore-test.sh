#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
dump="$(realpath "${1:?Usage: bash ops/restore-test.sh /absolute/path/database.sql.gz}")"
test -f "$dump"
gzip -t "$dump"
restore_project="agribank-helpdesk-restore-$(date +%Y%m%d%H%M%S)"
dc=(sudo docker compose -p "$restore_project" -f compose.restore.yaml)
cleanup() { "${dc[@]}" down; }
trap cleanup EXIT
"${dc[@]}" up -d --wait --wait-timeout 240
gzip -dc "$dump" | "${dc[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'
"${dc[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqlcheck -uroot "$MYSQL_DATABASE"'
"${dc[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE" -e "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS tickets FROM tickets; SELECT COUNT(*) AS comments FROM ticket_logs; SELECT COUNT(*) AS notifications FROM notifications; SELECT COUNT(*) AS categories FROM categories; SELECT COUNT(*) AS sla_configs FROM sla_configs;"'
echo "SQL restore and table checks passed. This does not test full application recovery."
echo "Isolated volume retained: ${restore_project}_restore_data"
