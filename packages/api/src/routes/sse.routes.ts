import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import { registerSseClient } from '../lib/sse.js';

const router = Router();

/**
 * GET /sse/orders
 * Admin-only SSE stream for real-time order notifications.
 * Client connects and receives:
 *   - event: connected  (on connection)
 *   - event: new_order  (on each new order)
 *   - comment: heartbeat (every 25s)
 */
router.get('/orders', authenticate, requireAdmin, (req, res) => {
  registerSseClient(req.user!.sub, res);
});

export default router;
