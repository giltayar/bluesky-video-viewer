import { JoseKey } from '@atproto/jwk-jose';
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { OAuthClientMetadataInput } from '@atproto/oauth-client-node';
import { config } from '../config.ts';
import { SessionStore, StateStore } from './stores.ts';

/**
 * Build the AT Protocol OAuth client.
 *
 * - Production (NODE_ENV=production): a confidential client. It publishes client
 *   metadata + JWKS at public URLs and signs client assertions with a private
 *   keyset loaded from env (PRIVATE_KEY_1..3).
 * - Development: the AT Protocol "localhost" development client (a public client,
 *   no keyset). client_id encodes the redirect_uri and scope as query params.
 */
export async function createOAuthClient(): Promise<NodeOAuthClient> {
  const stateStore = new StateStore();
  const sessionStore = new SessionStore();
  const redirectUri = `${config.publicUrl}/api/oauth/callback`;

  if (config.isProd) {
    const clientId = config.clientId ?? `${config.publicUrl}/client-metadata.json`;

    if (!clientId.startsWith('https://')) {
      throw new Error(
        `Production OAuth requires an https public URL, but got "${config.publicUrl}". ` +
          'Set PUBLIC_URL (or CLIENT_ID) to your public https domain, e.g. ' +
          'PUBLIC_URL=https://your-app.up.railway.app',
      );
    }

    const keyImports = [
      process.env.PRIVATE_KEY_1,
      process.env.PRIVATE_KEY_2,
      process.env.PRIVATE_KEY_3,
    ].filter((k): k is string => Boolean(k));

    if (keyImports.length === 0) {
      throw new Error(
        'Production OAuth requires at least one private key (PRIVATE_KEY_1).',
      );
    }

    const keyset = await Promise.all(
      keyImports.map((pem, i) => JoseKey.fromImportable(pem, `key${i + 1}`)),
    );

    const clientMetadata: OAuthClientMetadataInput = {
      client_id: clientId,
      client_name: 'Bluesky Video Viewer',
      client_uri: config.publicUrl,
      redirect_uris: [redirectUri],
      scope: config.scope,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'ES256',
      dpop_bound_access_tokens: true,
      jwks_uri: `${config.publicUrl}/jwks.json`,
    };

    return new NodeOAuthClient({ clientMetadata, keyset, stateStore, sessionStore });
  }

  // Development: loopback client. client_id must have origin http://localhost.
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    scope: config.scope,
  });
  const clientMetadata: OAuthClientMetadataInput = {
    client_id: `http://localhost?${params.toString()}`,
    client_name: 'Bluesky Video Viewer (dev)',
    redirect_uris: [redirectUri],
    scope: config.scope,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    application_type: 'native',
    token_endpoint_auth_method: 'none',
    dpop_bound_access_tokens: true,
  };

  return new NodeOAuthClient({ clientMetadata, stateStore, sessionStore });
}
