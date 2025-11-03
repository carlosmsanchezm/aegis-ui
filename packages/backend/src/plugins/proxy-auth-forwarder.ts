import { Config } from '@backstage/config';
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { proxyEndpointsExtensionPoint } from '@backstage/plugin-proxy-node/alpha';

const BEARER_PREFIX = /^bearer\s+/i;
const DEFAULT_ALLOWED_HEADERS = [
  'Grpc-Metadata-Authorization',
  'grpc-metadata-authorization',
  'X-Forwarded-Authorization',
  'x-forwarded-authorization',
];

const toHeaderValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
};

const readProxyConfig = (config: Config) => {
  const proxyConfig =
    config.getOptionalConfig('aegis.proxy') ??
    config.getOptionalConfig('proxy.endpoints')?.getOptionalConfig('/aegis');

  if (!proxyConfig) {
    return undefined;
  }

  const credentials = proxyConfig.getOptionalString('credentials');
  const normalizedCredentials = credentials ?? 'require';
  if (
    normalizedCredentials !== 'require' &&
    normalizedCredentials !== 'forward' &&
    normalizedCredentials !== 'dangerously-allow-unauthenticated'
  ) {
    throw new Error(
      `Unsupported credentials policy "${normalizedCredentials}" for ÆGIS proxy; expected require, forward, or dangerously-allow-unauthenticated`,
    );
  }
  const credentialsPolicy = normalizedCredentials as
    | 'require'
    | 'forward'
    | 'dangerously-allow-unauthenticated';

  const allowedHeaders = Array.from(
    new Set([
      ...DEFAULT_ALLOWED_HEADERS,
      ...(proxyConfig.getOptionalStringArray('allowedHeaders') ?? []),
    ]),
  );

  return {
    target: proxyConfig.getString('target'),
    changeOrigin: proxyConfig.getOptionalBoolean('changeOrigin') ?? true,
    credentials: credentialsPolicy,
    allowedHeaders,
    allowedMethods: proxyConfig.getOptionalStringArray('allowedMethods'),
    headers: proxyConfig.getOptionalConfig('headers')?.get<Record<string, string>>() ?? {},
  };
};

/**
 * Forwards the user's provider token to the platform API while leaving the Backstage
 * identity header intact so the proxy can continue enforcing authentication.
 */
export default createBackendModule({
  pluginId: 'proxy',
  moduleId: 'aegis-forward-auth',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        proxyEndpoints: proxyEndpointsExtensionPoint,
      },
      async init({ logger, config, proxyEndpoints }) {
        const proxyConfig = readProxyConfig(config);

        if (!proxyConfig) {
          logger.warn(
            'ÆGIS proxy forwarding is disabled because no configuration was found at aegis.proxy or proxy.endpoints["/aegis"]',
          );
          return;
        }

        proxyEndpoints.addProxyEndpoints({
          '/aegis': {
            ...proxyConfig,
            onProxyReq: (proxyReq, req) => {
              const backstageAuthorization = toHeaderValue(req.headers.authorization);
              const grpcMetadata =
                toHeaderValue(req.headers['grpc-metadata-authorization']) ??
                toHeaderValue(
                  (req.headers as Record<string, unknown>)['Grpc-Metadata-Authorization'],
                );
              const forwardedAuthorization = toHeaderValue(
                (req.headers as Record<string, unknown>)['x-forwarded-authorization'],
              );

              const providerAuthorization = grpcMetadata ?? forwardedAuthorization;

              if (providerAuthorization && BEARER_PREFIX.test(providerAuthorization)) {
                if (backstageAuthorization) {
                  proxyReq.setHeader('x-backstage-authorization', backstageAuthorization);
                }

                proxyReq.setHeader('authorization', providerAuthorization);
                proxyReq.setHeader('grpc-metadata-authorization', providerAuthorization);
                proxyReq.setHeader('Grpc-Metadata-Authorization', providerAuthorization);
                logger.debug('Forwarding provider authorization header to ÆGIS proxy');
              } else if (!providerAuthorization) {
                logger.debug('No provider authorization header present on request to ÆGIS proxy');
              }
            },
          },
        });
      },
    });
  },
});
