import { promises as fs } from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import { createBackendPlugin, coreServices } from '@backstage/backend-plugin-api';

const coerceToArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
};

const resolvePath = (input: string) => {
  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }

  if (path.isAbsolute(input)) {
    return input;
  }

  return path.resolve(process.cwd(), input);
};

const normalizePem = (pem: string) => pem.trim() + (pem.trimEnd().endsWith('\n') ? '' : '\n');

export const aegisCaPlugin = createBackendPlugin({
  pluginId: 'aegis-ca',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ config, logger }) {
        const tlsConfig = config.getOptionalConfig('aegis.tls');
        if (!tlsConfig) {
          logger.debug('No aegis.tls configuration found; skipping custom CA setup');
          return;
        }

        logger.info('Initializing Aegis CA trust loader');

        const caEntries: string[] = [];

        const caDataRaw = tlsConfig.getOptional('caData');
        coerceToArray(caDataRaw).forEach(entry => {
          if (entry.trim()) {
            logger.debug('Loaded CA entry from inline configuration');
            caEntries.push(normalizePem(entry));
          }
        });

        const caFilesRaw = [
          ...coerceToArray(tlsConfig.getOptional('caFile')),
          ...coerceToArray(tlsConfig.getOptional('caFiles')),
        ];

        for (const rawPath of caFilesRaw) {
          try {
            const absolutePath = resolvePath(rawPath);
            logger.info(`Loading CA bundle from ${absolutePath}`);
            const data = await fs.readFile(absolutePath, 'utf8');
            if (data.trim()) {
              caEntries.push(normalizePem(data));
            } else {
              logger.warn(`CA file at ${absolutePath} is empty; skipping`);
            }
          } catch (error) {
            logger.warn(`Failed to read CA file ${rawPath}: ${error}`);
          }
        }

        if (caEntries.length === 0) {
          logger.warn('No custom CA entries provided; skipping CA injection');
          return;
        }

        const agent = https.globalAgent;
        const existing = agent.options.ca;

        if (!existing) {
          agent.options.ca = [...caEntries];
        } else if (Array.isArray(existing)) {
          agent.options.ca = [...existing, ...caEntries];
        } else {
          agent.options.ca = [existing, ...caEntries];
        }

        const finalCa = agent.options.ca;
        if (Array.isArray(finalCa)) {
          logger.info(`https.globalAgent now has ${finalCa.length} CA entr${finalCa.length === 1 ? 'y' : 'ies'}`);
        } else if (finalCa) {
          logger.info('https.globalAgent now has 1 CA entry (non-array)');
        } else {
          logger.warn('https.globalAgent CA injection failed: options.ca is empty after update');
        }

        logger.info(`Loaded ${caEntries.length} custom CA certificate(s) for outbound HTTPS requests`);
      },
    });
  },
});

export default aegisCaPlugin;
