
## PHASE 4 (ACTIVE NOW): Frontend Development – aegis-ui
- Configure Backstage proxy (HTTPS -> https://platform-api.localtest.me, path=/api)
- Create typed API client in `plugins/aegis/src/api/`
- Wire 3-step workspace wizard to POST /api/workspaces (validation parity, toasts)
- Cluster page: POST /api/clusters -> jobId; poll GET /api/clusters/:jobId/status every 5s
  - Show 0–100% progress
  - Persist jobId across reloads/navigation
  - Surface “AWS only” clearly
- Respect TLS trust during dev: `export NODE_EXTRA_CA_CERTS=~/aegis-local-trust.pem`
- Start dev: `yarn dev`

## Critical Constraints (apply to all phases)
1) Backend is Go, NOT Node
2) MUST deploy to local k8s with TLS (`make deploy-local-tls`), never `go run`, never `make deploy-local`
3) Keycloak required; do NOT bypass auth
4) Backend base URL: https://platform-api.localtest.me (HTTPS)
5) Cluster deploys are async (10–30 min): job pattern only
6) AWS-only with Pulumi
7) Always use feature branches; never main
8) Always use `make deploy-local-tls`

## Allowed scope for this run
- Read/edit **only**:
  - `aegis-ui/` → `app-config*.yaml`, `plugins/aegis/**`, `packages/app/src/App.tsx`, any TS types shared by those
  - `aegis-platform/` → `services/platform-api/**`, `proto/**`, `charts/**` (only if UI wiring needs backend type/route alignment)
- Avoid tests, large assets, CI, docs, `node_modules`

## Verification
- Backend up: `curl -k https://platform-api.localtest.me/health`
- Frontend up: `yarn dev`, browser http://localhost:3000
- Logs: `kubectl logs deployment/aegis-services-platform-api -n aegis-system -f`

## Reference: Multi-phase plan (for context only; do not execute phases 1–3, 5–7 now)
# Aegis Integration Plan (Markdown)

## Objective

Integrate **aegis-ui** (frontend) with **aegis-platform** (backend) for workspace creation and cluster deployment.

> **IMPORTANT:** Read `GEMINI.md` in this directory for complete context and deployment workflows.

---

## Repositories

* `/Users/carlossanchez/code/aegis-ui` — Backstage frontend (TypeScript/React)
* `/Users/carlossanchez/code/aegis-platform` — Go backend + Pulumi (deployed to k8s with TLS)

---

## Critical Constraints

1. Backend is Go application, **NOT** Node.js
2. Backend **MUST** be deployed to local k8s with TLS, **NEVER** run with `go run`
3. Backend requires **Keycloak (auto-deployed)** — **DO NOT** bypass authentication
4. Backend accessible at `https://platform-api.localtest.me` (**HTTPS, NOT HTTP**)
5. Cluster deployments are **async (10–30 min)** — use **job pattern**, **NOT** synchronous HTTP
6. **AWS-only** for Pulumi deployments
7. **ALWAYS** create feature branches, **NEVER** work on `main`
8. **ALWAYS** use `make deploy-local-tls` (**NOT** `make deploy-local`)

---

## Why TLS Is Required

The local k8s cluster has an **ingress-nginx admission webhook** that requires TLS certificates.
Using `make deploy-local` (non-TLS) will fail with:

```
tls: failed to verify certificate: x509: certificate signed by unknown authority
```

**ALWAYS** use:

```bash
make deploy-local-tls
```

which mints the local CA and configures certificates properly.

---

## Deployment Workflows

### Backend (aegis-platform)

After making code changes:

1. **Build:**

   ```bash
   make build-platform PLATFORM_API_IMAGE=carlosmsanchez/aegis-platform-api:dev
   ```
2. **Clean:**

   ```bash
   make clean-local
   ```
3. **Deploy with TLS:**

   ```bash
   make deploy-local-tls
   ```
4. **Verify:**

   ```bash
   kubectl get pods -n aegis-system
   ```
5. **Test:**

   ```bash
   curl -k https://platform-api.localtest.me/health
   ```

**Notes & Fixes**

* If you see **“certificate signed by unknown authority”**: you used `make deploy-local` instead of `make deploy-local-tls`.
  **Solution:**

  ```bash
  make clean-local && make deploy-local-tls
  ```
* If namespace stuck in **Terminating**: wait up to 2 minutes, then redeploy with `make deploy-local-tls`.
* If build/deploy fails: analyze errors, fix code, rebuild/redeploy with `make deploy-local-tls`, iterate until successful.

---

### Frontend (aegis-ui)

After making code changes:

1. **Set certificate trust:**

   ```bash
   export NODE_EXTRA_CA_CERTS=~/aegis-local-trust.pem
   ```
2. **Start:**

   ```bash
   yarn dev
   ```
3. **Test:** Open browser to `http://localhost:3000`

*No Docker build needed for frontend.*

---

## Integration Testing

**Prerequisites**

* Backend deployed (`make deploy-local-tls`)
* Certificate trust set (`export NODE_EXTRA_CA_CERTS=~/aegis-local-trust.pem`)
* Frontend running (`yarn dev`)

**Check logs**

```bash
kubectl logs deployment/aegis-services-platform-api -n aegis-system -f
```

---

## Phase 1: Discovery and Analysis

### Backend Discovery (aegis-platform)

* [ ] Read `Makefile` (focus on `deploy-local-tls`)
* [ ] Read `services/platform-api/main.go` — backend entry point
* [ ] Read `services/platform-api/internal/server/server.go` — API route structure
* [ ] Identify existing HTTP/gRPC endpoints
* [ ] Check for async job processing implementation
* [ ] Identify authentication middleware (`internal/server/mw/`)
* [ ] Review Pulumi scripts for cluster deployment inputs
* [ ] Document current API structure and patterns

### Frontend Discovery (aegis-ui)

* [ ] Read `package.json` and `app-config*.yaml`
* [ ] Locate 3-step workspace wizard in `plugins/aegis/src/components/`
* [ ] Identify all wizard data fields
* [ ] Find cluster creation page components
* [ ] Check for Backstage proxy configuration in `app-config.yaml`
* [ ] Identify existing API client patterns
* [ ] Review state management approach
* [ ] Check for loading states and error handling patterns

### Architecture Validation

* [ ] Determine if Backstage proxy exists for backend API calls
* [ ] Confirm Go backend structure for adding new endpoints
* [ ] Verify if async job processing exists in backend
* [ ] Identify where to add workspace and cluster endpoints
* [ ] Map frontend wizard fields to required backend data

**Validation Checkpoint — Report discovery findings including:**

* Current backend API structure
* Where new endpoints should be added
* Frontend wizard components and data fields
* Existing Backstage proxy configuration
* Recommended integration approach

> **ONLY PROCEED TO PHASE 2 AFTER REPORTING DISCOVERY FINDINGS.**

---

## Phase 2: Git Setup

### Branch Creation

* [ ] In `aegis-platform`:

  ```bash
  git checkout -b integration/wire-frontend-backend-2025-11-02
  ```
* [ ] In `aegis-ui`:

  ```bash
  git checkout -b integration/wire-frontend-backend-2025-11-02
  ```
* [ ] Verify both branches created:

  ```bash
  git branch --show-current
  ```
* [ ] Ensure working directories are clean:

  ```bash
  git status
  ```

**Validation Checkpoint:** Confirm both branches exist and are checked out.

> **ONLY PROCEED TO PHASE 3 AFTER BRANCHES ARE CONFIRMED.**

---

## Phase 3: Backend Development (aegis-platform)

**Working directory:** `/Users/carlossanchez/code/aegis-platform`

### Workspace Creation Endpoint

* [ ] Add `POST /api/workspaces` to accept workspace configuration
* [ ] Implement request validation
* [ ] Add business logic for workspace creation
* [ ] Implement error handling with proper HTTP status codes
* [ ] Add structured logging
* [ ] Return workspace details on success

### Cluster Creation Endpoints (Async Pattern)

* [ ] Implement async job queue/storage (if not exists)
* [ ] Add `POST /api/clusters` endpoint:

  * Accept cluster configuration
  * Validate input
  * Create job entry
  * **Return job ID immediately** (do **NOT** wait for Pulumi)
* [ ] Add `GET /api/clusters/:jobId/status` endpoint:

  * Return job status (pending/running/completed/failed)
  * Return progress percentage (0–100)
  * Return error details if failed
* [ ] Implement background job processor for Pulumi deployments
* [ ] Add timeout handling (Pulumi can take 10–30 minutes)
* [ ] Store job state persistently

### Health Check

* [ ] Verify `GET /health` endpoint exists
* [ ] If not, add basic health check endpoint

### Build and Deploy with TLS

* [ ] **Build Docker image:**

  ```bash
  cd /Users/carlossanchez/code/aegis-platform
  make build-platform PLATFORM_API_IMAGE=carlosmsanchez/aegis-platform-api:dev
  ```
* [ ] If build fails: analyze error, fix code, rebuild, repeat until successful
* [ ] **Clean k8s cluster:**

  ```bash
  make clean-local
  ```
* [ ] **Deploy to k8s WITH TLS:**

  ```bash
  make deploy-local-tls
  ```

  *(This is the ONLY correct deployment command — do NOT use `make deploy-local`)*
* [ ] If deploy fails with **“certificate signed by unknown authority”**:
  You used `make deploy-local` instead of `make deploy-local-tls`
  **Solution:**

  ```bash
  make clean-local && make deploy-local-tls
  ```
* [ ] If namespace stuck in **Terminating**:
  Wait up to 2 minutes for timeout, then:

  ```bash
  make deploy-local-tls
  ```
* [ ] **Verify deployment:**

  ```bash
  kubectl get pods -n aegis-system
  ```

  *(All pods should be Running)*
* [ ] If pods fail:

  ```bash
  kubectl logs <pod> -n aegis-system
  ```

  Fix code, rebuild/redeploy with `make deploy-local-tls`
* [ ] **Test health endpoint with HTTPS:**

  ```bash
  curl -k https://platform-api.localtest.me/health
  ```

  *(Use `-k` for self-signed cert; use **HTTPS** not HTTP)*
* [ ] If endpoint fails: check ingress/service, review logs, fix and redeploy with `make deploy-local-tls`

**Validation Checkpoint — Report:**

* All endpoints implemented
* Build successful
* Deployment with TLS successful
* Health check responding on HTTPS
* Ready for frontend integration

> **ONLY PROCEED TO PHASE 4 AFTER BACKEND IS SUCCESSFULLY DEPLOYED WITH TLS AND TESTED.**

---

## Phase 4: Frontend Development (aegis-ui)

**Working directory:** `/Users/carlossanchez/code/aegis-ui`

### API Integration Layer

* [ ] Configure Backstage proxy in `app-config.yaml` (or verify existing)

  * **Target:** `https://platform-api.localtest.me` (**HTTPS not HTTP**)
  * **Path:** `/api`
* [ ] Create API service layer for backend calls
* [ ] Implement error handling wrapper
* [ ] Create TypeScript interfaces for API requests/responses

### Workspace Wizard Integration

* [ ] Add state management for wizard data
* [ ] On final wizard step, gather all form data
* [ ] Call `POST /api/workspaces` via Backstage proxy
* [ ] Handle response (success/error)
* [ ] Add loading spinner during API call
* [ ] Display success notification
* [ ] Display error messages from backend
* [ ] Add form validation matching backend rules

### Cluster Creation Page Integration

* [ ] Update UI to show **AWS-only** limitation
* [ ] Connect form to `POST /api/clusters` endpoint
* [ ] Implement async job handling:

  * Submit request, receive job ID
  * Start polling `GET /api/clusters/:jobId/status` **every 5 seconds**
  * Display progress bar (0–100%)
  * Handle completion (success/failure)
  * Stop polling when complete
* [ ] Add progress indicator UI
* [ ] Implement toast notifications for status updates
* [ ] Allow navigation away (persist job ID)
* [ ] Handle network errors gracefully

### Start Frontend with Certificate Trust

* [ ] Set environment variable:

  ```bash
  export NODE_EXTRA_CA_CERTS=~/aegis-local-trust.pem
  ```

  *(File created by `make deploy-local-tls`)*
* [ ] Start dev server:

  ```bash
  cd /Users/carlossanchez/code/aegis-ui
  yarn dev
  ```
* [ ] If errors: check console, fix code (auto-reloads)

**If frontend can’t reach backend**

* Verify env var:

  ```bash
  echo $NODE_EXTRA_CA_CERTS
  ```

  Should be `/Users/carlossanchez/aegis-local-trust.pem`
* Check Backstage proxy points to **HTTPS** URL
* Test backend:

  ```bash
  curl -k https://platform-api.localtest.me/health
  ```

**Validation Checkpoint — Report:**

* Frontend starts without errors
* Wizard and cluster pages render
* API integration layer configured for HTTPS
* Certificate trust configured
* Ready for integration testing

> **ONLY PROCEED TO PHASE 5 AFTER FRONTEND IS RUNNING.**

---

## Phase 5: Integration Testing

**Prerequisites**

* [ ] Backend deployed with TLS: `make deploy-local-tls` (in `aegis-platform`)
* [ ] Certificate trust set: `export NODE_EXTRA_CA_CERTS=~/aegis-local-trust.pem`
* [ ] Frontend running: `yarn dev` (in `aegis-ui`)
* [ ] Verify backend:

  ```bash
  curl -k https://platform-api.localtest.me/health
  ```

### Test Case 1: Workspace Creation

* [ ] Open frontend (`http://localhost:3000`)
* [ ] Navigate to workspace wizard
* [ ] Fill out all 3 steps with valid data
* [ ] Submit form
* [ ] Verify success notification appears
* [ ] Check backend logs:

  ```bash
  kubectl logs deployment/aegis-services-platform-api -n aegis-system -f
  ```
* [ ] Verify workspace created successfully
* [ ] Test with invalid data (verify error handling)
* [ ] Test with backend unavailable (stop pods, verify error)

### Test Case 2: Cluster Creation

* [ ] Navigate to cluster creation page
* [ ] Fill out **AWS** cluster configuration
* [ ] Submit request
* [ ] Verify job ID received immediately
* [ ] Verify polling starts automatically
* [ ] Watch progress indicator update
* [ ] Check backend logs for Pulumi invocation
* [ ] Verify status updates correctly
* [ ] Test completion handling

### Test Case 3: Error Scenarios

* [ ] Invalid inputs (wizard and cluster)
* [ ] Invalid config
* [ ] Network errors (brief disconnect)
* [ ] Verify all error messages display correctly
* [ ] App remains stable on errors

### Test Case 4: Long-running Operations

* [ ] Start cluster creation
* [ ] Navigate away, return, verify status tracked
* [ ] Refresh browser, verify job persists

**Validation Checkpoint — Report:**

* All test cases and results
* Any bugs found
* Performance observations
* Integration status (working/needs fixes)

> If tests fail: analyze issues, fix code, rebuild/redeploy backend with `make deploy-local-tls` or restart frontend, retest.
> **ONLY PROCEED TO PHASE 6 AFTER ALL CRITICAL TESTS PASS.**

---

## Phase 6: Documentation

### API Documentation

* [ ] Document new/modified endpoints:

  * `POST /api/workspaces` (request/response format)
  * `POST /api/clusters` (request/response format)
  * `GET /api/clusters/:jobId/status` (response format)
* [ ] Document error codes and messages
* [ ] Provide example requests/responses
* [ ] Note that endpoints use **HTTPS**

### Integration Documentation

* [ ] Architecture overview of integration
* [ ] Workspace creation data flow
* [ ] Cluster creation async job pattern
* [ ] Backstage proxy configuration (**HTTPS backend**)
* [ ] Certificate trust setup for development
* [ ] Any configuration changes needed

### Developer Documentation

* [ ] How to build and deploy backend changes with TLS
* [ ] How to start and test frontend with certificate trust
* [ ] Troubleshooting guide (including TLS errors)
* [ ] All required environment variables (including `NODE_EXTRA_CA_CERTS`)

### Deployment Guide

* [ ] Full deployment process with `make deploy-local-tls`
* [ ] Prerequisites (Docker, kubectl, Helm, etc.)
* [ ] Step-by-step deployment instructions
* [ ] Rollback procedures
* [ ] **Explain why TLS is required**

**Validation Checkpoint:** Confirm documentation is complete and clear.

---

## Phase 7: Deployment Preparation

### Configuration Review

* [ ] Review all environment variables used
* [ ] Ensure no hardcoded values (URLs, ports, etc.)
* [ ] Document required configurations including certificate paths
* [ ] Verify configuration validation on startup

### Deployment Artifacts

* [ ] Document Makefile targets used (especially `deploy-local-tls`)
* [ ] Document Helm chart modifications (if any)
* [ ] Create deployment checklist
* [ ] Document service dependencies
* [ ] Document TLS certificate generation process

### Monitoring

* [ ] Document key logs to monitor
* [ ] Document metrics to track
* [ ] Document common failure modes (including TLS issues)
* [ ] Provide debugging tips

**Validation Checkpoint:** Confirm deployment readiness.

---

## Final Deliverables

* [ ] List all files changed in `aegis-platform`
* [ ] List all files changed in `aegis-ui`
* [ ] Summarize new endpoints added (with **HTTPS** URLs)
* [ ] Summarize frontend components modified
* [ ] Testing results summary
* [ ] Known limitations
* [ ] Recommendations for next steps
* [ ] Architecture diagram or detailed description
* [ ] Links to all documentation created
* [ ] **Note about TLS deployment requirement**

---

## Execution Instructions

1. Work through each phase sequentially
2. Complete **ALL** tasks in a phase before moving to next
3. Validate at each checkpoint and report findings
4. If build/deploy/test fails: analyze, fix, iterate until successful
5. Make autonomous decisions based on existing code patterns
6. Prioritize working integration over perfect code
7. Both repos have `.geminiignore` to focus on source files only
8. Follow deployment workflows exactly as specified
9. **Do NOT** bypass authentication or deployment steps
10. **ALWAYS** use `make deploy-local-tls` (never `make deploy-local`)
11. **ALWAYS** use HTTPS URLs for backend (`https://platform-api.localtest.me`)
12. **ALWAYS** set `NODE_EXTRA_CA_CERTS` for frontend
13. Report progress and blockers clearly

---
