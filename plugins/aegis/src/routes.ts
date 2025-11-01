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

export const costAnalyticsRouteRef = createSubRouteRef({
  id: 'aegis-cost-analytics',
  parent: rootRouteRef,
  path: '/admin/analytics',
});

export const policyManagementRouteRef = createSubRouteRef({
  id: 'aegis-policy-management',
  parent: rootRouteRef,
  path: '/admin/policies',
});

export const userManagementRouteRef = createSubRouteRef({
  id: 'aegis-user-management',
  parent: rootRouteRef,
  path: '/admin/users',
});

export const auditLogRouteRef = createSubRouteRef({
  id: 'aegis-audit-log',
  parent: rootRouteRef,
  path: '/admin/audit-logs',
});
