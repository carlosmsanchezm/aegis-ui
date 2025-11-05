import { ReactNode } from 'react';

export type ProjectVisibility = 'mission' | 'team' | 'portfolio';

export type ProjectBudgetProfile = {
  committed: string;
  used: string;
  renews: string;
};

export type ProjectQueueProfile = {
  id: string;
  name: string;
  kind: 'cpu' | 'gpu' | 'mixed';
  description: string;
  backlogMinutes: number;
  capacity: string;
  policy: string;
  featuredFlavors: string[];
};

export type ProjectProfile = {
  id: string;
  name: string;
  visibility: ProjectVisibility;
  description: string;
  sponsor: string;
  missionBadge?: ReactNode;
  budget: ProjectBudgetProfile;
  defaultQueueId: string;
  queues: ProjectQueueProfile[];
};

export const projectProfiles: ProjectProfile[] = [
  {
    id: 'p-aurora',
    name: 'Aurora Fusion',
    visibility: 'mission',
    description:
      'Cross-directorate data fusion workspace for real-time ISR exploitation and model collaboration.',
    sponsor: 'Joint ISR TF',
    budget: {
      committed: '$68,000',
      used: '$41,500',
      renews: 'FY24 Q4',
    },
    defaultQueueId: 'cpu-burst',
    queues: [
      {
        id: 'cpu-burst',
        name: 'CPU Burst',
        kind: 'cpu',
        description: 'Burstable CPU queue optimized for Python and analytics workflows.',
        backlogMinutes: 12,
        capacity: '96 vCPU • 384 GiB RAM',
        policy: 'Quota-coordinated, monitors per-mission CPU hour limits.',
        featuredFlavors: ['cpu-small', 'cpu-medium', 'cpu-large'],
      },
      {
        id: 'gpu-rapid',
        name: 'GPU Rapid',
        kind: 'gpu',
        description: 'Latency-sensitive GPU jobs for tactical model retraining.',
        backlogMinutes: 6,
        capacity: '12× NVIDIA T4',
        policy: 'Requires Aurora budget approver for GPU > 8 hours.',
        featuredFlavors: ['gpu-standard'],
      },
    ],
  },
  {
    id: 'p-atlas',
    name: 'Atlas Insights',
    visibility: 'team',
    description:
      'Geospatial analytics project combining HUMINT, SIGINT, and GEOINT data for predictive alerting.',
    sponsor: 'GEOINT Ops Center',
    budget: {
      committed: '$52,500',
      used: '$18,450',
      renews: 'FY25 Q1',
    },
    defaultQueueId: 'cpu-analysis',
    queues: [
      {
        id: 'cpu-analysis',
        name: 'CPU Analysis',
        kind: 'cpu',
        description: 'Baseline queue for ETL, dashboards, and integration testing.',
        backlogMinutes: 4,
        capacity: '64 vCPU • 256 GiB RAM',
        policy: 'Auto-rightsizes idle sessions after 90 minutes.',
        featuredFlavors: ['cpu-small', 'cpu-medium'],
      },
      {
        id: 'gpu-atlas',
        name: 'GPU Atlas',
        kind: 'gpu',
        description: 'Access-controlled queue for GPU notebooks and inference.',
        backlogMinutes: 18,
        capacity: '8× NVIDIA A10',
        policy: 'Requires queue approval for GPU > 12 hours.',
        featuredFlavors: ['gpu-standard', 'gpu-large'],
      },
    ],
  },
  {
    id: 'p-vanguard',
    name: 'Vanguard Lab',
    visibility: 'portfolio',
    description:
      'Platform engineering sandbox for emerging mission tools, automation, and integration tests.',
    sponsor: 'Platform PMO',
    budget: {
      committed: '$95,000',
      used: '$72,660',
      renews: 'FY24 Q3',
    },
    defaultQueueId: 'mixed-lab',
    queues: [
      {
        id: 'mixed-lab',
        name: 'Mixed Lab',
        kind: 'mixed',
        description: 'Flexible queue spanning CPU and burstable GPU for experimentation.',
        backlogMinutes: 22,
        capacity: '128 vCPU • 512 GiB RAM • 6× NVIDIA T4',
        policy: 'Budget notifications sent at 75% consumption.',
        featuredFlavors: ['cpu-medium', 'cpu-large', 'gpu-standard'],
      },
      {
        id: 'gpu-heavy',
        name: 'GPU Heavy',
        kind: 'gpu',
        description: 'Dedicated cluster for sustained GPU training and evaluation.',
        backlogMinutes: 35,
        capacity: '10× NVIDIA A10',
        policy: 'Pre-approval with Vanguard change board required.',
        featuredFlavors: ['gpu-large'],
      },
    ],
  },
];

export const projectVisibilityLabels: Record<ProjectVisibility, string> = {
  mission: 'Mission',
  team: 'Team',
  portfolio: 'Portfolio',
};

export const projectVisibilityDescriptions: Record<ProjectVisibility, string> = {
  mission: 'Scoped to mission cell with heightened oversight and access controls.',
  team: 'Shared across a functional team with delegated queue approvals.',
  portfolio: 'Organization-wide initiatives spanning multiple missions.',
};

export const findProjectById = (id: string): ProjectProfile | undefined =>
  projectProfiles.find(project => project.id === id);

export const resolveDefaultQueueId = (project?: ProjectProfile): string => {
  if (!project) {
    return '';
  }

  if (project.queues.some(queue => queue.id === project.defaultQueueId)) {
    return project.defaultQueueId;
  }

  return project.queues[0]?.id ?? '';
};
