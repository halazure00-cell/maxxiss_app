import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logoutHandler } from '../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return logoutHandler(req, res);
}
