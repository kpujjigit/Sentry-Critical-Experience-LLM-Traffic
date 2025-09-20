#!/usr/bin/env bash
set -euo pipefail

# Always run from repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load environment variables from .env if present
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Compute release identifier (git sha if available, else timestamp)
RELEASE="${SENTRY_RELEASE:-}"
if [[ -z "${RELEASE}" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    RELEASE="$(git rev-parse --short HEAD)"
  else
    RELEASE="$(date +%s)"
  fi
fi

echo "Using Sentry release: $RELEASE"

# Build frontend with embedded release for client SDK
echo "Building client app with REACT_APP_SENTRY_RELEASE=$RELEASE"
pushd client >/dev/null
REACT_APP_SENTRY_RELEASE="$RELEASE" npm run build
popd >/dev/null

# Upload source maps using sentry-cli (via npx)
if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "ERROR: SENTRY_AUTH_TOKEN is not set. Aborting source map upload." >&2
  exit 1
fi

ORG_SLUG="${SENTRY_ORG:-}"
PROJECT_SLUG="${SENTRY_PROJECT:-}"

echo "Creating Sentry release and uploading source maps (org=${ORG_SLUG:-from .sentryclirc}, project=${PROJECT_SLUG:-from .sentryclirc})"

# Create or update the release and associate commits
npx --yes @sentry/cli releases new "$RELEASE" || true
npx --yes @sentry/cli releases set-commits "$RELEASE" --auto || true

# Upload source maps for CRA build; served from root ("/") via Express static
npx --yes @sentry/cli sourcemaps upload \
  --release "$RELEASE" \
  --rewrite \
  --validate \
  --url-prefix "~/" \
  --ext js --ext map \
  client/build

# Finalize the release
npx --yes @sentry/cli releases finalize "$RELEASE" || true

echo "Sentry release $RELEASE created and source maps uploaded."


