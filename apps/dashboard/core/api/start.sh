#!/bin/bash

echo "🚀 Starting Core API Server..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating from example..."
  cp .env.example .env
  echo "✅ Please edit .env with your configuration"
  exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check database connection
echo "🔍 Checking database connection..."
DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2)
DB_PORT=$(grep DB_PORT .env | cut -d '=' -f2)
DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2)
DB_USER=$(grep DB_USER .env | cut -d '=' -f2)

# Try to connect to database
PGPASSWORD=$(grep DB_PASSWORD .env | cut -d '=' -f2) \
  psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -d ${DB_NAME:-n8n_social_metrics} -c "SELECT 1;" > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Cannot connect to database. Please check your .env configuration."
  echo "   Host: ${DB_HOST:-localhost}"
  echo "   Port: ${DB_PORT:-5432}"
  echo "   Database: ${DB_NAME:-n8n_social_metrics}"
  echo "   User: ${DB_USER:-postgres}"
  exit 1
fi

echo "✅ Database connection successful"

# Create logs directory
mkdir -p logs

# Start server
echo "🎬 Starting server in development mode..."
npm run dev
