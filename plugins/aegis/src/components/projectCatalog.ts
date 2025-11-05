import { alpha } from '@material-ui/core/styles/colorManipulator';
import type { Palette } from '@material-ui/core/styles/createPalette';

export type QueueDiscipline = 'cpu' | 'gpu' | 'burst';
export type QueueHealth = 'healthy' | 'degraded' | 'paused';

export type QueueSummary = {
  id: string;
  name: string;
  description: string;
  discipline: QueueDiscipline;
  health: QueueHealth;
  concurrency: number;
  utilization: number; // 0 - 1 scale
  budgetGuardrail?: string;
};

export type ProjectVisibility = 'Private' | 'Team' | 'Org';

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  owner: string;
  visibility: ProjectVisibility;
  missionFocus: string;
  tags: string[];
  budget: {
    allocated: number;
    consumed: number;
    timeframe: string;
  };
  defaultQueueId: string;
  queues: QueueSummary[];
  isDefault?: boolean;
};

const toPercent = (value: number) => Math.min(1, Math.max(0, value));

export const projectCatalog: ProjectSummary[] = [
  {
    id: 'proj-vanguard',
    name: 'Project Vanguard',
    description:
      'Production ISR model operations environment delivering fused analytics to deployed units.',
    owner: 'Joint Intelligence Analytics',
    visibility: 'Team',
    missionFocus: 'Real-time ISR fusion & dissemination',
    tags: ['ISR', 'Production'],
    budget: {
      allocated: 120000,
      consumed: 86500,
      timeframe: 'FY24',
    },
    defaultQueueId: 'cpu-default',
    queues: [
      {
        id: 'cpu-default',
        name: 'CPU Default',
        description: 'Balanced CPU nodes optimized for IDE + light data engineering tasks.',
        discipline: 'cpu',
        health: 'healthy',
        concurrency: 28,
        utilization: toPercent(0.68),
        budgetGuardrail: '$600 daily soft ceiling',
      },
      {
        id: 'gpu-strike',
        name: 'GPU Strike',
        description: 'A10 GPU pods earmarked for production retraining windows.',
        discipline: 'gpu',
        health: 'healthy',
        concurrency: 6,
        utilization: toPercent(0.52),
        budgetGuardrail: 'Requires 2IC approval above 12 hrs/day',
      },
    ],
    isDefault: true,
  },
  {
    id: 'proj-aurora',
    name: 'Aurora R&D',
    description:
      'Exploratory computer vision research sandbox for next-gen targeting prototypes.',
    owner: 'Advanced Analytics Directorate',
    visibility: 'Org',
    missionFocus: 'ML experimentation & rapid prototyping',
    tags: ['R&D', 'Computer Vision'],
    budget: {
      allocated: 90000,
      consumed: 34000,
      timeframe: 'FY24',
    },
    defaultQueueId: 'cpu-research',
    queues: [
      {
        id: 'cpu-research',
        name: 'CPU Research',
        description: 'Elastic CPU queue for notebook exploration and data prep.',
        discipline: 'cpu',
        health: 'healthy',
        concurrency: 18,
        utilization: toPercent(0.41),
      },
      {
        id: 'gpu-exploratory',
        name: 'GPU Exploratory',
        description: 'T4 GPU nodes for experimentation and PoC workloads.',
        discipline: 'gpu',
        health: 'degraded',
        concurrency: 4,
        utilization: toPercent(0.73),
        budgetGuardrail: 'Alert at 80% of monthly GPU hours',
      },
      {
        id: 'burst-longhaul',
        name: 'Burst Longhaul',
        description: 'Preemptible queue for budget-conscious overnight runs.',
        discipline: 'burst',
        health: 'healthy',
        concurrency: 12,
        utilization: toPercent(0.22),
      },
    ],
  },
  {
    id: 'proj-outreach',
    name: 'Outreach Sandbox',
    description:
      'Isolated collaboration zone for interagency data exchanges and mission rehearsal.',
    owner: 'Coalition Enablement Cell',
    visibility: 'Private',
    missionFocus: 'Federated collaboration pilots',
    tags: ['Coalition', 'Sandbox'],
    budget: {
      allocated: 45000,
      consumed: 11800,
      timeframe: 'FY24',
    },
    defaultQueueId: 'cpu-collab',
    queues: [
      {
        id: 'cpu-collab',
        name: 'CPU Collaboration',
        description: 'Hardened CPU slice with cross-domain inspection policies.',
        discipline: 'cpu',
        health: 'healthy',
        concurrency: 14,
        utilization: toPercent(0.36),
      },
      {
        id: 'gpu-partner',
        name: 'GPU Partner',
        description: 'Shared GPU allotment with coalition guardrails.',
        discipline: 'gpu',
        health: 'paused',
        concurrency: 2,
        utilization: toPercent(0.12),
        budgetGuardrail: 'Paused pending FY rebaseline',
      },
    ],
  },
];

export const getProjectById = (projectId: string) =>
  projectCatalog.find(project => project.id === projectId) ?? null;

export const getQueueFromProject = (project: ProjectSummary | null, queueId: string) =>
  project?.queues.find(queue => queue.id === queueId) ?? null;

export const getDefaultProject = () =>
  projectCatalog.find(project => project.isDefault) ?? projectCatalog[0] ?? null;

export const getVisibilityColor = (
  visibility: ProjectVisibility,
  themePalette: Palette,
) => {
  switch (visibility) {
    case 'Private':
      return {
        background: alpha(themePalette.warning.main, 0.12),
        color: themePalette.warning.main,
      };
    case 'Org':
      return {
        background: alpha(themePalette.info.main, 0.12),
        color: themePalette.info.main,
      };
    default:
      return {
        background: alpha(themePalette.primary.main, 0.12),
        color: themePalette.primary.main,
      };
  }
};
