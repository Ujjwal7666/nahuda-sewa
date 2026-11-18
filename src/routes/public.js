import { Router } from 'express';
import { showFoundation } from '../controllers/public-controller.js';

export function createPublicRouter(content,fixedContent) {
  const router=Router();
  router.get(['/', '/ne'], showFoundation(content,fixedContent));
  return router;
}
