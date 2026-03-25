import type { VercelRequest, VercelResponse } from '@vercel/node';
import { meHandler } from '../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return meHandler(req, res);
}
