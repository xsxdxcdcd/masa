#!/bin/sh
set -e

# The uploads directory may be a Railway volume mounted as root.
# Ensure it exists and is writable by the non-root runtime user, then drop privileges.
UPLOADS_DIR="/usr/src/app/uploads"
mkdir -p "$UPLOADS_DIR/receipts" "$UPLOADS_DIR/cvs" "$UPLOADS_DIR/chat" "$UPLOADS_DIR/courses" \
         "$UPLOADS_DIR/payments" \
         "$UPLOADS_DIR/private/receipts" "$UPLOADS_DIR/private/cvs" 2>/dev/null || true
chown -R nestjs:nodejs "$UPLOADS_DIR" 2>/dev/null || true

# Remove the probe file left by the earlier verification deploy
rm -f "$UPLOADS_DIR/__probe.txt" 2>/dev/null || true

exec su-exec nestjs:nodejs "$@"
