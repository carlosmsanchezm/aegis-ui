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

export const operationsMetricsRouteRef = createSubRouteRef({
  id: 'aegis-operations-metrics',
  parent: rootRouteRef,
  path: '/operations/metrics',
});

export const operationsResourceDetailsRouteRef = createSubRouteRef({
  id: 'aegis-operations-resource-details',
  parent: rootRouteRef,
  path: '/operations/resources/:resourceId',
});

export const operationsLogExplorerRouteRef = createSubRouteRef({
  id: 'aegis-operations-log-explorer',
  parent: rootRouteRef,
  path: '/operations/logs',
});

export const operationsAlertsRouteRef = createSubRouteRef({
  id: 'aegis-operations-alerts',
  parent: rootRouteRef,
  path: '/operations/alerts',
});

export const operationsConfigRouteRef = createSubRouteRef({
  id: 'aegis-operations-config',
  parent: rootRouteRef,
  path: '/operations/config',
});
