import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loginHandler } from '../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return loginHandler(req, res);
}
