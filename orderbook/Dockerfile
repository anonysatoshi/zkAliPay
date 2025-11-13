# Use Rust nightly with all needed tools
FROM rust:1.81.0 as builder

WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY abi ./abi
COPY migrations ./migrations
COPY openvm-binaries ./openvm-binaries

# Build with release profile
RUN cargo build --release --bin api-server

# Runtime stage - smaller image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary
COPY --from=builder /app/target/release/api-server /app/api-server
COPY --from=builder /app/openvm-binaries /app/openvm-binaries

# Set environment
ENV RUST_LOG=info

# Expose port
EXPOSE 3000

# Run the binary
CMD ["/app/api-server"]

