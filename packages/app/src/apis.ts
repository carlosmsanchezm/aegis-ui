import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  AuthProviderInfo,
  configApiRef,
  createApiFactory,
  discoveryApiRef,
  oauthRequestApiRef,
} from '@backstage/core-plugin-api';
import { OAuth2, OAuthRequestManager } from '@backstage/core-app-api';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import { keycloakAuthApiRef } from '@internal/plugin-aegis';

export const ensureOidcScopes = (scopes: string[]): string[] => {
  const required = ['openid', 'profile', 'email'];
  const merged = new Set([...scopes, ...required]);
  return Array.from(merged);
};

export const buildKeycloakProviderInfo = (): AuthProviderInfo => ({
  id: 'keycloak',
  title: 'Keycloak SSO',
  icon: VpnKeyIcon,
});

export { keycloakAuthApiRef };

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: oauthRequestApiRef,
    deps: {},
    factory: () => new OAuthRequestManager(),
  }),
  createApiFactory({
    api: keycloakAuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
    },
    factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
      OAuth2.create({
        discoveryApi,
        oauthRequestApi,
        configApi,
        environment: configApi.getOptionalString('auth.environment'),
        provider: buildKeycloakProviderInfo(),
        scopeTransform: ensureOidcScopes,
      }),
  }),
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),
];
