import {
  DiscoveryApi,
  FetchApi,
  IdentityApi,
} from '@backstage/core-plugin-api';

export type AccessTokenClient = {
  getAccessToken: (options?: Record<string, unknown>) => Promise<string | undefined>;
};

const base64UrlDecode = (input: string): string => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(normalized);
  }
  if (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).atob === 'function'
  ) {
    return (globalThis as any).atob(normalized);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'base64').toString('utf-8');
  }
  throw new Error('Base64 decoding is not supported in this environment');
};

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
  return `${baseUrl}/aegis/${method}`;
};

export type BackendError = {
  error: {
    code: string;
    message: string;
    details?: string;
  };
};

type PostJsonOptions = {
  requireAuth?: boolean;
  authClient?: AccessTokenClient;
};

const postJson = async <TReq extends object, TRes>(
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  method: string,
  body: TReq,
  options?: PostJsonOptions,
): Promise<TRes> => {
  const url = await buildProxyUrl(discoveryApi, method);

  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  let identityToken: string | undefined;
  let userEntityRef: string | undefined;
  let providerToken: string | undefined;

  try {
    const identity = await identityApi.getBackstageIdentity({ optional: true });
    identityToken = identity?.token;
    userEntityRef = identity?.userEntityRef;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Aegis: unable to obtain Backstage identity', err);
    }
  }

  if (!identityToken) {
    try {
      const credentials = await identityApi.getCredentials();
      identityToken = credentials.token;
      userEntityRef = userEntityRef ?? credentials.userEntityRef;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Aegis: failed to resolve credentials', err);
      }
    }
  }

  const authClient = options?.authClient;
  if (authClient) {
    try {
      providerToken = await authClient.getAccessToken();
      if (process.env.NODE_ENV === 'development' && providerToken) {
        const preview = providerToken.slice(0, 24);
        // eslint-disable-next-line no-console
        console.debug('Aegis: using provider access token', preview, '...');
        try {
          const [, rawPayload] = providerToken.split('.');
          if (rawPayload) {
            const decoded =
              typeof window !== 'undefined' && typeof window.atob === 'function'
                ? window.atob(rawPayload)
                : typeof globalThis !== 'undefined' &&
                    typeof (globalThis as any).atob === 'function'
                  ? (globalThis as any).atob(rawPayload)
                  : Buffer.from(rawPayload, 'base64').toString('utf-8');
            const payload = JSON.parse(decoded);
            // eslint-disable-next-line no-console
            console.debug('Aegis token payload', {
              iss: payload.iss,
              aud: payload.aud,
              client_id: payload.client_id,
              scope: payload.scope,
              amr: payload.amr,
            });
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Aegis: failed to inspect provider token payload', err);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Aegis: failed to obtain provider access token', err);
      }
    }
  }

  // Ensure we have a Backstage identity token for the proxy
  if (!identityToken) {
    // Will trigger sign-in if necessary; guarantees the proxy gets a valid Backstage token
    try {
      const identity = await identityApi.getBackstageIdentity({ optional: false });
      identityToken = identity?.token;
      userEntityRef = userEntityRef ?? identity?.userEntityRef;
    } catch {
      /* fall through; we'll surface a clear error below if still missing */
    }
  }

  if (!identityToken) {
    throw new Error('Backstage identity is not available; please sign in and try again.');
  }

  // 1) Authenticate to the Backstage proxy using the Backstage token
  headers.set('Authorization', `Bearer ${identityToken}`);

  // 2) Only the Keycloak token is forwarded to the platform via gRPC metadata
  if (options?.requireAuth && !providerToken) {
    throw new Error('Authentication is required. Could not obtain a Keycloak access token.');
  }
  if (providerToken) {
    headers.set('Grpc-Metadata-Authorization', `Bearer ${providerToken}`);
    headers.set('grpc-metadata-authorization', `Bearer ${providerToken}`);
    headers.set('X-Forwarded-Authorization', `Bearer ${providerToken}`);
  }

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug(
      'Aegis request headers',
      Array.from(headers.entries()).map(([key, value]) => [key, value.slice(0, 16)]),
    );
  }

  const response = await fetchApi.fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    let errorBody: BackendError | undefined;
    let rawText: string | undefined;
    try {
      rawText = await response.text();
      errorBody = rawText ? (JSON.parse(rawText) as BackendError) : undefined;
    } catch (e) {
      // ignore
    }
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Aegis request failed', {
        method,
        status: response.status,
        statusText: response.statusText,
        body: rawText,
      });
    }
    const message = errorBody?.error?.message || errorBody?.error?.details || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as TRes;
};

export const listWorkloads = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  projectId: string,
  authClient?: AccessTokenClient,
): Promise<WorkloadDTO[]> => {
  const res = await postJson<{ projectId: string }, ListWorkloadsResponse>(
    fetchApi,
    discoveryApi,
    identityApi,
    'aegis.v1.AegisPlatform/ListWorkloads',
    { projectId },
    { requireAuth: false, authClient },
  );
  return res.items ?? [];
};

export const getWorkload = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  id: string,
  authClient?: AccessTokenClient,
): Promise<WorkloadDTO> =>
  postJson<{ id: string }, WorkloadDTO>(
    fetchApi,
    discoveryApi,
    identityApi,
    'aegis.v1.AegisPlatform/GetWorkload',
    { id },
    { requireAuth: false, authClient },
  );

export const createConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  workloadId: string,
  client: 'cli' | 'ssh' | 'vscode' = 'cli',
  authClient?: AccessTokenClient,
): Promise<ConnectionSession> =>
  postJson<{ workloadId: string; client: string }, ConnectionSession>(
    fetchApi,
    discoveryApi,
    identityApi,
    'aegis.v1.AegisPlatform/CreateConnectionSession',
    { workloadId, client },
    { requireAuth: true, authClient },
  );

export const renewConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  sessionId: string,
  authClient?: AccessTokenClient,
): Promise<ConnectionSession> =>
  postJson<{ sessionId: string }, ConnectionSession>(
    fetchApi,
    discoveryApi,
    identityApi,
    'aegis.v1.AegisPlatform/RenewConnectionSession',
    { sessionId },
    { requireAuth: true, authClient },
  );

export const revokeConnectionSession = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  sessionId: string,
  authClient?: AccessTokenClient,
): Promise<void> => {
  await postJson<{ sessionId: string }, unknown>(
    fetchApi,
    discoveryApi,
    identityApi,
    'aegis.v1.AegisPlatform/RevokeConnectionSession',
    { sessionId },
    { requireAuth: true, authClient },
  );
};

export const submitWorkspace = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  req: SubmitWorkspaceRequest,
  authClient?: AccessTokenClient,
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
    'aegis.v1.AegisPlatform/SubmitWorkload',
    body,
    { requireAuth: true, authClient },
  );
};

export const createCluster = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  clusterName: string,
  authClient?: AccessTokenClient,
): Promise<{ jobId: string }> => {
  const body = { name: clusterName };
  return postJson<typeof body, { jobId: string }>(
    fetchApi,
    discoveryApi,
    identityApi,
    'aegis.v1.AegisPlatform/CreateCluster',
    body,
    { requireAuth: true, authClient },
  );
};

export const getClusterStatus = async (
  fetchApi: FetchApi,
  discoveryApi: DiscoveryApi,
  identityApi: IdentityApi,
  jobId: string,
  authClient?: AccessTokenClient,
): Promise<{ jobId: string; status: string; message: string; progress: number }> => {
  const body = { jobId };
  return postJson<
    typeof body,
    { jobId: string; status: string; message: string; progress: number }
  >(
    fetchApi,
    discoveryApi,
    identityApi,
    'aegis.v1.AegisPlatform/GetClusterStatus',
    body,
    { requireAuth: true, authClient },
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
