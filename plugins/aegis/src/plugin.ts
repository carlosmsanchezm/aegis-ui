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
  createProjectRouteRef,
  clusterProfilesRouteRef,
  iacConnectorsRouteRef,
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
      import('./components/SubmitWorkloadPage').then(m => m.SubmitWorkloadPage as any),
    mountPoint: rootRouteRef,
  }),
);

export const AegisWorkloadListPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisWorkloadListPage',
    component: () =>
      import('./components/WorkloadListPage').then(m => m.WorkloadListPage as any),
    mountPoint: workloadsRouteRef as any,
  }),
);

export const AegisWorkloadDetailsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisWorkloadDetailsPage',
    component: () =>
      import('./components/WorkloadDetailsPage').then(
        m => m.WorkloadDetailsPage as any,
      ),
    mountPoint: workloadDetailsRouteRef as any,
  }),
);

export const AegisLaunchWorkspacePage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisLaunchWorkspacePage',
    component: () =>
      import('./components/LaunchWorkspacePage').then(
        m => m.LaunchWorkspacePage as any,
      ),
    mountPoint: launchWorkspaceRouteRef as any,
  }),
);

export const AegisCreateWorkspacePage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCreateWorkspacePage',
    component: () =>
      import('./components/LaunchWorkspacePage').then(
        m => m.LaunchWorkspacePage as any,
      ),
    mountPoint: createWorkspaceRouteRef as any,
  }),
);

export const AegisCreateProjectPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCreateProjectPage',
    component: () =>
      import('./components/projects/CreateProjectPage').then(
        m => m.CreateProjectPage as any,
      ),
    mountPoint: createProjectRouteRef as any,
  }),
);

export const AegisCostAnalyticsFinOpsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCostAnalyticsFinOpsPage',
    component: () =>
      import('./components/AegisCostDashboardPage').then(
        m => m.AegisCostDashboardPage as any,
      ),
    mountPoint: costDashboardRouteRef,
  }),
);

export const AegisQuotaManagementFinOpsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisQuotaManagementFinOpsPage',
    component: () =>
      import('./components/AegisQuotaManagementPage').then(
        m => m.AegisQuotaManagementPage as any,
      ),
    mountPoint: quotaManagementRouteRef,
  }),
);

export const AegisBillingAlertsFinOpsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisBillingAlertsFinOpsPage',
    component: () =>
      import('./components/AegisBillingAlertsPage').then(
        m => m.AegisBillingAlertsPage as any,
      ),
    mountPoint: billingAlertsRouteRef,
  }),
);

export const AegisOpsMetricsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisOpsMetricsPage',
    component: () =>
      import('./components/AegisOpsMetricsPage').then(
        m => m.AegisOpsMetricsPage as any,
      ),
    mountPoint: opsMetricsRouteRef,
  }),
);

export const AegisResourceDetailsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisResourceDetailsPage',
    component: () =>
      import('./components/AegisResourceDetailsPage').then(
        m => m.AegisResourceDetailsPage as any,
      ),
    mountPoint: opsResourceDetailsRouteRef,
  }),
);

export const AegisLogExplorerPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisLogExplorerPage',
    component: () =>
      import('./components/AegisLogExplorerPage').then(
        m => m.AegisLogExplorerPage as any,
      ),
    mountPoint: opsLogExplorerRouteRef,
  }),
);

export const AegisAlertsDashboardPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisAlertsDashboardPage',
    component: () =>
      import('./components/AegisAlertsDashboardPage').then(
        m => m.AegisAlertsDashboardPage as any,
      ),
    mountPoint: opsAlertsRouteRef,
  }),
);

export const AegisClusterConfigPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisClusterConfigPage',
    component: () =>
      import('./components/AegisClusterConfigPage').then(
        m => m.AegisClusterConfigPage as any,
      ),
    mountPoint: opsConfigRouteRef,
  }),
);

export const AegisCostAnalyticsPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCostAnalyticsPage',
    component: () =>
      import('./components/AegisCostAnalyticsPage').then(
        m => m.AegisCostAnalyticsPage as any,
      ),
    mountPoint: costAnalyticsRouteRef as any,
  }),
);

export const AegisPolicyManagementPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisPolicyManagementPage',
    component: () =>
      import('./components/AegisPolicyManagementPage').then(
        m => m.AegisPolicyManagementPage as any,
      ),
    mountPoint: policyManagementRouteRef as any,
  }),
);

export const AegisProjectManagementPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisProjectManagementPage',
    component: () =>
      import('./components/projects/ProjectManagementPage').then(
        m => m.ProjectManagementPage as any,
      ),
    mountPoint: projectManagementRouteRef as any,
  }),
);

export const AegisUserManagementPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisUserManagementPage',
    component: () =>
      import('./components/AegisUserManagementPage').then(
        m => m.AegisUserManagementPage as any,
      ),
    mountPoint: userManagementRouteRef as any,
  }),
);

export const AegisAuditLogPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisAuditLogPage',
    component: () =>
      import('./components/AegisAuditLogPage').then(
        m => m.AegisAuditLogPage as any,
      ),
    mountPoint: auditLogRouteRef as any,
  }),
);

export const AegisClusterProfilesAdminPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisClusterProfilesAdminPage',
    component: () =>
      import('./components/admin/ClusterProfilesAdminPage').then(
        m => m.ClusterProfilesAdminPage as any,
      ),
    mountPoint: clusterProfilesRouteRef as any,
  }),
);

export const AegisIaCConnectorsAdminPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisIaCConnectorsAdminPage',
    component: () =>
      import('./components/admin/IaCConnectorsAdminPage').then(
        m => m.IaCConnectorsAdminPage as any,
      ),
    mountPoint: iacConnectorsRouteRef as any,
  }),
);
