/*
 * Shared data contracts that describe the Aegis cluster orchestration domain.
 * These interfaces intentionally mirror the payloads the backend orchestrator
 * is expected to expose so that the UI can evolve independently from the
 * concrete runtime engines (Pulumi, Terraform, GitOps controllers, etc.).
 */

export type AegisRole =
  | 'platform-admin'
  | 'platform-engineer'
  | 'cluster-creator'
  | 'ml-engineer'
  | 'auditor';

export type ParameterPrimitive = 'string' | 'integer' | 'number' | 'boolean';

export type ParameterControlType = ParameterPrimitive | 'enum';

export type ParameterValidationRule = {
  /** Optional validation regex executed client-side prior to submit */
  pattern?: string;
  /** Custom validation description to display when pattern fails */
  message?: string;
};

export type ClusterProfileParameter = {
  key: string;
  title: string;
  description?: string;
  type: ParameterControlType;
  default: string | number | boolean | null;
  enum?: Array<string | number>;
  minimum?: number;
  maximum?: number;
  required?: boolean;
  /** Which personas can see this parameter */
  visibility: AegisRole[];
  /** Optional role based edit override – read-only when not included */
  editableBy?: AegisRole[];
  /** Whether the parameter is surfaced in the quick launch form */
  featured?: boolean;
  validation?: ParameterValidationRule;
};

export type ComplianceLevel = 'IL-4' | 'IL-5' | 'IL-6';

export type FedrampLevel = 'Moderate' | 'High';

export type ClusterProfileStatus = 'Draft' | 'Published' | 'Deprecated';

export type ClusterProvider = 'aws-eks' | 'azure-aks' | 'gcp-gke';

export type ClusterProfileSummary = {
  id: string;
  name: string;
  version: string;
  provider: ClusterProvider;
  ilLevel: ComplianceLevel;
  fedramp: FedrampLevel;
  gpuSupport: boolean;
  parameterCount: number;
  costBaselinePerHour: number;
  status: ClusterProfileStatus;
  lastUpdated: string;
  policyPackIds: string[];
};

export type ClusterProfile = ClusterProfileSummary & {
  description?: string;
  complianceBoundary: string;
  projects: string[];
  groups: string[];
  topologyDefaults: {
    controlPlaneVersion: string;
    nodePools: Array<{
      id: string;
      name: string;
      instanceType: string;
      gpu?: string;
      minSize: number;
      maxSize: number;
      perNodeHourlyCost: number;
    }>;
    networking: {
      vpcId: string;
      subnets: string[];
      privateLink?: boolean;
    };
    storageClasses: string[];
    irsaEnabled: boolean;
    autoscalerEnabled: boolean;
  };
  addons: string[];
  guardrails: string[];
  parameters: ClusterProfileParameter[];
};

export type ClusterTimelineEvent = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  timestamp?: string;
  actor?: string;
  details?: string;
};

export type ClusterCostInsight = {
  hourly: number;
  deltaPercent: number;
  currency?: string;
  topDrivers: Array<{
    label: string;
    hourly: number;
  }>;
};

export type ClusterComplianceStatus = {
  level: ComplianceLevel;
  fedramp: FedrampLevel;
  passed: number;
  warnings: number;
  failed: number;
  guardrailsEngaged?: boolean;
};

export type ClusterDriftStatus = 'clean' | 'drifted' | 'pending';

export type ClusterPhase =
  | 'Provisioning'
  | 'Ready'
  | 'Error'
  | 'Upgrading'
  | 'Scaling';

export type ClusterFleetItem = {
  id: string;
  name: string;
  project: string;
  region: string;
  account: string;
  profileRef: { id: string; version: string; name: string } | null;
  phase: ClusterPhase;
  controllerCondition: string;
  cost: ClusterCostInsight;
  drift: ClusterDriftStatus;
  compliance: ClusterComplianceStatus;
  timeline: ClusterTimelineEvent[];
  labels: Record<string, string | boolean>;
};

export type ChangeSetImpact = {
  type: 'scaling' | 'upgrade' | 'security' | 'configuration';
  description: string;
  estimatedDurationMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
};

export type ClusterChangeSet = {
  id: string;
  source: 'profile-drift' | 'parameter-override' | 'security-update';
  status: 'draft' | 'awaiting-approval' | 'approved' | 'applied' | 'failed';
  createdAt: string;
  createdBy: string;
  diff: string;
  policyChecks: Array<{ id: string; status: 'pass' | 'warn' | 'fail'; message: string }>;
  approvers: Array<{ name: string; role: AegisRole; status: 'pending' | 'approved' | 'rejected' }>;
  impact: ChangeSetImpact[];
  maintenanceWindow?: { windowId: string; startsAt: string; durationMinutes: number };
};

export type ClusterNodePool = {
  id: string;
  name: string;
  type: 'cpu' | 'gpu';
  instanceType: string;
  gpuModel?: string;
  desired: number;
  min: number;
  max: number;
  spotPercentage?: number;
  taints?: string[];
  labels?: Record<string, string>;
  driverVersion?: string;
};

export type ClusterAddon = {
  id: string;
  name: string;
  type: 'helm' | 'operator' | 'system';
  version: string;
  status: 'ready' | 'degraded' | 'installing';
  description?: string;
};

export type ClusterActivityItem = {
  id: string;
  label: string;
  actor: string;
  at: string;
  details?: string;
  status: 'success' | 'warning' | 'error' | 'info';
};

export type ClusterFinOpsBreakdown = {
  hourly: number;
  monthlyForecast: number;
  recommendations: Array<{ id: string; title: string; savingsPerMonth: number; summary: string }>;
};

export type ClusterDetail = ClusterFleetItem & {
  description?: string;
  nodePools: ClusterNodePool[];
  addons: ClusterAddon[];
  activity: ClusterActivityItem[];
  finops: ClusterFinOpsBreakdown;
};

