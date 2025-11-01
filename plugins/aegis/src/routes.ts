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

export const executiveOverviewRouteRef = createSubRouteRef({
  id: 'aegis-executive-overview',
  parent: rootRouteRef,
  path: '/executive/overview',
});

export const resilienceRouteRef = createSubRouteRef({
  id: 'aegis-resilience-report',
  parent: rootRouteRef,
  path: '/executive/resilience',
});

export const governanceRouteRef = createSubRouteRef({
  id: 'aegis-governance-dashboard',
  parent: rootRouteRef,
  path: '/executive/governance',
});

export const auditRouteRef = createSubRouteRef({
  id: 'aegis-audit-report',
  parent: rootRouteRef,
  path: '/executive/audit',
});
