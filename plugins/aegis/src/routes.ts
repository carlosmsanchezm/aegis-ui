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

export const costDashboardRouteRef = createSubRouteRef({
  id: 'aegis-cost-dashboard',
  parent: rootRouteRef,
  path: '/finops/cost-dashboard',
});

export const quotaManagementRouteRef = createSubRouteRef({
  id: 'aegis-quota-management',
  parent: rootRouteRef,
  path: '/finops/quotas',
});

export const billingAlertsRouteRef = createSubRouteRef({
  id: 'aegis-billing-alerts',
  parent: rootRouteRef,
  path: '/finops/alerts',
});

export const opsMetricsRouteRef = createSubRouteRef({
  id: 'aegis-operations-metrics',
  parent: rootRouteRef,
  path: '/operations/metrics',
});

export const opsResourceDetailsRouteRef = createSubRouteRef({
  id: 'aegis-operations-resource-details',
  parent: rootRouteRef,
  path: '/operations/resources/:resourceId',
});

export const opsLogExplorerRouteRef = createSubRouteRef({
  id: 'aegis-operations-logs',
  parent: rootRouteRef,
  path: '/operations/logs',
});

export const opsAlertsRouteRef = createSubRouteRef({
  id: 'aegis-operations-alerts',
  parent: rootRouteRef,
  path: '/operations/alerts',
});

export const opsConfigRouteRef = createSubRouteRef({
  id: 'aegis-operations-configuration',
  parent: rootRouteRef,
  path: '/operations/configuration',
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
