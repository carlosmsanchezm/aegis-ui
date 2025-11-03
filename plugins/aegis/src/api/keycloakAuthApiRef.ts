import { createApiRef } from '@backstage/core-plugin-api';

import type { AccessTokenClient } from './aegisClient';

export const keycloakAuthApiRef = createApiRef<AccessTokenClient>({
  id: 'internal.auth.keycloak',
  description: 'OIDC access token API for Keycloak-backed sessions',
});
