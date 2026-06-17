import Cloudflare from 'cloudflare';
import nodeFetch from 'node-fetch';
import { Account } from '../models/account';
import { decrypt } from './encryptionService';
import { getHttpAgent } from './proxyService';

export function getAuthHeaders(account: Account): Record<string, string> {
  if (account.auth_type === 'token') {
    if (!account.api_token) throw new Error(`Account ${account.id} is missing api_token`);
    return { 'Authorization': `Bearer ${decrypt(account.api_token)}` };
  }
  if (!account.api_key) throw new Error(`Account ${account.id} is missing api_key`);
  if (!account.email) throw new Error(`Account ${account.id} is missing email`);
  return { 'X-Auth-Email': account.email, 'X-Auth-Key': decrypt(account.api_key) };
}

/**
 * Build a custom fetch that injects the proxy agent into every request.
 * The Cloudflare SDK's auto-detected shim may use native fetch (Node 18+),
 * which silently ignores the `agent` option — meaning proxy never works.
 * By passing a custom fetch wrapping node-fetch (which does support `agent`),
 * we guarantee the proxy is always used.
 */
function makeProxiedFetch(agent: any): any {
  const fn = (url: any, opts?: any) => nodeFetch(url, { ...opts, agent }) as any;
  // Copy node-fetch static properties so the SDK can access them
  return Object.assign(fn, nodeFetch);
}

export function getCfClient(account: Account): Cloudflare {
  const httpAgent = getHttpAgent();
  const opts: Record<string, any> = {};

  if (httpAgent) {
    opts.fetch = makeProxiedFetch(httpAgent);
  }

  if (account.auth_type === 'token') {
    if (!account.api_token) throw new Error(`Account ${account.id} is missing api_token`);
    try {
      return new Cloudflare({ apiToken: decrypt(account.api_token), ...opts });
    } catch (err) {
      throw new Error(`Invalid encrypted credentials for account ${account.id}`);
    }
  }
  if (!account.api_key) throw new Error(`Account ${account.id} is missing api_key`);
  if (!account.email) throw new Error(`Account ${account.id} is missing email`);
  try {
    return new Cloudflare({ apiKey: decrypt(account.api_key), apiEmail: account.email, ...opts });
  } catch (err) {
    throw new Error(`Invalid encrypted credentials for account ${account.id}`);
  }
}

export function clearClientCache(): void {
  // No-op since we're not caching anymore
}
