export type ClusterPhase = 'Ready' | 'Provisioning' | 'Error';

export type ClusterCondition = {
  type: string;
  status: 'True' | 'False';
  message: string;
  lastTransitionTime: string;
};

export type NodePoolSummary = {
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  labels?: string[];
  taints?: string[];
};

export type ClusterActivity = {
  id: string;
  timestamp: string;
  title: string;
  description: string;
};

export type ClusterDetail = {
  id: string;
  name: string;
  projectId: string;
  region: string;
  phase: ClusterPhase;
  costHintPerHour: number;
  pulumiStack: string;
  additionalClusters?: string[];
  nodePools: NodePoolSummary[];
  conditions: ClusterCondition[];
  platformEndpoint?: string;
  caBundleProvided?: boolean;
  spokeImage?: string;
  valuesFile?: string;
  roleArn?: string;
  externalId?: string;
  vpcId?: string;
  kubeconfigSecretKey: string;
  activity: ClusterActivity[];
};

export const CLUSTERS: ClusterDetail[] = [
  {
    id: 'aurora-east',
    name: 'aurora-east',
    projectId: 'mission-orion',
    region: 'us-east-1',
    phase: 'Ready',
    costHintPerHour: 62.4,
    pulumiStack: 'mission-orion-us-east-1',
    additionalClusters: ['aurora-east-gpu'],
    nodePools: [
      {
        name: 'general-purpose',
        instanceType: 'm6i.large',
        minSize: 3,
        maxSize: 9,
        labels: ['node-role.kubernetes.io/compute=true'],
      },
      {
        name: 'gpu-batch',
        instanceType: 'g5.4xlarge',
        minSize: 2,
        maxSize: 6,
        labels: ['accelerator=true'],
        taints: ['nvidia.com/gpu=present:NoSchedule'],
      },
    ],
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        message: 'Cluster reporting healthy control plane.',
        lastTransitionTime: '2024-03-21T12:04:11Z',
      },
      {
        type: 'HelmSync',
        status: 'True',
        message: 'Aegis agent helm release deployed (v1.14.0).',
        lastTransitionTime: '2024-03-21T11:58:02Z',
      },
    ],
    platformEndpoint: 'https://platform.aegis.mil',
    caBundleProvided: true,
    spokeImage: 'registry.aegis.mil/spoke:2024-03-15',
    valuesFile: 'git::https://gitlab/aegis/platform//charts/values.yaml',
    roleArn: 'arn:aws:iam::123456789012:role/aegis-provisioner',
    externalId: 'mission-orion',
    vpcId: 'vpc-0a12bc34d56ef7890',
    kubeconfigSecretKey: 'aurora-east-admin',
    activity: [
      {
        id: 'evt-1',
        timestamp: '2024-03-21T11:50:12Z',
        title: 'Wizard submission',
        description: 'Operator submitted provisioning plan for aurora-east.',
      },
      {
        id: 'evt-2',
        timestamp: '2024-03-21T11:52:44Z',
        title: 'Pulumi up',
        description: 'Pulumi stack mission-orion-us-east-1 applied successfully.',
      },
      {
        id: 'evt-3',
        timestamp: '2024-03-21T11:57:35Z',
        title: 'Helm release',
        description: 'Aegis spoke helm chart upgraded to v1.14.0.',
      },
    ],
  },
  {
    id: 'sentinel-edge',
    name: 'sentinel-edge',
    projectId: 'mission-sentinel',
    region: 'us-west-2',
    phase: 'Provisioning',
    costHintPerHour: 28.1,
    pulumiStack: 'mission-sentinel-us-west-2',
    nodePools: [
      {
        name: 'edge-default',
        instanceType: 'm6i.xlarge',
        minSize: 2,
        maxSize: 4,
      },
    ],
    conditions: [
      {
        type: 'Provisioning',
        status: 'True',
        message: 'Waiting for node group bootstrap to complete (2/4).',
        lastTransitionTime: '2024-03-22T08:21:03Z',
      },
      {
        type: 'HelmSync',
        status: 'False',
        message: 'Pending platform endpoint secret propagation.',
        lastTransitionTime: '2024-03-22T08:20:43Z',
      },
    ],
    platformEndpoint: 'https://platform.aegis.mil',
    caBundleProvided: false,
    roleArn: 'arn:aws:iam::123456789012:role/aegis-edge-provisioner',
    kubeconfigSecretKey: 'sentinel-edge-admin',
    activity: [
      {
        id: 'evt-4',
        timestamp: '2024-03-22T08:16:12Z',
        title: 'Wizard submission',
        description: 'Import mode selected for sentinel-edge.',
      },
      {
        id: 'evt-5',
        timestamp: '2024-03-22T08:19:05Z',
        title: 'Pulumi refresh',
        description: 'Requested resource state refresh prior to import.',
      },
    ],
  },
  {
    id: 'atlas-mi300x',
    name: 'atlas-mi300x',
    projectId: 'mission-atlas',
    region: 'us-east-2',
    phase: 'Error',
    costHintPerHour: 45.7,
    pulumiStack: 'mission-atlas-us-east-2',
    additionalClusters: ['atlas-mi300x-gpu'],
    nodePools: [
      {
        name: 'mi300x-gpu',
        instanceType: 'g5.2xlarge',
        minSize: 1,
        maxSize: 3,
        taints: ['accelerator=true:NoSchedule'],
      },
    ],
    conditions: [
      {
        type: 'Error',
        status: 'True',
        message: 'Helm install failed: missing platform endpoint secret.',
        lastTransitionTime: '2024-03-20T19:43:55Z',
      },
      {
        type: 'Ready',
        status: 'False',
        message: 'Control plane available but agent registration blocked.',
        lastTransitionTime: '2024-03-20T19:40:02Z',
      },
    ],
    platformEndpoint: undefined,
    caBundleProvided: false,
    spokeImage: 'registry.aegis.mil/spoke:2024-02-01',
    valuesFile: undefined,
    roleArn: 'arn:aws:iam::987654321000:role/aegis-atlas-provisioner',
    kubeconfigSecretKey: 'atlas-mi300x-admin',
    activity: [
      {
        id: 'evt-6',
        timestamp: '2024-03-20T19:32:11Z',
        title: 'Wizard submission',
        description: 'New provisioning run initiated for atlas-mi300x.',
      },
      {
        id: 'evt-7',
        timestamp: '2024-03-20T19:42:06Z',
        title: 'Helm install error',
        description: 'Controller reported missing secret aegis-platform-endpoint.',
      },
    ],
  },
];
