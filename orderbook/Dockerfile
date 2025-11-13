# Use Rust 1.84.0 with edition2024 support
FROM rust:1.84.0 as builder

WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY abi ./abi
COPY migrations ./migrations
COPY .sqlx ./.sqlx

# Build with release profile (--locked ensures Cargo.lock is respected)
# Skip compile-time verification - SQLx will use runtime verification
ENV SQLX_OFFLINE=false
RUN cargo build --release --locked --bin api-server

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

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Set environment
ENV RUST_LOG=info

# Expose port
EXPOSE 3000

# Run the binary via startup script
CMD ["/app/start.sh"]

