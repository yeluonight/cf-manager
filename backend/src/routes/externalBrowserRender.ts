import { Router } from 'express';
import { handleBrowserRender } from '../services/browserRenderHandler';
import { getBrowserRenderStatus } from '../services/browserRateLimiter';
import { validateUrl } from '../utils/urlValidator';

const router = Router();

router.post('/render', async (req, res, next) => {
  try {
    const { url, mode, accountId } = req.body;
    if (url) {
      try { validateUrl(url); } catch (e: any) { res.status(400).json({ error: { code: 'INVALID_URL', message: e.message } }); return; }
    }
    const { status, body } = await handleBrowserRender({ url, mode, accountId });
    res.status(status).json(body);
  } catch (err) { next(err); }
});

router.get('/status', (_req, res) => {
  res.json(getBrowserRenderStatus());
});

export default router;
