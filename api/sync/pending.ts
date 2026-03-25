import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncPendingHandler } from '../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return syncPendingHandler(req, res);
}
