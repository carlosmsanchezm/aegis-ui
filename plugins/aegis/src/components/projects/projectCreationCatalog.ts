export type ProjectEnvironment = 'dev' | 'test' | 'prod';

export type DataConnectionDefinition = {
  id: string;
  name: string;
  type: 's3' | 'gcs' | 'postgres' | 'bigquery' | 'redshift' | 'blob';
  uri: string;
  description?: string;
};

export type SecretScopeDefinition = {
  id: string;
  name: string;
  provider: string;
  description?: string;
};

export type ClusterTargetDefinition = {
  id: string;
  name: string;
  region: string;
  complianceTier: 'IL2' | 'IL4' | 'IL5' | 'IL6';
};

export type ComputeProfileDefinition = {
  id: string;
  label: string;
  description: string;
  hourlyRate: number;
  resources: string;
  gpuSku: string;
  cluster: ClusterTargetDefinition;
  badges: string[];
  namespace: string;
  storageClass: string;
  networkZone: string;
  queueId: string;
  flavor: string;
};

export type ProjectDefinition = {
  id: string;
  displayName: string;
  environment: ProjectEnvironment;
  description: string;
  owners: string[];
  budget: {
    monthlyLimit: number;
    monthlyUsed: number;
  };
  dataConnections: DataConnectionDefinition[];
  secretScopes: SecretScopeDefinition[];
  computeProfiles: ComputeProfileDefinition[];
  defaultComputeProfileId: string;
};

const makeProfile = (
  overrides: Partial<ComputeProfileDefinition>,
): ComputeProfileDefinition => ({
  id: 'gpu-a10-small',
  label: '1×A10 • 4 vCPU / 32 GB RAM',
  description: 'Balanced single-GPU workspace for model fine-tuning and eval.',
  hourlyRate: 2.4,
  resources: '1×NVIDIA A10 • 4 vCPU • 32 GB RAM • 50 GB NVMe scratch',
  gpuSku: 'NVIDIA A10G',
  cluster: {
    id: 'eks-dev-1',
    name: 'EKS Dev Cluster',
    region: 'us-east-1',
    complianceTier: 'IL4',
  },
  badges: ['Auto-suspend after 4h idle', 'SBOM Verified'],
  namespace: 'aegis-dev',
  storageClass: 'gp3-encrypted',
  networkZone: 'Trusted - East',
  queueId: 'queue-a10-small',
  flavor: 'gpu-a10-small',
  ...overrides,
});

export const projectCreationCatalog: ProjectDefinition[] = [
  {
    id: 'acme-vision-dev',
    displayName: 'Acme Vision (Dev)',
    environment: 'dev',
    description:
      'Computer vision experimentation sandbox for perception model iteration and tooling.',
    owners: ['Naomi Henderson'],
    budget: {
      monthlyLimit: 8500,
      monthlyUsed: 6120,
    },
    dataConnections: [
      {
        id: 's3-acme-vision-dev',
        name: 'S3 – acme-vision-dev',
        type: 's3',
        uri: 's3://acme-vision-dev/',
        description: 'Primary raw and curated imagery bucket for dev workloads.',
      },
      {
        id: 'postgres-telemetry-ro',
        name: 'Postgres – Telemetry (RO)',
        type: 'postgres',
        uri: 'postgres://telemetry-ro',
        description: 'Read-only mission telemetry warehouse connection.',
      },
    ],
    secretScopes: [
      {
        id: 'kv-acme-vision-dev',
        name: 'Key Vault – Vision Dev',
        provider: 'AWS Secrets Manager',
      },
      {
        id: 'kv-shared-ci',
        name: 'Key Vault – Shared CI',
        provider: 'AWS Secrets Manager',
      },
    ],
    computeProfiles: [
      makeProfile({
        id: 'gpu-a10-small',
        label: '1×A10 • 4 vCPU / 32 GB RAM',
        hourlyRate: 2.4,
        queueId: 'queue-vision-a10',
        flavor: 'gpu-a10-small',
        cluster: {
          id: 'eks-dev-1',
          name: 'EKS Vision Dev',
          region: 'us-east-1',
          complianceTier: 'IL4',
        },
        namespace: 'acme-vision-dev',
        storageClass: 'gp3-encrypted',
        networkZone: 'Trusted-East',
        badges: ['FIPS Image', 'Auto cost alerts'],
      }),
      makeProfile({
        id: 'gpu-l4-medium',
        label: '1×L4 • 8 vCPU / 64 GB RAM',
        description: 'Medium GPU profile tuned for multimodal experimentation.',
        hourlyRate: 3.1,
        resources: '1×NVIDIA L4 • 8 vCPU • 64 GB RAM • 100 GB NVMe scratch',
        gpuSku: 'NVIDIA L4',
        queueId: 'queue-vision-l4',
        flavor: 'gpu-l4-medium',
        cluster: {
          id: 'eks-shared-1',
          name: 'EKS Shared GPU',
          region: 'us-east-1',
          complianceTier: 'IL4',
        },
        namespace: 'acme-vision-dev',
        storageClass: 'gp3-encrypted',
        networkZone: 'Trusted-East',
        badges: ['Policy guardrails enabled'],
      }),
    ],
    defaultComputeProfileId: 'gpu-a10-small',
  },
  {
    id: 'acme-vision-prod',
    displayName: 'Acme Vision (Prod)',
    environment: 'prod',
    description:
      'Production training environment for perception models and batch retraining jobs.',
    owners: ['Priya Desai'],
    budget: {
      monthlyLimit: 18000,
      monthlyUsed: 14320,
    },
    dataConnections: [
      {
        id: 's3-acme-vision-prod',
        name: 'S3 – acme-vision-prod',
        type: 's3',
        uri: 's3://acme-vision-prod/',
      },
      {
        id: 'redshift-mission',
        name: 'Redshift – Mission Warehouse',
        type: 'redshift',
        uri: 'redshift://mission-warehouse',
      },
    ],
    secretScopes: [
      {
        id: 'kv-acme-vision-prod',
        name: 'Key Vault – Vision Prod',
        provider: 'AWS Secrets Manager',
      },
    ],
    computeProfiles: [
      makeProfile({
        id: 'gpu-a100-large',
        label: '4×A100 • 32 vCPU / 256 GB RAM',
        description: 'High-performance queue for large-scale retraining workloads.',
        hourlyRate: 18.5,
        resources: '4×NVIDIA A100 80GB • 32 vCPU • 256 GB RAM • 1 TB NVMe scratch',
        gpuSku: 'NVIDIA A100 80GB',
        queueId: 'queue-vision-a100',
        flavor: 'gpu-a100-large',
        cluster: {
          id: 'eks-prod-1',
          name: 'EKS Vision Prod',
          region: 'us-west-2',
          complianceTier: 'IL5',
        },
        namespace: 'acme-vision-prod',
        storageClass: 'gp3-encrypted',
        networkZone: 'Mission-West',
        badges: ['Dedicated account', 'Signed SBOM'],
      }),
      makeProfile({
        id: 'gpu-l40-balanced',
        label: '2×L40S • 16 vCPU / 128 GB RAM',
        description: 'Latency-sensitive queue for evaluation and mission rehearsal.',
        hourlyRate: 9.2,
        resources: '2×NVIDIA L40S • 16 vCPU • 128 GB RAM • 500 GB NVMe scratch',
        gpuSku: 'NVIDIA L40S',
        queueId: 'queue-vision-l40',
        flavor: 'gpu-l40-balanced',
        cluster: {
          id: 'eks-prod-2',
          name: 'EKS Mission Edge',
          region: 'us-west-2',
          complianceTier: 'IL5',
        },
        namespace: 'acme-vision-prod',
        storageClass: 'gp3-encrypted',
        networkZone: 'Mission-West',
        badges: ['Continuous monitoring'],
      }),
    ],
    defaultComputeProfileId: 'gpu-l40-balanced',
  },
  {
    id: 'acme-nlp-prod',
    displayName: 'Acme Conversational AI (Prod)',
    environment: 'prod',
    description:
      'Conversational model operations with RLHF workflows and evaluation harnesses.',
    owners: ['Miguel Alvarez'],
    budget: {
      monthlyLimit: 15500,
      monthlyUsed: 12880,
    },
    dataConnections: [
      {
        id: 's3-convo-prod',
        name: 'S3 – convo-prod',
        type: 's3',
        uri: 's3://convo-prod/',
      },
      {
        id: 'postgres-feedback',
        name: 'Postgres – Feedback DB',
        type: 'postgres',
        uri: 'postgres://feedback-prod',
      },
    ],
    secretScopes: [
      {
        id: 'kv-convo-prod',
        name: 'Key Vault – Convo Prod',
        provider: 'AWS Secrets Manager',
      },
    ],
    computeProfiles: [
      makeProfile({
        id: 'gpu-h100-xl',
        label: '8×H100 • 48 vCPU / 384 GB RAM',
        description: 'Flagship queue for RLHF and large fine-tunes.',
        hourlyRate: 28.0,
        resources: '8×NVIDIA H100 80GB • 48 vCPU • 384 GB RAM • 1.5 TB NVMe scratch',
        gpuSku: 'NVIDIA H100 80GB',
        queueId: 'queue-convo-h100',
        flavor: 'gpu-h100-xl',
        cluster: {
          id: 'eks-convo-1',
          name: 'EKS Conversational Prod',
          region: 'us-central-1',
          complianceTier: 'IL6',
        },
        namespace: 'acme-nlp-prod',
        storageClass: 'io2-block-express',
        networkZone: 'Mission-Central',
        badges: ['Dedicated cluster', 'Air-gapped'],
      }),
      makeProfile({
        id: 'gpu-l40-flex',
        label: '1×L40S • 12 vCPU / 96 GB RAM',
        description: 'Burst queue for evaluation harnesses and alignment runs.',
        hourlyRate: 6.5,
        resources: '1×NVIDIA L40S • 12 vCPU • 96 GB RAM • 200 GB NVMe scratch',
        gpuSku: 'NVIDIA L40S',
        queueId: 'queue-convo-l40',
        flavor: 'gpu-l40-flex',
        cluster: {
          id: 'eks-shared-2',
          name: 'EKS Shared GPU (Prod)',
          region: 'us-central-1',
          complianceTier: 'IL5',
        },
        namespace: 'acme-nlp-prod',
        storageClass: 'gp3-encrypted',
        networkZone: 'Mission-Central',
        badges: ['Policy guardrails enabled'],
      }),
    ],
    defaultComputeProfileId: 'gpu-l40-flex',
  },
];

export const environmentsCopy: Record<ProjectEnvironment, { label: string; tone: 'default' | 'primary' | 'secondary' | 'error' }> = {
  dev: { label: 'Development', tone: 'primary' },
  test: { label: 'Test', tone: 'secondary' },
  prod: { label: 'Production', tone: 'error' },
};
