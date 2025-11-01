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
