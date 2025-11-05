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
  opsMetricsRouteRef,
  opsResourceDetailsRouteRef,
  opsLogExplorerRouteRef,
  opsAlertsRouteRef,
  opsConfigRouteRef,
  costAnalyticsRouteRef,
  projectManagementRouteRef,
  policyManagementRouteRef,
  userManagementRouteRef,
  auditLogRouteRef,
  createClusterRouteRef,
  createProjectRouteRef,
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

export const AegisCreateClusterPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCreateClusterPage',
    component: () =>
      import('./components/CreateClusterPage').then(
        m => m.CreateClusterPage,
      ),
    mountPoint: createClusterRouteRef,
  }),
);

export const AegisCreateProjectPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCreateProjectPage',
    component: () =>
      import('./components/projects/CreateProjectPage').then(
        m => m.CreateProjectPage,
      ),
    mountPoint: createProjectRouteRef,
  }),
);

export const AegisCostAnalyticsFinOpsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCostAnalyticsFinOpsPage',
    component: () =>
      import('./components/AegisCostDashboardPage').then(
        m => m.AegisCostDashboardPage,
      ),
    mountPoint: costDashboardRouteRef,
  }),
);

export const AegisQuotaManagementFinOpsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisQuotaManagementFinOpsPage',
    component: () =>
      import('./components/AegisQuotaManagementPage').then(
        m => m.AegisQuotaManagementPage,
      ),
    mountPoint: quotaManagementRouteRef,
  }),
);

export const AegisBillingAlertsFinOpsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisBillingAlertsFinOpsPage',
    component: () =>
      import('./components/AegisBillingAlertsPage').then(
        m => m.AegisBillingAlertsPage,
      ),
    mountPoint: billingAlertsRouteRef,
  }),
);

export const AegisOpsMetricsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisOpsMetricsPage',
    component: () =>
      import('./components/AegisOpsMetricsPage').then(
        m => m.AegisOpsMetricsPage,
      ),
    mountPoint: opsMetricsRouteRef,
  }),
);

export const AegisResourceDetailsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisResourceDetailsPage',
    component: () =>
      import('./components/AegisResourceDetailsPage').then(
        m => m.AegisResourceDetailsPage,
      ),
    mountPoint: opsResourceDetailsRouteRef,
  }),
);

export const AegisLogExplorerPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisLogExplorerPage',
    component: () =>
      import('./components/AegisLogExplorerPage').then(
        m => m.AegisLogExplorerPage,
      ),
    mountPoint: opsLogExplorerRouteRef,
  }),
);

export const AegisAlertsDashboardPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisAlertsDashboardPage',
    component: () =>
      import('./components/AegisAlertsDashboardPage').then(
        m => m.AegisAlertsDashboardPage,
      ),
    mountPoint: opsAlertsRouteRef,
  }),
);

export const AegisClusterConfigPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisClusterConfigPage',
    component: () =>
      import('./components/AegisClusterConfigPage').then(
        m => m.AegisClusterConfigPage,
      ),
    mountPoint: opsConfigRouteRef,
  }),
);

export const AegisCostAnalyticsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCostAnalyticsPage',
    component: () =>
      import('./components/AegisCostAnalyticsPage').then(
        m => m.AegisCostAnalyticsPage,
      ),
    mountPoint: costAnalyticsRouteRef,
  }),
);

export const AegisPolicyManagementPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisPolicyManagementPage',
    component: () =>
      import('./components/AegisPolicyManagementPage').then(
        m => m.AegisPolicyManagementPage,
      ),
    mountPoint: policyManagementRouteRef,
  }),
);

export const AegisProjectManagementPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisProjectManagementPage',
    component: () =>
      import('./components/projects/ProjectManagementPage').then(
        m => m.ProjectManagementPage,
      ),
    mountPoint: projectManagementRouteRef,
  }),
);

export const AegisUserManagementPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisUserManagementPage',
    component: () =>
      import('./components/AegisUserManagementPage').then(
        m => m.AegisUserManagementPage,
      ),
    mountPoint: userManagementRouteRef,
  }),
);

export const AegisAuditLogPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisAuditLogPage',
    component: () =>
      import('./components/AegisAuditLogPage').then(
        m => m.AegisAuditLogPage,
      ),
    mountPoint: auditLogRouteRef,
  }),
);
