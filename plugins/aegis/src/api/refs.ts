import { createApiRef } from '@backstage/core-plugin-api';
import type { OAuth2 } from '@backstage/core-app-api';

export const keycloakAuthApiRef = createApiRef<OAuth2>({
  id: 'internal.auth.keycloak',
});
