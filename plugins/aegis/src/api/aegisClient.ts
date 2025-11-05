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
  workspace: WorkspaceSpec;
};

export type CreateWorkspaceResponse = {
  workload: WorkloadDTO;
};

export type CreateClusterRequest = {
  projectId: string;
  clusterId: string;
  provider: string;
  region: string;
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
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
  const res = await postJson<{ projectId: string }, ListWorkloadsResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    'ListWorkloads',
    { projectId },
    { requireAuth: true },
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
  postJson<{ id: string }, WorkloadDTO>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    'GetWorkload',
    { id },
    { requireAuth: true },
  );

export const createConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  workloadId: string,
  client: 'cli' | 'ssh' | 'vscode' = 'cli',
): Promise<ConnectionSession> =>
  postJson<{ workloadId: string; client: string }, ConnectionSession>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    'CreateConnectionSession',
    { workloadId, client },
    { requireAuth: true },
  );

export const renewConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  sessionId: string,
): Promise<ConnectionSession> =>
  postJson<{ sessionId: string }, ConnectionSession>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    'RenewConnectionSession',
    { sessionId },
    { requireAuth: true },
  );

export const revokeConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  sessionId: string,
): Promise<void> => {
  await postJson<{ sessionId: string }, unknown>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    'RevokeConnectionSession',
    { sessionId },
    { requireAuth: true },
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
      workspace: {
        flavor: workspaceInput.flavor,
        image: workspaceInput.image,
        interactive: true,
        command,
        ports,
        ...(env ? { env } : {}),
        ...(maxDuration ? { maxDurationSeconds: maxDuration } : {}),
      },
    },
  };
  return postJson<typeof body, WorkloadDTO>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    'SubmitWorkload',
    body,
    { requireAuth: true },
  );
};

export const createWorkspace = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: CreateWorkspaceRequest,
): Promise<CreateWorkspaceResponse> => {
  const workspaceInput = req.workspace ?? {};
  const command = normalizeCommand(workspaceInput.command);
  const ports = ensureWorkspacePorts(workspaceInput.ports);
  const env = mergeWorkspaceEnv(workspaceInput.env);
  const maxDuration =
    typeof workspaceInput.maxDurationSeconds === 'number' &&
    Number.isFinite(workspaceInput.maxDurationSeconds)
      ? Math.floor(workspaceInput.maxDurationSeconds)
      : undefined;

  const body: CreateWorkspaceRequest = {
    projectId: req.projectId,
    ...(req.workspaceId ? { workspaceId: req.workspaceId } : {}),
    ...(req.queue ? { queue: req.queue } : {}),
    workspace: {
      ...(workspaceInput.flavor ? { flavor: workspaceInput.flavor } : {}),
      ...(workspaceInput.image ? { image: workspaceInput.image } : {}),
      interactive: workspaceInput.interactive ?? true,
      ...(command.length > 0 ? { command } : {}),
      ports,
      ...(env ? { env } : {}),
      ...(maxDuration ? { maxDurationSeconds: maxDuration } : {}),
    },
  };

  return restJson<CreateWorkspaceRequest, CreateWorkspaceResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/workspaces',
    {
      method: 'POST',
      body,
      requireAuth: true,
    },
  );
};

export const createCluster = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  authApi: OAuthApi | undefined,
  req: CreateClusterRequest,
): Promise<CreateClusterResponse> => {
  return restJson<CreateClusterRequest, CreateClusterResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    authApi,
    '/api/v1/clusters',
    {
      method: 'POST',
      body: req,
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
