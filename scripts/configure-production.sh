#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"
umask 077

env_value() {
  node --input-type=commonjs - "$1" <<'NODE'
const dotenv = require('dotenv');
dotenv.config({ path: '.env', quiet: true });
process.stdout.write(process.env[process.argv[2]] || '');
NODE
}

existing_jwt="$(env_value JWT_SECRET)"
existing_user_jwt="$(env_value USER_JWT_SECRET)"
existing_admin="$(env_value ADMIN_USERNAME)"
existing_db="$(env_value DATABASE_PATH)"
default_jwt='super_secret_jwt_key_for_indie_rock_map'
rotate_map_jwt=false

if [ "${1:-}" = '--rotate-map-jwt' ]; then
  rotate_map_jwt=true
elif [ -n "${1:-}" ]; then
  echo 'Usage: bash scripts/configure-production.sh [--rotate-map-jwt]' >&2
  exit 1
fi

if [ "${#existing_jwt}" -lt 32 ] || [ "$existing_jwt" = "$default_jwt" ]; then
  if [ "$rotate_map_jwt" = false ]; then
    echo 'Current JWT_SECRET is missing or is the development default. No files were changed.' >&2
    echo 'Re-run with --rotate-map-jwt to create a secure secret and require existing sessions to sign in again.' >&2
    exit 1
  fi

  read -r -p 'This signs out current map administrators and label users. Type ROTATE to continue: ' confirmation
  if [ "$confirmation" != 'ROTATE' ]; then
    echo 'JWT rotation was cancelled. No files were changed.' >&2
    exit 1
  fi
  map_jwt="$(openssl rand -hex 32)"
else
  map_jwt="$existing_jwt"
fi
admin_username="${existing_admin:-admin}"

printf 'Administrator username [%s]: ' "$admin_username"
read -r entered_admin_username
admin_username="${entered_admin_username:-$admin_username}"

read -r -s -p 'Set a new administrator password (12 characters minimum): ' admin_password
printf '\n'
read -r -s -p 'Confirm the administrator password: ' admin_password_confirm
printf '\n'

if [ "$admin_password" != "$admin_password_confirm" ]; then
  echo 'Passwords do not match. No files were changed.' >&2
  exit 1
fi
if [ "${#admin_password}" -lt 12 ]; then
  echo 'Administrator password must be at least 12 characters. No files were changed.' >&2
  exit 1
fi

admin_password_hash="$(printf '%s' "$admin_password" | node --input-type=commonjs -e "const bcrypt = require('bcryptjs'); let value = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => value += chunk); process.stdin.on('end', async () => process.stdout.write(await bcrypt.hash(value, 12)));" )"
unset admin_password admin_password_confirm

if [ "${#existing_user_jwt}" -lt 32 ] || [ "$existing_user_jwt" = "$map_jwt" ]; then
  user_jwt="$(openssl rand -hex 32)"
else
  user_jwt="$existing_user_jwt"
fi

database_path="${existing_db:-$project_root/bands.db}"
case "$database_path" in
  /*) ;;
  *) database_path="$project_root/$database_path" ;;
esac

if [ ! -f "$database_path" ]; then
  echo "Database file was not found: $database_path" >&2
  echo 'No files were changed.' >&2
  exit 1
fi

mkdir -p backups
backup_path="$project_root/backups/bands-$(date +%F-%H%M%S).db"

node --input-type=commonjs - "$database_path" "$backup_path" <<'NODE'
const Database = require('better-sqlite3');
const [source, target] = process.argv.slice(2);
const db = new Database(source, { readonly: true });
db.backup(target)
  .then(() => db.close())
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
NODE

tmp_env="$(mktemp .env.XXXXXX)"
if [ -f .env ]; then
  grep -Ev '^(NODE_ENV|PORT|ADMIN_USERNAME|ADMIN_DISPLAY_NAME|ADMIN_PASSWORD_HASH|JWT_SECRET|USER_JWT_SECRET|APPLE_CLIENT_ID|DATABASE_PATH)=' .env > "$tmp_env" || true
fi

{
  printf 'NODE_ENV=production\n'
  printf 'PORT=3000\n'
  printf 'ADMIN_USERNAME=%s\n' "$admin_username"
  printf 'ADMIN_DISPLAY_NAME=Catbeer Admin\n'
  printf 'ADMIN_PASSWORD_HASH=%s\n' "$admin_password_hash"
  printf 'JWT_SECRET=%s\n' "$map_jwt"
  printf 'USER_JWT_SECRET=%s\n' "$user_jwt"
  printf 'APPLE_CLIENT_ID=com.catbeer.Catbeer-iOS\n'
  printf 'DATABASE_PATH=%s\n' "$database_path"
} >> "$tmp_env"

mv "$tmp_env" .env
chmod 600 .env

DB_PATH="$database_path" ADMIN_USERNAME="$admin_username" ADMIN_PASSWORD_HASH="$admin_password_hash" node --input-type=commonjs - <<'NODE'
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH);
const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'admin_users'").get();

if (table) {
  const updated = db.prepare(`
    UPDATE admin_users
    SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE username = ?
  `).run(process.env.ADMIN_PASSWORD_HASH, process.env.ADMIN_USERNAME);

  if (updated.changes === 0) {
    db.prepare(`
      INSERT INTO admin_users (username, display_name, password_hash, status, updated_at)
      VALUES (?, 'Catbeer Admin', ?, 'active', CURRENT_TIMESTAMP)
    `).run(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD_HASH);
  }
}

db.close();
NODE

npm run check:production
echo "Configuration check passed. Database backup: $backup_path"
