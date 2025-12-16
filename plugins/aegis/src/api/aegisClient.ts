import {
  DiscoveryApi,
  FetchApi,
  IdentityApi,
  OAuthApi,
} from '@backstage/core-plugin-api';

export type WorkspaceSpec = {
  flavor?: string;
  image?: string;
  command?: string[];
  interactive?: boolean;
  ports?: number[];
  env?: Record<string, string>;
  maxDurationSeconds?: number;
};

export type TrainingSpec = {
  flavor?: string;
  image?: string;
  command?: string[];
};

export type WorkloadDTO = {
  id?: string;
  projectId?: string;
  queue?: string;
  clusterId?: string;
  status?: string;
  uiStatus?: string;
  message?: string;
  url?: string;
  workspace?: WorkspaceSpec;
  training?: TrainingSpec;
};

export type ConnectionSession = {
  sessionId: string;
  token: string;
  sshUser?: string;
  sshHostAlias: string;
  vscodeUri?: string;
  sshConfig?: string;
  proxyUrl: string;
  expiresAtUtc: string;
  oneTime?: boolean;
};

export type SubmitWorkspaceRequest = {
  id?: string;
  projectId: string;
  queue?: string;
  clusterId?: string;
  workspace: {
    flavor?: string;
    image?: string;
    command?: string | string[];
    interactive?: boolean;
    ports?: number[];
    env?: Record<string, string>;
    maxDurationSeconds?: number;
  };
};

export type CreateWorkspaceRequest = {
  projectId: string;
  workspaceId?: string;
  queue?: string;
  clusterId?: string;
  workspace: WorkspaceSpec;
};

export type CreateWorkspaceResponse = {
  workload: WorkloadDTO;
};

export type PolicyDomain = {
  regions?: string[];
  dataLevel?: string;
  denyEgressByDefault?: boolean;
};

export type ProjectAwsCredentials = {
  accountId?: string;
  roleArn?: string;
  externalId?: string;
};

export type ProjectRecord = {
  id: string;
  displayName?: string;
  ownerGroup?: string;
  policy?: PolicyDomain;
  annotations?: Record<string, string>;
  aws?: ProjectAwsCredentials;
};

export type ListProjectsResponse = {
  items: ProjectRecord[];
};

export type ClusterMode = 'provision' | 'import';

export type ClusterCostEstimate = {
  hourly: number;
  currency?: string;
  description?: string;
};

export type ClusterSummary = {
  id: string;
  name: string;
  projectId: string;
  mode?: ClusterMode;
  provider: string;
  region: string;
  phase:
    | 'Provisioning'
    | 'Ready'
    | 'Pending'
    | 'Unhealthy'
    | 'Error'
    | 'Degraded'
    | 'Upgrading'
    | 'Scaling';
  createdAt?: string;
  lastHeartbeat?: string;
  lastSyncedAt?: string;
  costEstimate?: ClusterCostEstimate;
  latestCondition?: ClusterJobCondition;
};

export type ListClustersOptions = {
  projectId?: string;
  region?: string;
  mode?: ClusterMode;
};

export type ListClustersResponse = {
  items: ClusterSummary[];
};

export type ClusterProfileSelection = {
  id: string;
  version?: string;
  parameters?: Record<string, string | number | boolean>;
};

export type CreateClusterRequest = {
  projectId: string;
  clusterId: string;
  provider: string;
  region: string;
  profile?: ClusterProfileSelection;
};

export type ImportClusterMethod = 'kubeconfig' | 'assume_role' | 'agent_only';

export type ImportClusterProvider =
  | 'local'
  | 'baremetal'
  | 'existing-aws'
  | 'existing-gcp'
  | 'existing-azure'
  | 'airgapped';

export type ImportClusterRequest = {
  projectId: string;
  clusterId: string;
  provider: ImportClusterProvider;
  region: string;
  name: string;
  labels?: Record<string, string>;
  importMethod: ImportClusterMethod;
  kubeconfig?: string;
  assumeRoleArn?: string;
};

export type ImportClusterHelmValues = {
  k8sAgent?: {
    env?: Record<string, string>;
  };
};

export type ImportClusterStatus = 'pending_agent' | 'registering' | 'active';

export type ImportClusterResponse = {
  clusterId: string;
  status: ImportClusterStatus;
  helmValues?: ImportClusterHelmValues;
  installCommand?: string;
  agentScriptUrl?: string;
  warnings?: string[];
};

export type Job = {
  id: string;
  status: string;
  progress: number;
  error?: string;
};

export type CreateClusterResponse = {
  job: Job;
};

export type GetClusterJobStatusResponse = {
  job: Job;
};

export type ListWorkloadsResponse = {
  items: WorkloadDTO[];
};

export type ClusterJobCondition = {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
};

export type ClusterNodePoolStatus = {
  name: string;
  instanceType: string;
  desiredSize?: number;
  actualSize?: number;
  minSize: number;
  maxSize: number;
  labels?: Record<string, string>;
  taints?: Array<{ key: string; value: string; effect: string }>;
};

export type ClusterActivityItem = {
  id: string;
  phase: string;
  timestamp: string;
  message?: string;
  actor?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
};

export type ClusterDetail = {
  id: string;
  name: string;
  projectId: string;
  provider: string;
  region: string;
  phase: 'Ready' | 'Provisioning' | 'Error' | 'Degraded' | 'Upgrading' | 'Scaling';
  createdAt: string;
  lastSyncedAt?: string;
  controllerCondition?: string;
  costEstimate?: {
    hourly: number;
    currency?: string;
    description?: string;
  };
  latestCondition?: ClusterJobCondition;
  conditions?: ClusterJobCondition[];
  nodePools?: ClusterNodePoolStatus[];
  activity?: ClusterActivityItem[];
  addons?: Array<{ id: string; name: string; type: string; version: string; status: string }>;
  platformOverrides?: {
    apiServer?: string;
    metricsEndpoint?: string;
    loggingEndpoint?: string;
  };
  helm?: {
    namespace?: string;
    chartVersion?: string;
  };
  kubeconfigSecrets?: Array<{
    name: string;
    namespace?: string;
    description?: string;
  }>;
  additionalClusters?: Array<{
    clusterId: string;
    name?: string;
    nodePools?: ClusterNodePoolStatus[];
  }>;
  account?: string;
  assumeRoleArn?: string;
  accountId?: string;
};

export type PrometheusMetricSample = {
  timestamp: string;
  value: number;
};

export type PrometheusMetricSeries = {
  labels?: Record<string, string>;
  samples?: PrometheusMetricSample[];
};

export type MetricsQueryRequest = {
  projectId: string;
  clusterId: string;
  query: string;
  start?: string;
  end?: string;
  stepSeconds?: number;
  rangeSeconds?: number;
};

export type MetricsQueryResponse = {
  series: PrometheusMetricSeries[];
};

export type LogsQueryRequest = {
  projectId: string;
  clusterId: string;
  namespace?: string;
  pod?: string;
  substring?: string;
  start?: string;
  end?: string;
  limit?: number;
  cursor?: string;
  includeEvents?: boolean;
};

export type LogEntryDTO = {
  timestamp: string;
  namespace?: string;
  pod?: string;
  container?: string;
  app?: string;
  eventReason?: string;
  eventType?: string;
  message: string;
  labels?: Record<string, string>;
};

export type LogsQueryResponse = {
  entries: LogEntryDTO[];
  nextCursor?: string;
  warnings?: string[];
};

export type AlertView = {
  state?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  fingerprint?: string;
};

export type AlertsResponse = {
  alerts: AlertView[];
};

export type TraceLookupResponse = {
  trace?: unknown;
};

export type ProvisioningLogView = {
  timestamp: string;
  phase?: string;
  type?: string;
  message: string;
};

export type ProvisioningLogsResponse = {
  jobId: string;
  projectId?: string;
  clusterId?: string;
  phase?: string;
  startedAt?: string;
  completedAt?: string;
  logs?: ProvisioningLogView[];
  nextCursor?: string;
};

export const DEFAULT_SSH_PORT = 22;
export const DEFAULT_VSCODE_PORT = 11111;

export const WORKSPACE_DEFAULT_ENV: Record<string, string> = {
  VSCODE_QUALITY: 'stable',
  PUID: '1000',
  PGID: '1000',
  PASSWORD_ACCESS: 'true',
  USER_NAME: 'aegis',
  USER_PASSWORD: 'aegis123',
};

const normalizeCommand = (command: string | string[] | undefined): string[] => {
  if (Array.isArray(command)) {
    const sanitized = command
      .map(part => (typeof part === 'string' ? part.trim() : ''))
      .filter(part => part.length > 0);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  const text = typeof command === 'string' ? command.trim() : '';
  if (!text) {
    return [];
  }
  return ['sh', '-c', text];
};

export const ensureWorkspacePorts = (ports?: number[]): number[] => {
  const portSet = new Set<number>();
  (ports ?? []).forEach(port => {
    if (Number.isFinite(port) && port > 0) {
      portSet.add(Math.trunc(port));
    }
  });

  if (portSet.size === 0) {
    portSet.add(DEFAULT_SSH_PORT);
  }
  portSet.add(DEFAULT_VSCODE_PORT);

  return Array.from(portSet).sort((a, b) => a - b);
};

export const mergeWorkspaceEnv = (
  user?: Record<string, string>,
): Record<string, string> | undefined => {
  const merged: Record<string, string> = {};

  Object.entries(WORKSPACE_DEFAULT_ENV).forEach(([key, value]) => {
    if (value) {
      merged[key] = value;
    }
  });

  if (user) {
    Object.entries(user).forEach(([key, value]) => {
      const trimmedKey = key?.trim();
      if (!trimmedKey) {
        return;
      }
      const normalizedValue =
        typeof value === 'string' ? value.trim() : String(value ?? '');
      if (!normalizedValue) {
        return;
      }
      merged[trimmedKey] = normalizedValue;
    });
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

const serializeProfileParameters = (
  params?: Record<string, string | number | boolean>,
): Record<string, string> | undefined => {
  if (!params) {
    return undefined;
  }
  const result: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    const trimmedKey = key?.trim();
    if (!trimmedKey) {
      return;
    }
    if (typeof value === 'string') {
      if (value) {
        result[trimmedKey] = value;
      }
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[trimmedKey] = String(value);
      return;
    }
    if (typeof value === 'boolean') {
      result[trimmedKey] = value ? 'true' : 'false';
      return;
    }
    result[trimmedKey] = String(value ?? '');
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

const normalizeClusterProfile = (
  profile?: ClusterProfileSelection,
):
  | {
      id: string;
      version?: string;
      parameters?: Record<string, string>;
    }
  | undefined => {
  if (!profile) {
    return undefined;
  }
  const normalized: {
    id: string;
    version?: string;
    parameters?: Record<string, string>;
  } = {
    id: profile.id,
  };
  if (profile.version) {
    normalized.version = profile.version;
  }
  const parameters = serializeProfileParameters(profile.parameters);
  if (parameters) {
    normalized.parameters = parameters;
  }
  return normalized;
};

export type CreateProjectInput = {
  id: string;
  displayName: string;
  ownerGroup?: string;
  policy?: PolicyDomain;
  annotations?: Record<string, string>;
  aws?: ProjectAwsCredentials;
};

export const createProject = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  project: CreateProjectInput,
): Promise<ProjectRecord> => {
  const body = {
    project: {
      id: project.id,
      displayName: project.displayName,
      ...(project.ownerGroup ? { ownerGroup: project.ownerGroup } : {}),
      ...(project.policy ? { policy: project.policy } : {}),
      ...(project.annotations ? { annotations: project.annotations } : {}),
      ...(project.aws ? { aws: project.aws } : {}),
    },
  };
  return restJson<typeof body, ProjectRecord>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/projects',
    {
      method: 'POST',
      body,
      requireAuth: true,
    },
  );
};

export const listProjects = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
): Promise<ListProjectsResponse> =>
  restJson<undefined, ListProjectsResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/projects',
    {
      method: 'GET',
      requireAuth: true,
    },
  );

export const listClusters = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  options?: ListClustersOptions,
): Promise<ClusterSummary[]> => {
  const params = new URLSearchParams();
  if (options?.projectId) {
    params.append('project_id', options.projectId);
  }
  if (options?.region) {
    params.append('region', options.region);
  }

  const query = params.toString();
  const path = query ? `/api/v1/clusters?${query}` : '/api/v1/clusters';

  const response = await restJson<undefined, ListClustersResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    path,
    {
      method: 'GET',
      requireAuth: true,
    },
  );

  return response?.items ?? [];
};

export type QueueInput = {
  name: string;
  projectId: string;
  priorityTier?: string;
  allowedFlavors?: string[];
  defaultMaxDurationSeconds?: number;
};

export const upsertQueue = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  queue: QueueInput,
): Promise<unknown> => {
  const body = {
    queue: {
      name: queue.name,
      projectId: queue.projectId,
      ...(queue.priorityTier ? { priorityTier: queue.priorityTier } : {}),
      ...(queue.allowedFlavors ? { allowedFlavors: queue.allowedFlavors } : {}),
      ...(queue.defaultMaxDurationSeconds
        ? { defaultMaxDurationSeconds: queue.defaultMaxDurationSeconds }
        : {}),
    },
  };
  return restJson<typeof body, unknown>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/queues',
    {
      method: 'PUT',
      body,
      requireAuth: true,
    },
  );
};

export type BudgetInput = {
  projectId: string;
  queue: string;
  limitUsd: number;
  policyMode?: string;
};

export const upsertBudget = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  budget: BudgetInput,
): Promise<unknown> => {
  const body = {
    budget: {
      projectId: budget.projectId,
      queue: budget.queue,
      limitUsd: budget.limitUsd,
      ...(budget.policyMode ? { policyMode: budget.policyMode } : {}),
    },
  };
  return restJson<typeof body, unknown>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/v1/projects/${encodeURIComponent(budget.projectId)}/budgets`,
    {
      method: 'PUT',
      body,
      requireAuth: true,
    },
  );
};

const buildProxyUrl = async (
  discoveryApi: DiscoveryApi,
  method: string,
): Promise<string> => {
  const baseUrl = await discoveryApi.getBaseUrl('proxy');
  return `${baseUrl}/aegis/aegis.v1.AegisPlatform/${method}`;
};

const buildRestUrl = async (
  discoveryApi: DiscoveryApi,
  path: string,
): Promise<string> => {
  const baseUrl = await discoveryApi.getBaseUrl('proxy');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}/aegis${normalizedPath}`;
};

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required. Please sign in with Keycloak and retry.') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'You are not authorized to perform this action in Aegis.') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

const resolveIdentityHeaders = async (
  identityApi: IdentityApi,
  authApi?: OAuthApi,
  options?: { requireAuth?: boolean },
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};

  let accessToken: string | undefined;
  let identityToken: string | undefined;
  let userEntityRef: string | undefined;

  if (authApi) {
    try {
      accessToken =
        (await authApi.getAccessToken(['openid', 'profile', 'email'])) ??
        undefined;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Aegis: unable to resolve Keycloak access token', err);
      }
    }
  }

  try {
    const identity = await identityApi.getBackstageIdentity();
    userEntityRef = identity?.userEntityRef;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Aegis: unable to resolve Backstage identity', err);
    }
  }

  try {
    const credentials = await identityApi.getCredentials();
    identityToken = credentials?.token;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Aegis: failed to resolve credentials', err);
    }
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
    headers['Grpc-Metadata-Authorization'] = `Bearer ${accessToken}`;
    headers['grpc-metadata-authorization'] = `Bearer ${accessToken}`;
  } else if (identityToken) {
    headers.Authorization = `Bearer ${identityToken}`;
    headers['Grpc-Metadata-Authorization'] = `Bearer ${identityToken}`;
    headers['grpc-metadata-authorization'] = `Bearer ${identityToken}`;
  } else if (options?.requireAuth) {
    throw new AuthenticationError();
  }

  if (userEntityRef) {
    headers['X-Backstage-User-Entity-Ref'] = userEntityRef;
  }

  return headers;
};

const restJson = async <TReq extends object | undefined, TRes>(
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  path: string,
  init: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: TReq;
    requireAuth?: boolean;
  },
): Promise<TRes> => {
  const url = await buildRestUrl(discoveryApi, path);
  const headers = await resolveIdentityHeaders(identityApi, authApi, {
    requireAuth: init.requireAuth,
  });

  if (init.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetchApi.fetch(url, {
    method: init.method,
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (response.status === 401) {
    throw new AuthenticationError();
  }
  if (response.status === 403) {
    throw new AuthorizationError();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      text || `Request failed with status ${response.status}`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as TRes;
  }

  return (await response.json()) as TRes;
};

const postJson = async <TReq extends object, TRes>(
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  method: string,
  body: TReq,
  options?: { requireAuth?: boolean },
): Promise<TRes> => {
  const url = await buildProxyUrl(discoveryApi, method);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await resolveIdentityHeaders(identityApi, authApi, options)),
  };

  const response = await fetchApi.fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new AuthenticationError();
  }
  if (response.status === 403) {
    throw new AuthorizationError();
  }
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      text || `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as TRes;
};

export const listWorkloads = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  projectId: string,
): Promise<WorkloadDTO[]> => {
  const res = await restJson<undefined, ListWorkloadsResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/v1/projects/${encodeURIComponent(projectId)}/workloads`,
    { method: 'GET', requireAuth: true },
  );
  return res.items ?? [];
};

export const getWorkload = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  id: string,
): Promise<WorkloadDTO> =>
  restJson<undefined, WorkloadDTO>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/v1/workloads/${encodeURIComponent(id)}`,
    { method: 'GET', requireAuth: true },
  );

export const createConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  workloadId: string,
  client: 'cli' | 'ssh' | 'vscode' = 'cli',
): Promise<ConnectionSession> =>
  restJson<{ workload_id: string; client: string }, ConnectionSession>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/connection_sessions',
    {
      method: 'POST',
      body: { workload_id: workloadId, client },
      requireAuth: true,
    },
  );

export const renewConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  sessionId: string,
): Promise<ConnectionSession> =>
  restJson<undefined, ConnectionSession>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/v1/connection_sessions/${encodeURIComponent(sessionId)}/renew`,
    { method: 'POST', requireAuth: true },
  );

export const revokeConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  sessionId: string,
): Promise<void> => {
  await restJson<undefined, unknown>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/v1/connection_sessions/${encodeURIComponent(sessionId)}/revoke`,
    { method: 'POST', requireAuth: true },
  );
};

export const submitWorkspace = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: SubmitWorkspaceRequest,
): Promise<WorkloadDTO> => {
  const workspaceInput = req.workspace ?? {};
  const command = normalizeCommand(workspaceInput.command);
  const ports = ensureWorkspacePorts(workspaceInput.ports);
  const env = mergeWorkspaceEnv(workspaceInput.env);
  const maxDuration =
    typeof workspaceInput.maxDurationSeconds === 'number' &&
    Number.isFinite(workspaceInput.maxDurationSeconds)
      ? Math.floor(workspaceInput.maxDurationSeconds)
      : undefined;

  const body = {
    workload: {
      ...(req.id ? { id: req.id } : {}),
      projectId: req.projectId,
      ...(req.queue ? { queue: req.queue } : {}),
      ...(req.clusterId ? { clusterId: req.clusterId } : {}),
      workspace: {
        flavor: workspaceInput.flavor,
        image: workspaceInput.image,
        interactive: workspaceInput.interactive ?? true,
        command,
        ports,
        ...(env ? { env } : {}),
        ...(maxDuration ? { maxDurationSeconds: maxDuration } : {}),
      },
    },
  };

  // SubmitWorkload is exposed via the platform-api HTTP gateway at POST /api/v1/workloads.
  // Using the REST path avoids fragile RPC-style proxy paths that can return 404 when
  // the Backstage proxy target is the HTTP gateway (port 8080).
  return restJson<typeof body, WorkloadDTO>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/workloads',
    { method: 'POST', body, requireAuth: true },
  );
};

export const createWorkspace = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: CreateWorkspaceRequest,
): Promise<CreateWorkspaceResponse> => {
  const workload = await submitWorkspace(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    {
      ...(req.workspaceId ? { id: req.workspaceId } : {}),
      projectId: req.projectId,
      ...(req.queue ? { queue: req.queue } : {}),
      ...(req.clusterId ? { clusterId: req.clusterId } : {}),
      workspace: req.workspace,
    },
  );

  return { workload };
};

export const createCluster = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: CreateClusterRequest,
): Promise<CreateClusterResponse> => {
  const profilePayload = normalizeClusterProfile(req.profile);
  const body = {
    projectId: req.projectId,
    clusterId: req.clusterId,
    provider: req.provider,
    region: req.region,
    ...(profilePayload ? { profile: profilePayload } : {}),
  };
  return restJson<CreateClusterRequest, CreateClusterResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/clusters',
    {
      method: 'POST',
      body,
      requireAuth: true,
    },
  );
};

export const importCluster = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: ImportClusterRequest,
): Promise<ImportClusterResponse> => {
  const body = {
    projectId: req.projectId,
    clusterId: req.clusterId,
    provider: req.provider,
    region: req.region,
    name: req.name,
    ...(req.labels ? { labels: req.labels } : {}),
    importMethod: req.importMethod,
    ...(req.kubeconfig ? { kubeconfig: req.kubeconfig } : {}),
    ...(req.assumeRoleArn ? { assumeRoleArn: req.assumeRoleArn } : {}),
  };
  return restJson<ImportClusterRequest, ImportClusterResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/clusters/import',
    {
      method: 'POST',
      body,
      requireAuth: true,
    },
  );
};

export const getClusterJobStatus = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  jobId: string,
): Promise<GetClusterJobStatusResponse> => {
  return restJson<undefined, GetClusterJobStatusResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/v1/clusters/jobs/${encodeURIComponent(jobId)}/status`,
    {
      method: 'GET',
      requireAuth: true,
    },
  );
};

export const getCluster = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  clusterId: string,
): Promise<ClusterDetail> => {
  return postJson<{ clusterId: string }, ClusterDetail>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    'GetCluster',
    { clusterId },
    { requireAuth: true },
  );
};

export const queryMetrics = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: MetricsQueryRequest,
): Promise<MetricsQueryResponse> => {
  return restJson<MetricsQueryRequest, MetricsQueryResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/metrics/query',
    {
      method: 'POST',
      body: req,
      requireAuth: true,
    },
  );
};

export const queryLogs = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: LogsQueryRequest,
): Promise<LogsQueryResponse> => {
  return restJson<LogsQueryRequest, LogsQueryResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/logs/query',
    {
      method: 'POST',
      body: req,
      requireAuth: true,
    },
  );
};

export const getAlerts = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  projectId: string,
  clusterId: string,
): Promise<AlertsResponse> => {
  const params = new URLSearchParams({
    projectId,
    clusterId,
  });

  return restJson<undefined, AlertsResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/alerts?${params.toString()}`,
    {
      method: 'GET',
      requireAuth: true,
    },
  );
};

export const getTrace = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  projectId: string,
  clusterId: string,
  traceId: string,
): Promise<TraceLookupResponse> => {
  const params = new URLSearchParams({
    projectId,
    clusterId,
  });

  return restJson<undefined, TraceLookupResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    `/api/traces/${encodeURIComponent(traceId)}?${params.toString()}`,
    {
      method: 'GET',
      requireAuth: true,
    },
  );
};

export const getProvisioningLogs = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  jobId: string,
  options?: { since?: string; limit?: number; stream?: boolean },
): Promise<ProvisioningLogsResponse> => {
  const params = new URLSearchParams();
  if (options?.since) {
    params.set('since', options.since);
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
    params.set('limit', String(Math.max(1, Math.floor(options.limit))));
  }
  if (options?.stream) {
    params.set('stream', 'true');
  }

  const query = params.toString();
  const path = query
    ? `/api/v1/provisioning/jobs/${encodeURIComponent(jobId)}/logs?${query}`
    : `/api/v1/provisioning/jobs/${encodeURIComponent(jobId)}/logs`;

  return restJson<undefined, ProvisioningLogsResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    path,
    {
      method: 'GET',
      requireAuth: true,
    },
  );
};

export const streamProvisioningLogs = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  jobId: string,
  options?: { since?: string; limit?: number },
): Promise<ProvisioningLogsResponse> => {
  const params = new URLSearchParams();
  if (options?.since) {
    params.set('since', options.since);
  }
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
    params.set('limit', String(Math.max(1, Math.floor(options.limit))));
  }

  const query = params.toString();
  const path = query
    ? `/api/v1/provisioning/jobs/${encodeURIComponent(jobId)}/logs/stream?${query}`
    : `/api/v1/provisioning/jobs/${encodeURIComponent(jobId)}/logs/stream`;

  return restJson<undefined, ProvisioningLogsResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    path,
    {
      method: 'GET',
      requireAuth: true,
    },
  );
};

export const getFlavor = (w: WorkloadDTO): string =>
  w?.workspace?.flavor ?? w?.training?.flavor ?? '';

export const isTerminalStatus = (status?: string): boolean =>
  status === 'SUCCEEDED' || status === 'FAILED';

type DisplayStatus = {
  label: string;
  color: 'ok' | 'warning' | 'error' | 'progress';
};

export const mapDisplayStatus = (raw?: string): DisplayStatus => {
  switch (raw) {
    case 'RUNNING':
      return { label: 'Running', color: 'progress' };
    case 'SUCCEEDED':
      return { label: 'Succeeded', color: 'ok' };
    case 'FAILED':
      return { label: 'Failed', color: 'error' };
    case 'QUEUED_BY_KUEUE':
      return { label: 'Queued by Kueue', color: 'warning' };
    case 'SUBMITTED':
      return { label: 'Submitted', color: 'warning' };
    case 'PLACED':
    default:
      return { label: 'Queued', color: 'warning' };
  }
};

export type KubernetesLocation = {
  namespace: string;
  kind: string;
  name: string;
};

export const parseKubernetesUrl = (
  url?: string,
): KubernetesLocation | undefined => {
  if (!url || !url.startsWith('k8s://')) {
    return undefined;
  }
  // Format: k8s://namespace/kind/name (kind usually job)
  const parts = url.replace('k8s://', '').split('/');
  if (parts.length < 3) {
    return undefined;
  }
  const [namespace, kind, ...rest] = parts;
  return { namespace, kind, name: rest.join('/') };
};

export const buildKubectlDescribeCommand = (
  loc?: KubernetesLocation,
): string => {
  if (!loc) {
    return '';
  }
  return `kubectl -n ${loc.namespace} describe ${loc.kind} ${loc.name}`;
};
