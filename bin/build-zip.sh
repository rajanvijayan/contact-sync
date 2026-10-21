#!/usr/bin/env bash
# Build a distributable plugin zip in dist/contact-sync.zip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="contact-sync"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$ROOT"
npm run build

rsync -a --exclude-from=.distignore --exclude=vendor --exclude=dist ./ "$STAGE/$SLUG/"
cp composer.json composer.lock "$STAGE/$SLUG/"
composer install --no-dev --optimize-autoloader --no-interaction --working-dir="$STAGE/$SLUG" >/dev/null
rm "$STAGE/$SLUG/composer.json" "$STAGE/$SLUG/composer.lock"

mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/$SLUG.zip"
(cd "$STAGE" && zip -rq "$ROOT/dist/$SLUG.zip" "$SLUG")
echo "Built dist/$SLUG.zip"
