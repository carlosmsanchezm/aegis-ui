import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'aegis-root',
});

export const workloadsRouteRef = createSubRouteRef({
  id: 'aegis-workspaces',
  parent: rootRouteRef,
  path: '/workspaces',
});

export const workloadDetailsRouteRef = createSubRouteRef({
  id: 'aegis-workspace-details',
  parent: rootRouteRef,
  path: '/workspaces/:id',
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

export const costDashboardRouteRef = createRouteRef({
  id: 'aegis-cost-dashboard',
});

export const quotaManagementRouteRef = createRouteRef({
  id: 'aegis-quota-management',
});

export const billingAlertsRouteRef = createRouteRef({
  id: 'aegis-billing-alerts',
});

export const opsMetricsRouteRef = createRouteRef({
  id: 'aegis-operations-metrics',
});

export const opsResourceDetailsRouteRef = createRouteRef({
  id: 'aegis-operations-resource-details',
});

export const opsLogExplorerRouteRef = createRouteRef({
  id: 'aegis-operations-logs',
});

export const opsAlertsRouteRef = createRouteRef({
  id: 'aegis-operations-alerts',
});

export const opsConfigRouteRef = createRouteRef({
  id: 'aegis-operations-configuration',
});

export const costAnalyticsRouteRef = createSubRouteRef({
  id: 'aegis-cost-analytics',
  parent: rootRouteRef,
  path: '/admin/analytics',
});

export const projectManagementRouteRef = createSubRouteRef({
  id: 'aegis-project-management',
  parent: rootRouteRef,
  path: '/admin/projects',
});

export const createProjectRouteRef = createSubRouteRef({
  id: 'aegis-create-project',
  parent: rootRouteRef,
  path: '/admin/projects/create',
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

export const clusterProfilesRouteRef = createSubRouteRef({
  id: 'aegis-cluster-profiles',
  parent: rootRouteRef,
  path: '/admin/cluster-profiles',
});

export const iacConnectorsRouteRef = createSubRouteRef({
  id: 'aegis-iac-connectors',
  parent: rootRouteRef,
  path: '/admin/iac-connectors',
});
