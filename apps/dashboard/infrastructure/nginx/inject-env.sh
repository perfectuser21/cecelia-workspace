#!/bin/sh
# Runtime environment variable injection for frontend

set -e

# Create runtime config file
cat > /usr/share/nginx/html/config.js << EOF
window.ENV = {
  API_URL: '${API_URL:-http://localhost:3002}',
  N8N_URL: '${N8N_URL:-http://localhost:5678}',
  ENVIRONMENT: '${ENVIRONMENT:-production}'
};
EOF

echo "Environment variables injected into /usr/share/nginx/html/config.js"
