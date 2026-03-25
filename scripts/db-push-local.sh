#!/usr/bin/env bash

set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"

if npx prisma db push; then
  exit 0
fi

echo "Prisma db push gagal, mencoba fallback bootstrap SQLite lokal..."

db_path="${DATABASE_URL#file:}"
if [[ "$db_path" == /* ]]; then
  resolved_db_path="$db_path"
else
  resolved_db_path="prisma/${db_path#./}"
fi

mkdir -p "$(dirname "$resolved_db_path")"
sqlite3 "$resolved_db_path" < prisma/init.sql

echo "Database SQLite lokal siap di $resolved_db_path"
