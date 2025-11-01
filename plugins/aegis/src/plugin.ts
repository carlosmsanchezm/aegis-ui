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
  costAnalyticsRouteRef,
  policyManagementRouteRef,
  userManagementRouteRef,
  auditLogRouteRef,
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

export const AegisCostAnalyticsAdminPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisCostAnalyticsAdminPage',
    component: () =>
      import('./components/AegisCostAnalyticsPage').then(
        m => m.AegisCostAnalyticsPage,
      ),
    mountPoint: costAnalyticsRouteRef,
  }),
);

export const AegisPolicyManagementAdminPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisPolicyManagementAdminPage',
    component: () =>
      import('./components/AegisPolicyManagementPage').then(
        m => m.AegisPolicyManagementPage,
      ),
    mountPoint: policyManagementRouteRef,
  }),
);

export const AegisUserManagementAdminPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisUserManagementAdminPage',
    component: () =>
      import('./components/AegisUserManagementPage').then(
        m => m.AegisUserManagementPage,
      ),
    mountPoint: userManagementRouteRef,
  }),
);

export const AegisAuditLogAdminPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisAuditLogAdminPage',
    component: () =>
      import('./components/AegisAuditLogPage').then(m => m.AegisAuditLogPage),
    mountPoint: auditLogRouteRef,
  }),
);
