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
  costDashboardRouteRef,
  quotaManagementRouteRef,
  billingAlertsRouteRef,
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

export const AegisCostDashboardPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCostDashboardPage',
    component: () =>
      import('./components/AegisCostDashboardPage').then(
        m => m.AegisCostDashboardPage,
      ),
    mountPoint: costDashboardRouteRef,
  }),
);

export const AegisQuotaManagementPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisQuotaManagementPage',
    component: () =>
      import('./components/AegisQuotaManagementPage').then(
        m => m.AegisQuotaManagementPage,
      ),
    mountPoint: quotaManagementRouteRef,
  }),
);

export const AegisBillingAlertsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisBillingAlertsPage',
    component: () =>
      import('./components/AegisBillingAlertsPage').then(
        m => m.AegisBillingAlertsPage,
      ),
    mountPoint: billingAlertsRouteRef,
  }),
);
