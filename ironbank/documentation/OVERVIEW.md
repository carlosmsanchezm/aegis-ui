# Aegis UI — Architecture Overview

## Purpose

The Aegis UI provides a web-based developer portal built on Backstage for managing GPU workloads, clusters, and workspaces in the Aegis Platform.

## Technology Stack

- **Backstage** — Developer portal framework by Spotify
- **React** — Frontend UI framework
- **Node.js 22** — Runtime for Backstage backend
- **Yarn 4.4.1** — Package manager (workspace monorepo)

## Plugin Architecture

- **@aegis/plugin-aegis** — Custom Backstage plugin providing GPU workload management, cluster status, workspace lifecycle, and budget dashboards

## Security

- Runs as non-root (UID 1000)
- OIDC authentication via Keycloak
- Backend-for-frontend pattern — all API calls proxied through Backstage backend
- No direct browser-to-platform-api communication
