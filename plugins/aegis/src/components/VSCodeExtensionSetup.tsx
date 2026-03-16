import { FC, ReactNode, useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
import { CopyTextButton } from '@backstage/core-components';
import {
  useApi,
  fetchApiRef,
  discoveryApiRef,
  identityApiRef,
  OAuthApi,
} from '@backstage/core-plugin-api';
import {
  ExtensionMetadata,
  getExtensionMetadata,
} from '../api/aegisClient';
import { keycloakAuthApiRef } from '../api/refs';

type VSCodeExtensionSetupProps = {
  onConfirm: () => void;
};

const detectArgvJsonPath = (): string => {
  const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
  if (platform.startsWith('Win')) {
    return '%APPDATA%\\Code\\argv.json';
  }
  if (platform.startsWith('Mac') || platform.includes('Mac')) {
    return '~/Library/Application Support/Code/argv.json';
  }
  return '~/.vscode/argv.json';
};

const ARGV_JSON_CONTENT = `{
  "enable-proposed-api": ["aegis.aegis-remote"]
}`;

const CodeBlock: FC<{ children: ReactNode }> = ({ children }) => (
  <Box
    component="pre"
    bgcolor="#0e1117"
    color="#f8f8f2"
    padding={2}
    borderRadius={4}
    style={{ overflowX: 'auto' }}
  >
    {children}
  </Box>
);

export const VSCodeExtensionSetup: FC<VSCodeExtensionSetupProps> = ({
  onConfirm,
}) => {
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  let authApi: OAuthApi | undefined;
  try {
    authApi = useApi(keycloakAuthApiRef) as unknown as OAuthApi;
  } catch {
    authApi = undefined;
  }

  const [metadata, setMetadata] = useState<ExtensionMetadata | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const argvJsonPath = useMemo(() => detectArgvJsonPath(), []);

  useEffect(() => {
    let cancelled = false;

    const fetchMetadata = async () => {
      try {
        setLoading(true);
        setError(false);
        // Resolve the proxy base URL so we can build full download URLs.
        const proxyBase = await discoveryApi.getBaseUrl('proxy');
        const platformBase = `${proxyBase}/aegis`;
        if (!cancelled) {
          setBaseUrl(platformBase);
        }
        const data = await getExtensionMetadata(
          fetchApi,
          discoveryApi,
          identityApi,
          authApi,
        );
        if (!cancelled) {
          setMetadata(data);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [fetchApi, discoveryApi, identityApi, authApi]);

  const version = metadata?.version ?? 'latest';
  const sha256 = metadata?.sha256 ?? '';
  const fullVsixUrl = baseUrl && metadata?.vsixUrl ? `${baseUrl}${metadata.vsixUrl}` : '';
  const fullSetupScriptUrl = baseUrl && metadata?.setupScriptUrl ? `${baseUrl}${metadata.setupScriptUrl}` : '';
  const curlCommand = fullSetupScriptUrl
    ? `curl -fsSL ${fullSetupScriptUrl} | bash`
    : 'curl -fsSL <platform-url>/api/v1/extension/setup-script | bash';
  const installCommand = `code --install-extension aegis-remote-${version}.vsix --force`;

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" gridGap={12}>
        <Typography variant="h6">
          Set Up VS Code Extension &amp; CLI Helper
        </Typography>
        <Typography variant="body2">Loading setup information...</Typography>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gridGap={16}>
      <Typography variant="h6">
        Set Up VS Code Extension &amp; CLI Helper
      </Typography>

      {error && (
        <Typography variant="body2" color="textSecondary">
          Could not fetch extension metadata. Showing manual instructions with
          placeholder values.
        </Typography>
      )}

      {/* Section 1: Automated Setup */}
      <Box display="flex" flexDirection="column" gridGap={8}>
        <Typography variant="subtitle1">
          1. Automated Setup (recommended)
        </Typography>
        <Typography variant="body2">
          Run the following command to install both the VS Code extension and the
          CLI helper automatically:
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box flex={1} minWidth={0}>
            <CodeBlock>{curlCommand}</CodeBlock>
          </Box>
          <CopyTextButton text={curlCommand} />
        </Box>
      </Box>

      {/* Section 2: VS Code Extension (Manual) */}
      <Box display="flex" flexDirection="column" gridGap={8}>
        <Typography variant="subtitle1">
          2. VS Code Extension (Manual)
        </Typography>

        {fullVsixUrl ? (
          <Box>
            <Button
              color="primary"
              variant="outlined"
              href={fullVsixUrl}
              target="_blank"
              rel="noopener"
            >
              Download VSIX (v{version})
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" color="textSecondary">
            VSIX download URL not available. Use the automated setup above.
          </Typography>
        )}

        {sha256 && (
          <Box>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2">
                <strong>SHA-256:</strong>
              </Typography>
              <CopyTextButton text={sha256} />
            </Box>
            <CodeBlock>{sha256}</CodeBlock>
          </Box>
        )}

        <Box>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2">
              <strong>Install command:</strong>
            </Typography>
            <CopyTextButton text={installCommand} />
          </Box>
          <CodeBlock>{installCommand}</CodeBlock>
        </Box>

        <Box>
          <Typography variant="body2">
            Enable the proposed API by adding the following to{' '}
            <code>{argvJsonPath}</code>:
          </Typography>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box flex={1} minWidth={0}>
              <CodeBlock>{ARGV_JSON_CONTENT}</CodeBlock>
            </Box>
            <CopyTextButton text={ARGV_JSON_CONTENT} />
          </Box>
        </Box>
      </Box>

      {/* Section 3: CLI Helper */}
      <Box display="flex" flexDirection="column" gridGap={8}>
        <Typography variant="subtitle1">3. CLI Helper</Typography>
        <Typography variant="body2">
          The CLI helper (<code>aegis-connect</code>) is included when using the
          automated setup script above. If you need to install it separately,
          download the binary for your platform from the release page and place
          it on your PATH.
        </Typography>
      </Box>

      {/* Confirm button */}
      <Box display="flex" justifyContent="flex-end">
        <Button color="primary" variant="contained" onClick={onConfirm}>
          I Completed Setup
        </Button>
      </Box>
    </Box>
  );
};
