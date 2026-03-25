import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bootstrapHandler } from '../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return bootstrapHandler(req, res);
}
