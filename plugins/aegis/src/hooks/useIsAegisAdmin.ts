import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { useAsyncRetry } from 'react-use';

const ADMIN_ENTITY_REFS = new Set([
  'group:default/platform-admins',
  'group:default/aegis-admins',
]);

export const useIsAegisAdmin = () => {
  const identityApi = useApi(identityApiRef);

  return useAsyncRetry(async () => {
    try {
      const identity = await identityApi.getBackstageIdentity();
      const ownership = identity?.ownershipEntityRefs ?? [];
      const normalized = ownership.map(ref => ref.toLocaleLowerCase('en-US'));
      return normalized.some(ref => ADMIN_ENTITY_REFS.has(ref));
    } catch (error) {
      return false;
    }
  }, [identityApi]);
};
