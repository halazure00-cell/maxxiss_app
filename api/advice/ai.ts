import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adviceHandler } from '../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return adviceHandler(req, res);
}
