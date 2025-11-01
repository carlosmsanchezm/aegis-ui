import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'aegis-root',
});

export const workloadsRouteRef = createSubRouteRef({
  id: 'aegis-workloads',
  parent: rootRouteRef,
  path: '/workloads',
});

export const workloadDetailsRouteRef = createSubRouteRef({
  id: 'aegis-workload-details',
  parent: rootRouteRef,
  path: '/workloads/:id',
});

export const launchWorkspaceRouteRef = createSubRouteRef({
  id: 'aegis-launch-workspace',
  parent: rootRouteRef,
  path: '/workspaces/launch',
});

export const createWorkspaceRouteRef = createSubRouteRef({
  id: 'aegis-create-workspace',
  parent: rootRouteRef,
  path: '/workspaces/create',
});

export const strategicOverviewRouteRef = createSubRouteRef({
  id: 'aegis-strategic-overview',
  parent: rootRouteRef,
  path: '/strategic/overview',
});

export const resilienceOverviewRouteRef = createSubRouteRef({
  id: 'aegis-resilience-report',
  parent: rootRouteRef,
  path: '/strategic/resilience',
});

export const governanceRouteRef = createSubRouteRef({
  id: 'aegis-governance-dashboard',
  parent: rootRouteRef,
  path: '/strategic/governance',
});

export const auditRouteRef = createSubRouteRef({
  id: 'aegis-audit-report',
  parent: rootRouteRef,
  path: '/strategic/audit',
});
