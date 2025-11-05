export type ProjectVisibility = 'restricted' | 'internal' | 'public';

export type QueueDefinition = {
  id: string;
  name: string;
  description: string;
  visibility: ProjectVisibility;
  gpuClass: string;
  maxRuntimeHours: number;
  activeWorkspaces: number;
  budget: {
    monthlyLimit: number;
    monthlyUsed: number;
  };
  clusterId?: string;
};

export type ProjectDefinition = {
  id: string;
  name: string;
  visibility: ProjectVisibility;
  description: string;
  lead: string;
  budget: {
    monthlyLimit: number;
    monthlyUsed: number;
  };
  defaultQueue: string;
  queues: QueueDefinition[];
};

export const sampleProjectCatalog: ProjectDefinition[] = [
  {
    id: 'atlas-vision',
    name: 'Atlas Vision Training',
    visibility: 'restricted',
    description:
      'High-fidelity perception models, classified datasets, and mission telemetry replay workloads.',
    lead: 'Lt. Naomi Henderson',
    budget: {
      monthlyLimit: 18000,
      monthlyUsed: 16240,
    },
    defaultQueue: 'perception-tactical',
    queues: [
      {
        id: 'perception-tactical',
        name: 'Perception - Tactical',
        description: 'A100 80GB cluster optimized for real-time perception workloads.',
        visibility: 'restricted',
        gpuClass: 'NVIDIA A100 80GB',
        maxRuntimeHours: 24,
        activeWorkspaces: 8,
        budget: {
          monthlyLimit: 12000,
          monthlyUsed: 10120,
        },
      },
      {
        id: 'atlas-batch',
        name: 'Atlas Batch',
        description: 'Nightly batch jobs and retraining with longer allowed runtimes.',
        visibility: 'internal',
        gpuClass: 'NVIDIA H100 80GB',
        maxRuntimeHours: 48,
        activeWorkspaces: 3,
        budget: {
          monthlyLimit: 6000,
          monthlyUsed: 5120,
        },
      },
    ],
  },
  {
    id: 'conversational-rnd',
    name: 'Conversational R&D',
    visibility: 'internal',
    description:
      'Dialogue model experimentation with RLHF iterations and synthetic data generation.',
    lead: 'Capt. Miguel Alvarez',
    budget: {
      monthlyLimit: 15500,
      monthlyUsed: 14980,
    },
    defaultQueue: 'dialogue-accelerator',
    queues: [
      {
        id: 'dialogue-accelerator',
        name: 'Dialogue Accelerator',
        description: 'Burstable GPU queue tuned for low-latency conversational fine-tuning.',
        visibility: 'internal',
        gpuClass: 'NVIDIA L40S',
        maxRuntimeHours: 18,
        activeWorkspaces: 11,
        budget: {
          monthlyLimit: 11000,
          monthlyUsed: 9820,
        },
      },
      {
        id: 'alignment-lab',
        name: 'Alignment Lab',
        description: 'Lower-cost queue for reward model training and evaluation.',
        visibility: 'public',
        gpuClass: 'NVIDIA A40',
        maxRuntimeHours: 12,
        activeWorkspaces: 5,
        budget: {
          monthlyLimit: 4500,
          monthlyUsed: 4160,
        },
      },
    ],
  },
  {
    id: 'edge-deployment',
    name: 'Edge Deployment Validation',
    visibility: 'internal',
    description:
      'Hardware-in-the-loop validation, edge runtime packaging, and reliability testing.',
    lead: 'Dr. Priya Desai',
    budget: {
      monthlyLimit: 9200,
      monthlyUsed: 8740,
    },
    defaultQueue: 'edge-verification',
    queues: [
      {
        id: 'edge-verification',
        name: 'Edge Verification',
        description: 'GPU-light queue for integration testing and packaging validation.',
        visibility: 'internal',
        gpuClass: 'NVIDIA RTX 6000 Ada',
        maxRuntimeHours: 10,
        activeWorkspaces: 6,
        budget: {
          monthlyLimit: 5400,
          monthlyUsed: 4980,
        },
      },
      {
        id: 'mission-readiness',
        name: 'Mission Readiness',
        description: 'Ops rehearsal queue with heightened monitoring for go-live validation.',
        visibility: 'restricted',
        gpuClass: 'NVIDIA A100 40GB',
        maxRuntimeHours: 8,
        activeWorkspaces: 4,
        budget: {
          monthlyLimit: 3800,
          monthlyUsed: 3760,
        },
      },
    ],
  },
];

export const visibilityCopy: Record<ProjectVisibility, { label: string; tone: 'default' | 'primary' | 'secondary' }> = {
  restricted: { label: 'Restricted', tone: 'secondary' },
  internal: { label: 'Internal', tone: 'primary' },
  public: { label: 'Public', tone: 'default' },
};
