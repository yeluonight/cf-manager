import { URL } from 'url';

// RFC 5735 / RFC 1918 — reserved/private IPs that should never be accessed server-side
const BLOCKED_IPV4_PATTERNS: RegExp[] = [
  /^0\./,                      // 0.0.0.0/8
  /^10\./,                      // 10.0.0.0/8
  /^127\./,                     // 127.0.0.0/8
  /^169\.254\./,                // 169.254.0.0/16  (link-local / cloud metadata)
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.0\.0\./,               // 192.0.0.0/24
  /^192\.0\.2\./,               // 192.0.2.0/24   (TEST-NET-1)
  /^192\.88\.99\./,             // 192.88.99.0/24
  /^192\.168\./,                // 192.168.0.0/16
  /^198\.(1[8-9])\./,           // 198.18.0.0/15
  /^198\.51\.100\./,            // 198.51.100.0/24 (TEST-NET-2)
  /^203\.0\.113\./,             // 203.0.113.0/24 (TEST-NET-3)
  /^22[4-9]\./,                 // 224.0.0.0/4    (multicast)
  /^23[0-9]\./,                 // 232-239
  /^24[0-9]\./,                 // 240.0.0.0/4    (reserved)
  /^25[0-5]\./,                 // 255.0.0.0/8
];

export interface UrlValidationOptions {
  allowedProtocols?: string[];
  allowPrivateIp?: boolean;
}

const DEFAULT_OPTIONS: UrlValidationOptions = {
  allowedProtocols: ['https:'],
  allowPrivateIp: false,
};

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

/**
 * Validate a user-supplied URL to prevent SSRF attacks.
 * - Ensures the URL is well-formed
 * - Only allows specified protocols (default: https)
 * - Blocks private/reserved IP addresses (unless allowPrivateIp is true)
 * - Blocks hostname-only or empty URLs
 */
export function validateUrl(input: string, options?: UrlValidationOptions): URL {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new UrlValidationError(`Invalid URL: ${input}`);
  }

  if (!opts.allowedProtocols!.includes(parsed.protocol)) {
    throw new UrlValidationError(`Protocol "${parsed.protocol}" is not allowed. Allowed: ${opts.allowedProtocols!.join(', ')}`);
  }

  if (!parsed.hostname) {
    throw new UrlValidationError('URL must include a hostname');
  }

  // Block .local, .internal, .localhost TLDs
  const host = parsed.hostname.toLowerCase();
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') || host === 'localhost') {
    throw new UrlValidationError(`Hostname "${host}" is not allowed (private/reserved)`);
  }

  // Check IPv4 patterns
  if (!opts.allowPrivateIp && isIPv4(host)) {
    for (const pattern of BLOCKED_IPV4_PATTERNS) {
      if (pattern.test(host)) {
        throw new UrlValidationError(`IP address "${host}" is private/reserved and not allowed`);
      }
    }
  }

  // Block IPv6 private addresses (simplified: ::1, fe80::, fc00::/7)
  if (host.startsWith('[')) {
    const v6 = host.slice(1, -1).toLowerCase();
    if (v6 === '::1' || v6 === '::' || v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd')) {
      throw new UrlValidationError(`IPv6 address "${v6}" is private/reserved and not allowed`);
    }
  }

  return parsed;
}

function isIPv4(s: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
}
