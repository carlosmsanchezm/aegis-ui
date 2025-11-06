import {
  ClusterActivityItem,
  ClusterDetail,
  ClusterJobCondition,
  ClusterNodePoolStatus,
  ClusterSummary,
} from '../../../../../plugins/aegis/src/api/aegisClient';

const makeCondition = (
  overrides: Partial<ClusterJobCondition> & Pick<ClusterJobCondition, 'type'>,
): ClusterJobCondition => ({
  status: 'True',
  message: 'Controller reported healthy status.',
  lastTransitionTime: new Date('2025-11-03T12:15:00Z').toISOString(),
  ...overrides,
});

const makeActivity = (items: Array<Partial<ClusterActivityItem> & Pick<ClusterActivityItem, 'phase'>>): ClusterActivityItem[] =>
  items.map((item, index) => ({
    id: `${item.phase}-${index}`,
    timestamp: new Date(Date.now() - index * 1_800_000).toISOString(),
    message: 'Controller reconciled successfully.',
    ...item,
  }));

const makeNodePool = (
  overrides: Partial<ClusterNodePoolStatus> &
    Pick<ClusterNodePoolStatus, 'name' | 'instanceType' | 'desiredSize' | 'minSize' | 'maxSize'>,
): ClusterNodePoolStatus => ({
  actualSize: overrides.desiredSize,
  labels: { 'node-role.kubernetes.io/workload': 'true' },
  taints: [],
  gpu: false,
  spot: false,
  ...overrides,
});

export const mockClusterSummaries: ClusterSummary[] = [
  {
    id: 'eks-west-edge',
    name: 'EKS West Edge',
    projectId: 'atlas-vision',
    mode: 'provision',
    provider: 'AWS EKS',
    region: 'us-west-2',
    phase: 'Ready',
    createdAt: new Date('2025-09-14T19:21:00Z').toISOString(),
    lastSyncedAt: new Date('2025-11-03T17:45:00Z').toISOString(),
    costEstimate: {
      hourly: 22.7,
      currency: 'USD',
      description: 'L40 nodes + control plane.',
    },
    latestCondition: makeCondition({
      type: 'ClusterReady',
      message: 'All controllers healthy and synchronized.',
    }),
  },
  {
    id: 'gke-europe-analytics',
    name: 'GKE Europe Analytics',
    projectId: 'conversational-rnd',
    mode: 'import',
    provider: 'Google GKE',
    region: 'europe-west3',
    phase: 'Provisioning',
    createdAt: new Date('2025-10-08T08:15:00Z').toISOString(),
    lastSyncedAt: new Date('2025-11-03T11:05:00Z').toISOString(),
    costEstimate: {
      hourly: 11.4,
      currency: 'EUR',
      description: 'Autoscaling GPU + CPU pools.',
    },
    latestCondition: makeCondition({
      type: 'ClusterReconciling',
      status: 'False',
      message: 'Import controller reconciling workload namespaces.',
    }),
  },
  {
    id: 'aks-mission-east',
    name: 'AKS Mission East',
    projectId: 'edge-deployment',
    mode: 'provision',
    provider: 'Azure AKS',
    region: 'us-east-1',
    phase: 'Degraded',
    createdAt: new Date('2025-07-22T14:52:00Z').toISOString(),
    lastSyncedAt: new Date('2025-11-03T16:02:00Z').toISOString(),
    costEstimate: {
      hourly: 18.9,
      currency: 'USD',
      description: 'Burst GPU + mission control pools.',
    },
    latestCondition: makeCondition({
      type: 'ClusterDegraded',
      message: 'Node pool telemetry-mission reporting high error rate.',
      status: 'False',
    }),
  },
];

const mockClusterDetailsList: ClusterDetail[] = [
  {
    ...mockClusterSummaries[0],
    accountId: '210987654321',
    kubernetesVersion: '1.28.3',
    nodePools: [
      makeNodePool({
        name: 'gpu-sprint',
        instanceType: 'g5.12xlarge',
        desiredSize: 2,
        minSize: 1,
        maxSize: 4,
        gpu: true,
        labels: { 'node-role.kubernetes.io/ml': 'true', 'node.kubernetes.io/instance-type': 'g5.12xlarge' },
        taints: [
          { key: 'workload', value: 'ml', effect: 'NoSchedule' },
        ],
      }),
      makeNodePool({
        name: 'ops-core',
        instanceType: 'm6i.2xlarge',
        desiredSize: 3,
        minSize: 2,
        maxSize: 6,
        labels: { 'node-role.kubernetes.io/ops': 'true' },
      }),
    ],
    platformOverrides: {
      apiServer: 'https://eks-west-edge.aws.internal',
      metricsEndpoint: 'https://metrics.eks-west-edge.aws.internal',
      loggingEndpoint: 'https://logs.eks-west-edge.aws.internal',
    },
    helm: {
      namespace: 'aegis-system',
      chartVersion: '0.9.4',
    },
    conditions: [
      makeCondition({
        type: 'ClusterReady',
        message: 'Cluster ready for workspace routing.',
      }),
      makeCondition({
        type: 'AutoscalerHealthy',
        message: 'Cluster autoscaler operating within guardrails.',
      }),
    ],
    endpoints: [
      {
        label: 'Prometheus',
        url: 'https://prometheus.eks-west-edge.aws.internal',
        type: 'metrics',
        description: 'Centralized metrics endpoint.',
      },
      {
        label: 'Kubernetes API',
        url: 'https://eks-west-edge.aws.internal',
        type: 'api',
      },
    ],
    kubeconfigSecrets: [
      {
        name: 'eks-west-edge-kubeconfig',
        namespace: 'aegis-system',
        description: 'Kubeconfig for platform operations.',
      },
    ],
    activity: makeActivity([
      {
        phase: 'Ready',
        message: 'Cluster ready for workspace routing.',
        actor: 'controller/aegis-cluster-operator',
      },
      {
        phase: 'Provisioning',
        message: 'Pulumi stacks converged.',
      },
    ]),
  },
  {
    ...mockClusterSummaries[1],
    kubernetesVersion: '1.27.1-gke.500',
    nodePools: [
      makeNodePool({
        name: 'gke-gpu-autopilot',
        instanceType: 'n1-standard-16',
        desiredSize: 1,
        minSize: 0,
        maxSize: 5,
        gpu: true,
        labels: { 'node-role.kubernetes.io/ml': 'true' },
      }),
    ],
    platformOverrides: {
      apiServer: 'https://gke-europe-analytics.googleapis.com',
      metricsEndpoint: 'https://monitoring.googleapis.com/v1/projects/analytics',
    },
    helm: {
      namespace: 'aegis-system',
      chartVersion: '0.9.1',
    },
    conditions: [
      makeCondition({
        type: 'ClusterReconciling',
        message: 'Import controller reconciling workload namespaces.',
        status: 'False',
      }),
    ],
    activity: makeActivity([
      {
        phase: 'Reconciling',
        message: 'Validating imported namespaces.',
      },
      {
        phase: 'ImportStarted',
        message: 'Started importing cluster credentials.',
      },
    ]),
  },
  {
    ...mockClusterSummaries[2],
    kubernetesVersion: '1.27.7',
    nodePools: [
      makeNodePool({
        name: 'mission-gpu',
        instanceType: 'Standard_NC24ads_A100_v4',
        desiredSize: 2,
        minSize: 1,
        maxSize: 3,
        gpu: true,
        labels: {
          'mission-critical': 'true',
          'workload-tier': 'mission',
        },
        taints: [
          { key: 'mission', value: 'critical', effect: 'NoSchedule' },
        ],
      }),
      makeNodePool({
        name: 'telemetry-mission',
        instanceType: 'Standard_D8s_v5',
        desiredSize: 2,
        minSize: 1,
        maxSize: 4,
        labels: { 'mission-telemetry': 'true' },
      }),
    ],
    conditions: [
      makeCondition({
        type: 'ClusterDegraded',
        message: 'Telemetry pool experiencing node pressure.',
        status: 'False',
      }),
      makeCondition({
        type: 'MissionGuardrails',
        message: 'Guardrail automation engaged for telemetry pool.',
      }),
    ],
    activity: makeActivity([
      {
        phase: 'Degraded',
        message: 'Telemetry pool reporting high error rate.',
      },
      {
        phase: 'AutoscalerWarning',
        message: 'Autoscaler detected nodes near quota.',
      },
    ]),
    endpoints: [
      {
        label: 'Mission API Gateway',
        url: 'https://mission-east.api.azure.internal',
        type: 'api',
      },
    ],
    kubeconfigSecrets: [
      {
        name: 'aks-mission-east-kubeconfig',
        description: 'Mission enclave kubeconfig bundle.',
      },
    ],
  },
];

export const mockClusterDetails = Object.fromEntries(
  mockClusterDetailsList.map(detail => [detail.id, detail]),
);
