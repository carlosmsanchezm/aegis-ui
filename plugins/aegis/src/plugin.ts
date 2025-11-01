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
  strategicOverviewRouteRef,
  resilienceOverviewRouteRef,
  governanceRouteRef,
  auditRouteRef,
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

export const AegisStrategicOverviewPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisStrategicOverviewPage',
    component: () =>
      import('./components/AegisStrategicOverviewPage').then(
        m => m.AegisStrategicOverviewPage,
      ),
    mountPoint: strategicOverviewRouteRef,
  }),
);

export const AegisResilienceSlaPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisResilienceSlaPage',
    component: () =>
      import('./components/AegisResilienceSlaPage').then(
        m => m.AegisResilienceSlaPage,
      ),
    mountPoint: resilienceOverviewRouteRef,
  }),
);

export const AegisGovernanceDashboardPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisGovernanceDashboardPage',
    component: () =>
      import('./components/AegisGovernanceDashboardPage').then(
        m => m.AegisGovernanceDashboardPage,
      ),
    mountPoint: governanceRouteRef,
  }),
);

export const AegisAuditReportPage = aegisPlugin.provide(
  createRoutableExtension({
    name: 'AegisAuditReportPage',
    component: () =>
      import('./components/AegisAuditReportPage').then(
        m => m.AegisAuditReportPage,
      ),
    mountPoint: auditRouteRef,
  }),
);
