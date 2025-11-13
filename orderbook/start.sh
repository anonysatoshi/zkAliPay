#!/bin/bash
# Startup script for Railway deployment

# Start auto-cancel service in the background
echo "Starting auto-cancel service..."
/app/auto-cancel-service > /dev/null 2>&1 &

# Start API server in the foreground (keeps the container alive)
echo "Starting API server..."
exec /app/api-server

