#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
project_dir="$PWD"
backup_root="/home/congminh/backups/agribank-helpdesk"
mkdir -p "$backup_root"
chmod 700 "$backup_root"
exec 9>"$backup_root/.backup.lock"
flock -n 9 || { echo 'Another backup is running' >&2; exit 1; }
backup_dir="$backup_root/$(date +%Y%m%d-%H%M%S)"
mkdir "$backup_dir"
dc=(sudo docker compose --project-directory "$project_dir" -f "$project_dir/compose.yaml")
"${dc[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --quick --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' | gzip > "$backup_dir/database.sql.gz.partial"
gzip -t "$backup_dir/database.sql.gz.partial"
mv "$backup_dir/database.sql.gz.partial" "$backup_dir/database.sql.gz"
# This archive contains secrets: mode 600, no public download location.
tar -czf "$backup_dir/config-source.tar.gz" --exclude=.git --exclude=node_modules --exclude=dist --exclude=target -C "$project_dir" .
"${dc[@]}" images --format json > "$backup_dir/images.json"
(cd "$backup_dir" && sha256sum database.sql.gz config-source.tar.gz images.json > SHA256SUMS)
touch "$backup_dir/COMPLETE"
if [ "$(id -u)" -eq 0 ]; then
  chown congminh:congminh "$backup_root"
  chown -R congminh:congminh "$backup_dir"
fi
echo "Backup complete: $backup_dir"
# Retention is deliberately manual until an off-device copy and restore are verified.
