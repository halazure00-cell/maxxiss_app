import type { VercelRequest, VercelResponse } from '@vercel/node';
import { localSyncCompatHandler } from '../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return localSyncCompatHandler(req, res);
}
