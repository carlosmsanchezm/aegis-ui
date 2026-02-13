# Aegis UI

**Backstage-based web frontend for the Aegis GPU control plane**

Aegis UI provides a web interface for managing GPU workloads, clusters, budgets, and interactive VS Code workspaces across the Aegis multi-cluster platform. Built on [Backstage](https://backstage.io/), it integrates with the Platform API via a REST proxy and authenticates users through Keycloak OIDC.

## Features

- **Workload management** -- Submit, monitor, and manage GPU/CPU workloads with real-time status polling and provisioning timelines
- **Interactive workspaces** -- Launch VS Code workspaces from the browser and connect via the Sovran extension
- **FinOps dashboards** -- Cost analytics, quota management, and billing alerts per project and queue
- **Operations monitoring** -- Log explorer, metrics dashboards, alert management, and per-resource detail views
- **Cluster administration** -- Cluster profile management, IaC connector configuration, and provisioning oversight
- **Multi-tenant projects** -- Project creation, policy management, user/role administration, and audit logging
- **Keycloak SSO** -- OIDC authentication with automatic token refresh and session management

## Quick Start

### Prerequisites

- Node.js 20 or 22
- Yarn 4.x
- Access to a running [aegis-platform](https://github.com/carlosmsanchezm/aegis-platform) instance (or `kubectl port-forward`)

### Local Development

```bash
# Install dependencies
yarn install

# Start with local Platform API (requires port-forward to platform-api on :10080)
yarn dev

# Or start with cloud backend
yarn dev --config app-config.cloud.yaml
```

The app serves at [http://localhost:3000](http://localhost:3000).

### Configuration Modes

| Mode | Backend Target | Config File |
|------|---------------|-------------|
| Local | `localhost:10080` (port-forward) | `app-config.local-dev.yaml` |
| Cloud | `platform-api.aegist.dev:8080` | `app-config.cloud.yaml` |
| Cloud TLS | `platform-api.aegist.dev:8080` (TLS) | `app-config.cloud-tls.yaml` |

## Architecture

```
┌─────────────────────────────────────────┐
│              Backstage App              │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  App Shell  │  │  Aegis Plugin    │  │
│  │  (React)    │  │  - Workloads     │  │
│  │             │  │  - Workspaces    │  │
│  │  Keycloak   │  │  - FinOps        │  │
│  │  Auth       │  │  - Operations    │  │
│  │             │  │  - Admin         │  │
│  └──────┬──────┘  └────────┬─────────┘  │
│         │                  │            │
│  ┌──────▼──────────────────▼─────────┐  │
│  │       Backstage Proxy Backend     │  │
│  │       /api/proxy/aegis/*          │  │
│  └──────────────────┬────────────────┘  │
└─────────────────────┼───────────────────┘
                      │ REST
                      ▼
              ┌───────────────┐
              │  Platform API │
              │  (gRPC+REST)  │
              └───────────────┘
```

The Backstage proxy backend forwards `/api/proxy/aegis/*` requests to the Platform API's REST gateway. Authentication tokens from Keycloak are forwarded in the `Authorization` header.

## Project Structure

```
packages/
  app/          # Frontend application (React, Material-UI)
  backend/      # Backstage backend server
plugins/
  aegis/        # Custom Aegis plugin (workloads, FinOps, operations, admin)
```

## Related Repositories

- [aegis-platform](https://github.com/carlosmsanchezm/aegis-platform) -- Central control plane (Go, gRPC, K8s operator)
- [sovran](https://github.com/carlosmsanchezm/sovran) -- VS Code extension for remote GPU workspaces

For detailed documentation, visit [aegis-platform.tech](https://aegis-platform.tech).
