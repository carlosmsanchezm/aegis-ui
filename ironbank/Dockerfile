# =============================================================================
# Aegis UI (Backstage) — Iron Bank Dockerfile (Tarball Pattern)
# Source code is pre-fetched by the Iron Bank pipeline as a tarball declared
# in hardening_manifest.yaml. No source code lives in this repository.
# Reference: repo1.dso.mil/dsop/opensource/backstage/backstage
# =============================================================================

ARG BASE_REGISTRY=registry1.dso.mil
ARG BASE_IMAGE=ironbank/opensource/nodejs/nodejs22
ARG BASE_TAG=22.14
ARG BUILDER_REGISTRY=registry1.dso.mil
ARG BUILDER_IMAGE=ironbank/opensource/nodejs/nodejs22
ARG BUILDER_TAG=22.14

# --- Build Stage: IB Node.js with native module toolchain ---
FROM ${BUILDER_REGISTRY}/${BUILDER_IMAGE}:${BUILDER_TAG} AS build

USER root

ENV PYTHON=/usr/bin/python3

# Install native module build dependencies (python3, g++, make for node-gyp)
# Uses dnf on IB UBI9 images, apt-get on Debian-based images (local builds)
RUN if command -v dnf >/dev/null 2>&1; then \
      dnf install -y --nodocs python3 gcc-c++ make sqlite-devel && \
      dnf clean all && rm -rf /var/cache/dnf; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update && \
      apt-get install -y --no-install-recommends python3 g++ build-essential && \
      rm -rf /var/lib/apt/lists/*; \
    fi

# Enable yarn via corepack
ENV COREPACK_HOME=/opt/corepack
RUN npm install -g corepack && corepack enable && \
    mkdir -p /opt/corepack && chmod 777 /opt/corepack && \
    corepack prepare yarn@4.4.1 --activate

# Create build user
RUN groupadd -g 1000 aegis 2>/dev/null || true && \
    useradd -u 1000 -g 1000 -m -d /app -s /bin/bash aegis 2>/dev/null || true && \
    mkdir -p /app && chown -R 1000:1000 /app

WORKDIR /app

# Extract UI source tarball (pre-fetched by IB pipeline from hardening_manifest)
# Must run as root to clean up /tmp; chown to build user afterward
COPY aegis-ui-src.tar.gz /tmp/
RUN tar -xzf /tmp/aegis-ui-src.tar.gz --strip-components=1 -C /app && \
    rm /tmp/aegis-ui-src.tar.gz && \
    chown -R 1000:1000 /app

USER 1000:1000

# Install all deps (including devDependencies for build)
RUN YARN_ENABLE_IMMUTABLE_INSTALLS=false yarn install

# Build TypeScript and all packages (backend + app + plugins)
RUN yarn tsc && yarn build:all

# --- Final Stage: Iron Bank UBI9 Node.js runtime ---
FROM ${BASE_REGISTRY}/${BASE_IMAGE}:${BASE_TAG}

LABEL org.opencontainers.image.title="aegis-ui" \
      org.opencontainers.image.description="Aegis Platform UI — Backstage-based developer portal for GPU workload management" \
      org.opencontainers.image.vendor="Aegis Platform" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.url="https://aegis-platform.tech" \
      org.opencontainers.image.version="1.0.0" \
      mil.dso.ironbank.image.keywords="backstage,ui,developer-portal,gpu,workload" \
      mil.dso.ironbank.image.type="commercial" \
      mil.dso.ironbank.product.name="aegis-ui"

USER root

ENV PYTHON=/usr/bin/python3

# Runtime deps for native modules (better-sqlite3, isolated-vm)
# Uses dnf on IB UBI9 images, apt-get on Debian-based images (local builds)
RUN if command -v dnf >/dev/null 2>&1; then \
      dnf install -y --nodocs python3 gcc-c++ make sqlite-devel && \
      dnf clean all && rm -rf /var/cache/dnf; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update && \
      apt-get install -y --no-install-recommends python3 g++ build-essential && \
      rm -rf /var/lib/apt/lists/*; \
    fi

# Enable yarn via corepack
ENV COREPACK_HOME=/opt/corepack
RUN npm install -g corepack && corepack enable && \
    mkdir -p /opt/corepack && chmod 777 /opt/corepack && \
    corepack prepare yarn@4.4.1 --activate

# Create non-root user
RUN groupadd -g 1000 aegis 2>/dev/null || true && \
    useradd -u 1000 -g 1000 -m -d /app -s /bin/bash aegis 2>/dev/null || true && \
    mkdir -p /app && chown -R 1000:1000 /app

# Strip SUID/SGID bits
RUN find / -xdev -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

USER 1000:1000
WORKDIR /app

ENV HOME=/app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

# Copy yarn config, lockfile, and package manifests from build stage
COPY --chown=1000:1000 --from=build /app/.yarn ./.yarn
COPY --chown=1000:1000 --from=build /app/.yarnrc.yml ./
COPY --chown=1000:1000 --from=build /app/backstage.json ./
COPY --chown=1000:1000 --from=build /app/yarn.lock /app/package.json ./
COPY --chown=1000:1000 --from=build /app/packages/backend/package.json packages/backend/package.json
COPY --chown=1000:1000 --from=build /app/packages/app/package.json packages/app/package.json
COPY --chown=1000:1000 --from=build /app/plugins/aegis/package.json plugins/aegis/package.json

# Install production deps only (rebuilds native modules against UBI9 runtime)
RUN yarn workspaces focus --all --production && rm -rf "$(yarn cache clean)"

# Copy built backend and app output
COPY --chown=1000:1000 --from=build /app/packages/backend/dist packages/backend/dist
COPY --chown=1000:1000 --from=build /app/packages/app/dist packages/app/dist
COPY --chown=1000:1000 --from=build /app/plugins/aegis/dist plugins/aegis/dist

# Copy app configs
COPY --chown=1000:1000 --from=build /app/app-config.yaml /app/app-config.production.yaml ./

EXPOSE 7007

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD node -e "require('http').get('http://localhost:7007/healthcheck', r => r.statusCode === 200 ? process.exit(0) : process.exit(1))" || exit 1

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
