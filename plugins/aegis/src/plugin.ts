import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import {
  rootRouteRef,
  workloadsRouteRef,
  workloadDetailsRouteRef,
  launchWorkspaceRouteRef,
  createWorkspaceRouteRef,
  operationsMetricsRouteRef,
  operationsResourceDetailsRouteRef,
  operationsLogExplorerRouteRef,
  operationsAlertsRouteRef,
  operationsConfigRouteRef,
} from './routes';

export const aegisPlugin = createPlugin({
  id: 'aegis',
  routes: {
    root: rootRouteRef,
  },
});

export const AegisPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisPage',
    component: () =>
      import('./components/SubmitWorkloadPage').then(m => m.SubmitWorkloadPage),
    mountPoint: rootRouteRef,
  }),
);

export const AegisWorkloadListPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisWorkloadListPage',
    component: () =>
      import('./components/WorkloadListPage').then(m => m.WorkloadListPage),
    mountPoint: workloadsRouteRef,
  }),
);

export const AegisWorkloadDetailsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisWorkloadDetailsPage',
    component: () =>
      import('./components/WorkloadDetailsPage').then(
        m => m.WorkloadDetailsPage,
      ),
    mountPoint: workloadDetailsRouteRef,
  }),
);

export const AegisLaunchWorkspacePage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisLaunchWorkspacePage',
    component: () =>
      import('./components/LaunchWorkspacePage').then(
        m => m.LaunchWorkspacePage,
      ),
    mountPoint: launchWorkspaceRouteRef,
  }),
);

export const AegisCreateWorkspacePage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCreateWorkspacePage',
    component: () =>
      import('./components/LaunchWorkspacePage').then(
        m => m.LaunchWorkspacePage,
      ),
    mountPoint: createWorkspaceRouteRef,
  }),
);

export const AegisOpsMetricsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisOpsMetricsPage',
    component: () =>
      import('./components/AegisOpsMetricsPage').then(
        m => m.AegisOpsMetricsPage,
      ),
    mountPoint: operationsMetricsRouteRef,
  }),
);

export const AegisNodeDetailsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisNodeDetailsPage',
    component: () =>
      import('./components/AegisNodeDetailsPage').then(
        m => m.AegisNodeDetailsPage,
      ),
    mountPoint: operationsResourceDetailsRouteRef,
  }),
);

export const AegisLogExplorerPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisLogExplorerPage',
    component: () =>
      import('./components/AegisLogExplorerPage').then(
        m => m.AegisLogExplorerPage,
      ),
    mountPoint: operationsLogExplorerRouteRef,
  }),
);

export const AegisAlertsDashboardPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisAlertsDashboardPage',
    component: () =>
      import('./components/AegisAlertsDashboardPage').then(
        m => m.AegisAlertsDashboardPage,
      ),
    mountPoint: operationsAlertsRouteRef,
  }),
);

export const AegisClusterConfigPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisClusterConfigPage',
    component: () =>
      import('./components/AegisClusterConfigPage').then(
        m => m.AegisClusterConfigPage,
      ),
    mountPoint: operationsConfigRouteRef,
  }),
);
