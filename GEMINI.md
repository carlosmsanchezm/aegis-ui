# Aegis UI - Frontend Repository

This is the frontend repository for Aegis, built on Backstage.

## Related Repository

The backend repository is located at: `../aegis-platform/`

## Integration Task

Connecting this frontend with the aegis-platform backend for:
1. Workspace creation via 3-step wizard
2. AWS cluster creation via Pulumi

## Key Files for Integration

**Frontend (this repo):**
- Workspace wizard: Look in `plugins/aegis/src/components/` for wizard components
- Cluster creation: Look for cluster creation pages
- Backstage config: `app-config.*.yaml` files
- API integration: Check for existing API client patterns

**Backend (../aegis-platform/):**
- API endpoints for workspace and cluster creation
- Pulumi scripts for AWS deployment
- Data models and validation

## What to Read

Focus on:
- Source files in `packages/app/src/` and `plugins/aegis/src/`
- Configuration: `app-config.*.yaml`, `package.json`, `tsconfig.json`
- Routing and navigation files

The `.geminiignore` file excludes tests, docs, and build artifacts to reduce noise.
