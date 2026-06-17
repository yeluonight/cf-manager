import { Router } from 'express';
import { config } from '../config';
import { clearCache } from '../services/accountRouter';
import { clearClientCache } from '../services/cfFactory';
import { getProxyUrl, setProxyUrl, testProxyConnection } from '../services/proxyService';
import { validateUrl } from '../utils/urlValidator';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    encryption_key_configured: !!config.encryptionKey,
    api_secret_configured: !!config.apiSecret,
    proxy_url_configured: !!getProxyUrl(),
  });
});

router.post('/cache/clear', (_req, res) => {
  clearCache();
  clearClientCache();
  res.json({ success: true, message: 'All caches cleared (zones, quota, SDK clients)' });
});

router.put('/proxy', (req, res) => {
  const { proxy_url } = req.body;
  if (typeof proxy_url !== 'string') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'proxy_url must be a string' } });
    return;
  }
  if (proxy_url !== '') {
    try {
      validateUrl(proxy_url, { allowedProtocols: ['http:', 'https:', 'socks4:', 'socks5:', 'socks5h:'], allowPrivateIp: true });
    } catch (e: any) {
      res.status(400).json({ error: { code: 'INVALID_PROXY_URL', message: e.message } });
      return;
    }
  }
  setProxyUrl(proxy_url);
  clearClientCache();
  res.json({ success: true, proxy_url: getProxyUrl() });
});

router.post('/proxy/test', async (req, res) => {
  const { proxy_url } = req.body;
  const url = typeof proxy_url === 'string' ? proxy_url : getProxyUrl();
  if (!url) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No proxy URL to test' } });
    return;
  }
  try {
    validateUrl(url, { allowedProtocols: ['http:', 'https:', 'socks4:', 'socks5:', 'socks5h:'], allowPrivateIp: true });
    const result = await testProxyConnection(url);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(502).json({ error: { code: 'PROXY_TEST_FAILED', message: err.message || 'Proxy test failed' } });
  }
});

export default router;
