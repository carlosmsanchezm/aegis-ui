export type ProjectVisibility = 'restricted' | 'internal' | 'public';

export type ProjectEnvironment = 'dev' | 'test' | 'prod';

export type DataConnectionDefinition = {
  id: string;
  label: string;
  type: 's3' | 'postgres' | 'bigquery' | 'blob' | 'lakehouse';
  target: string;
  description: string;
  readOnly: boolean;
};

export type SecretScopeDefinition = {
  id: string;
  label: string;
  provider: 'aws' | 'azure' | 'gcp';
  description: string;
};

export type BudgetDefinition = {
  monthlyLimit: number;
  monthlyUsed: number;
};

export type ComputeProfileGrant = {
  id: string;
  label: string;
  description: string;
  hourlyRateUsd: number;
  gpu: string;
  cpu: string;
  memory: string;
  scratch?: string;
  queueId: string;
  flavorId: string;
  clusters: string[];
  badges?: string[];
  visibility: ProjectVisibility;
};

export type GuardrailDefinition = {
  maxConcurrentWorkspaces: number;
  maxGpuCount: number;
  maxBudgetPerWorkspaceUsd: number;
};

export type ProjectDefinition = {
  id: string;
  slug: string;
  name: string;
  environment: ProjectEnvironment;
  visibility: ProjectVisibility;
  description: string;
  lead: string;
  budget: BudgetDefinition;
  defaultComputeProfile: string;
  computeProfiles: ComputeProfileGrant[];
  dataConnections: DataConnectionDefinition[];
  secretScopes: SecretScopeDefinition[];
  guardrails: GuardrailDefinition;
  badges?: string[];
  costAlerts?: string[];
};

export const projectCatalog: ProjectDefinition[] = [
  {
    id: 'atlas-vision',
    slug: 'acme-vision-prod',
    name: 'Atlas Vision Training',
    environment: 'prod',
    visibility: 'restricted',
    description:
      'High-fidelity perception models, classified datasets, and mission telemetry replay workloads.',
    lead: 'Lt. Naomi Henderson',
    budget: {
      monthlyLimit: 18000,
      monthlyUsed: 16240,
    },
    defaultComputeProfile: 'gpu-a10-balanced',
    computeProfiles: [
      {
        id: 'gpu-a10-balanced',
        label: '1×A10 Balanced',
        description:
          'Curated A10 queue tuned for day-to-day experimentation with guardrails for 24 hr runtimes.',
        hourlyRateUsd: 2.4,
        gpu: '1×NVIDIA A10',
        cpu: '4 vCPU',
        memory: '32 GiB RAM',
        scratch: '50 GiB NVMe scratch',
        queueId: 'perception-tactical',
        flavorId: 'gpu-a10-balanced',
        clusters: ['eks-prod-vision-1', 'eks-prod-vision-2'],
        badges: ['FIPS image', 'Signed SBOM'],
        visibility: 'restricted',
      },
      {
        id: 'gpu-a100-burst',
        label: '4×A100 Burst',
        description:
          'High-intensity burst queue for overnight retraining with budget pre-checks and policy enforcement.',
        hourlyRateUsd: 18.75,
        gpu: '4×NVIDIA A100 80GB',
        cpu: '64 vCPU',
        memory: '512 GiB RAM',
        scratch: '1 TB NVMe scratch',
        queueId: 'atlas-batch',
        flavorId: 'gpu-a100-burst',
        clusters: ['eks-prod-vision-2'],
        badges: ['FIPS image', 'Org policy OK'],
        visibility: 'restricted',
      },
    ],
    dataConnections: [
      {
        id: 's3-acme-vision-prod',
        label: 'S3 — acme-vision-prod/',
        type: 's3',
        target: 's3://acme-vision-prod/',
        description: 'Primary perception datasets and labeled imagery.',
        readOnly: false,
      },
      {
        id: 'postgres-telemetry-ro',
        label: 'Postgres — telemetry-ro',
        type: 'postgres',
        target: 'postgresql://telemetry-ro:5432/atlas',
        description: 'Read-only mission telemetry for replay scenarios.',
        readOnly: true,
      },
    ],
    secretScopes: [
      {
        id: 'kv-acme-vision-prod',
        label: 'KeyVault — vision-prod',
        provider: 'azure',
        description: 'Model signing keys and service credentials.',
      },
      {
        id: 'sm-edge-ingest',
        label: 'SecretsManager — edge-ingest',
        provider: 'aws',
        description: 'Edge ingest pipeline tokens.',
      },
    ],
    guardrails: {
      maxConcurrentWorkspaces: 12,
      maxGpuCount: 16,
      maxBudgetPerWorkspaceUsd: 200,
    },
    badges: ['IL5 Certified'],
    costAlerts: ['72% of monthly budget consumed'],
  },
  {
    id: 'conversational-rnd',
    slug: 'acme-convo-dev',
    name: 'Conversational R&D',
    environment: 'dev',
    visibility: 'internal',
    description:
      'Dialogue model experimentation with RLHF iterations and synthetic data generation.',
    lead: 'Capt. Miguel Alvarez',
    budget: {
      monthlyLimit: 15500,
      monthlyUsed: 14980,
    },
    defaultComputeProfile: 'gpu-l40s-sprint',
    computeProfiles: [
      {
        id: 'gpu-l40s-sprint',
        label: '2×L40S Sprint',
        description:
          'Low-latency conversational fine-tuning queue with burstable autoscaling.',
        hourlyRateUsd: 6.9,
        gpu: '2×NVIDIA L40S',
        cpu: '24 vCPU',
        memory: '192 GiB RAM',
        scratch: '200 GiB NVMe scratch',
        queueId: 'dialogue-accelerator',
        flavorId: 'gpu-l40s-sprint',
        clusters: ['gke-dialogue-dev'],
        badges: ['Signed SBOM'],
        visibility: 'internal',
      },
      {
        id: 'gpu-a40-lab',
        label: '1×A40 Lab',
        description:
          'Economical queue for reward model training and evaluation.',
        hourlyRateUsd: 3.2,
        gpu: '1×NVIDIA A40',
        cpu: '16 vCPU',
        memory: '128 GiB RAM',
        scratch: '100 GiB NVMe scratch',
        queueId: 'alignment-lab',
        flavorId: 'gpu-a40-lab',
        clusters: ['gke-dialogue-dev'],
        visibility: 'public',
      },
    ],
    dataConnections: [
      {
        id: 's3-convo-dev',
        label: 'S3 — convo-dev/',
        type: 's3',
        target: 's3://convo-dev/',
        description: 'Synthetic dialogue corpora and RLHF transcripts.',
        readOnly: false,
      },
      {
        id: 'postgres-feedback-ro',
        label: 'Postgres — feedback-ro',
        type: 'postgres',
        target: 'postgresql://feedback-ro:5432/convo',
        description: 'Read-only human feedback metadata.',
        readOnly: true,
      },
    ],
    secretScopes: [
      {
        id: 'sm-convo-dev',
        label: 'SecretsManager — convo-dev',
        provider: 'aws',
        description: 'Synthetic data generator API tokens.',
      },
      {
        id: 'kv-shared-ml',
        label: 'KeyVault — shared-ml',
        provider: 'azure',
        description: 'Shared experimentation credentials.',
      },
    ],
    guardrails: {
      maxConcurrentWorkspaces: 10,
      maxGpuCount: 12,
      maxBudgetPerWorkspaceUsd: 120,
    },
    badges: ['Sandbox Guardrails'],
    costAlerts: ['96% of monthly budget consumed'],
  },
  {
    id: 'edge-deployment',
    slug: 'acme-edge-test',
    name: 'Edge Deployment Validation',
    environment: 'test',
    visibility: 'internal',
    description:
      'Hardware-in-the-loop validation, edge runtime packaging, and reliability testing.',
    lead: 'Dr. Priya Desai',
    budget: {
      monthlyLimit: 9200,
      monthlyUsed: 8740,
    },
    defaultComputeProfile: 'gpu-rtx-validation',
    computeProfiles: [
      {
        id: 'gpu-rtx-validation',
        label: '1×RTX 6000 QA',
        description:
          'GPU-light queue with conservative guardrails for integration validation and packaging.',
        hourlyRateUsd: 1.8,
        gpu: '1×RTX 6000 Ada',
        cpu: '12 vCPU',
        memory: '64 GiB RAM',
        scratch: '80 GiB NVMe scratch',
        queueId: 'edge-verification',
        flavorId: 'gpu-rtx-validation',
        clusters: ['aks-edge-test'],
        visibility: 'internal',
      },
      {
        id: 'gpu-a100-readiness',
        label: '2×A100 Readiness',
        description:
          'Mission readiness queue with heightened monitoring and pre-flight policy checks.',
        hourlyRateUsd: 9.5,
        gpu: '2×NVIDIA A100 40GB',
        cpu: '32 vCPU',
        memory: '256 GiB RAM',
        scratch: '400 GiB NVMe scratch',
        queueId: 'mission-readiness',
        flavorId: 'gpu-a100-readiness',
        clusters: ['aks-edge-test'],
        badges: ['Org policy OK'],
        visibility: 'restricted',
      },
    ],
    dataConnections: [
      {
        id: 'blob-edge-artifacts',
        label: 'ADLS — edge-artifacts',
        type: 'blob',
        target: 'https://storage.windows.net/edge-artifacts',
        description: 'Edge firmware bundles and validation assets.',
        readOnly: false,
      },
      {
        id: 'lakehouse-telemetry',
        label: 'Lakehouse — mission-telemetry',
        type: 'lakehouse',
        target: 'abfss://mission-telemetry@edge.dfs.core.windows.net',
        description: 'Historical mission telemetry for regression runs.',
        readOnly: true,
      },
    ],
    secretScopes: [
      {
        id: 'kv-edge-shared',
        label: 'KeyVault — edge-shared',
        provider: 'azure',
        description: 'Edge deployment signing certificates.',
      },
    ],
    guardrails: {
      maxConcurrentWorkspaces: 8,
      maxGpuCount: 8,
      maxBudgetPerWorkspaceUsd: 90,
    },
    badges: ['IL4 Segmented'],
  },
];

export const visibilityCopy: Record<
  ProjectVisibility,
  { label: string; tone: 'default' | 'primary' | 'secondary' }
> = {
  restricted: { label: 'Restricted', tone: 'secondary' },
  internal: { label: 'Internal', tone: 'primary' },
  public: { label: 'Public', tone: 'default' },
};
