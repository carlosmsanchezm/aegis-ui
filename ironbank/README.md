# aegis-ui

Aegis Platform UI — Backstage-based developer portal for GPU workload management.

## Description

The Aegis UI is a Backstage-based developer portal that provides:

- GPU workload submission and monitoring
- Cluster management and status visualization
- Workspace lifecycle management with VS Code Remote connection
- Project and budget dashboard
- Queue and flavor configuration

## Base Image

`registry1.dso.mil/ironbank/opensource/nodejs/nodejs22:22.14`

## Ports

| Port | Protocol | Description |
|------|----------|-------------|
| 7007 | HTTP | Backstage application server |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_HOST` | Yes | PostgreSQL host for Backstage catalog |
| `POSTGRES_PORT` | Yes | PostgreSQL port |
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aegis-ui
  namespace: aegis-system
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: ui
          image: registry1.dso.mil/ironbank/aegis/ui:1.0.0
          ports:
            - containerPort: 7007
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
          securityContext:
            runAsUser: 1000
            runAsGroup: 1000
            runAsNonRoot: true
```

## Resource Requirements

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 250m | 1000m |
| Memory | 512Mi | 1Gi |
