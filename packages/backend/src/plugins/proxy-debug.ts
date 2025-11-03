import express from 'express';
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';

export default createBackendModule({
  pluginId: 'proxy',
  moduleId: 'aegis-debug-headers',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ logger, httpRouter }) {
        const router = express.Router();

        router.use('/api/proxy/aegis', (req, _res, next) => {
          const authHeader = req.headers.authorization ?? '<missing>';
          const metadataHeader =
            req.headers['grpc-metadata-authorization'] ??
            req.headers['Grpc-Metadata-Authorization'] ??
            '<missing>';
         logger.info('Proxy debug headers', {
           authorization:
             typeof authHeader === 'string' ? `${authHeader.slice(0, 24)}…` : '<missing>',
           grpcMetadata:
             typeof metadataHeader === 'string'
               ? `${metadataHeader.slice(0, 24)}…`
               : Array.isArray(metadataHeader)
                 ? metadataHeader.map(value => value.slice(0, 24))
                 : '<missing>',
         });
          // eslint-disable-next-line no-console
          console.log('Proxy debug headers', {
            authorization:
              typeof authHeader === 'string' ? `${authHeader.slice(0, 24)}…` : '<missing>',
            grpcMetadata:
              typeof metadataHeader === 'string'
                ? `${metadataHeader.slice(0, 24)}…`
                : Array.isArray(metadataHeader)
                  ? metadataHeader.map(value => value.slice(0, 24))
                  : '<missing>',
          });
          next();
        });

        httpRouter.use(router);
      },
    });
  },
});
