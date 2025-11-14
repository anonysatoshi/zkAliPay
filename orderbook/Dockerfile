# Use Rust 1.84.0 with edition2024 support
FROM rust:1.84.0 as builder

WORKDIR /app

# Copy manifests (from orderbook/ subdirectory)
COPY orderbook/Cargo.toml orderbook/Cargo.lock ./
COPY orderbook/src ./src
COPY orderbook/abi ./abi
COPY orderbook/migrations ./migrations

# Build with release profile (--locked ensures Cargo.lock is respected)
# SQLx uses runtime verification (no offline cache needed)
RUN cargo build --release --locked --bin api-server --bin auto-cancel-service

# Runtime stage - smaller image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary to multiple locations for Railway compatibility
COPY --from=builder /app/target/release/api-server /app/api-server
COPY --from=builder /app/target/release/api-server /usr/local/bin/api-server
COPY --from=builder /app/target/release/auto-cancel-service /app/auto-cancel-service
COPY --from=builder /app/target/release/auto-cancel-service /usr/local/bin/auto-cancel-service

# Create startup script inline (avoids COPY path issues)
RUN echo '#!/bin/bash\n\
# Startup script for Railway deployment\n\
\n\
# Start auto-cancel service in the background\n\
echo "Starting auto-cancel service..."\n\
/app/auto-cancel-service > /dev/null 2>&1 &\n\
\n\
# Start API server in the foreground (keeps the container alive)\n\
echo "Starting API server..."\n\
exec /app/api-server\n\
' > /app/start.sh && chmod +x /app/start.sh

# Set environment
ENV RUST_LOG=info

# Expose port
EXPOSE 3000

# Run the binary via startup script
CMD ["/app/start.sh"]

