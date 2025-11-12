#!/bin/bash
# Start API server with environment variables loaded

cd "$(dirname "$0")"

# Load environment variables from .env file
set -a
source .env
set +a

# Start the API server
cargo run --release --bin api-server

