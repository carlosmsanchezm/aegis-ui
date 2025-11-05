import { useApi, fetchApiRef, discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { useAsyncRetry } from 'react-use';
import { keycloakAuthApiRef } from '../api/refs';
import {
  ClusterSummary,
  FlavorSummary,
  ProjectSummary,
  QueueSummary,
  listClusters,
  listFlavors,
  listProjects,
  listQueues,
} from '../api/aegisClient';

export type ProvisioningCatalog = {
  projects: ProjectSummary[];
  queues: QueueSummary[];
  clusters: ClusterSummary[];
  flavors: FlavorSummary[];
};

export const useProvisioningCatalog = () => {
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const authApi = useApi(keycloakAuthApiRef);

  const state = useAsyncRetry<ProvisioningCatalog>(async () => {
    const [projects, queues, clusters, flavors] = await Promise.all([
      listProjects(fetchApi, discoveryApi, identityApi, authApi),
      listQueues(fetchApi, discoveryApi, identityApi, authApi),
      listClusters(fetchApi, discoveryApi, identityApi, authApi),
      listFlavors(fetchApi, discoveryApi, identityApi, authApi),
    ]);

    return {
      projects,
      queues,
      clusters,
      flavors,
    };
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  return state;
};
