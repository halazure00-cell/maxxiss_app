import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTransactionHandler } from '../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return createTransactionHandler(req, res);
}
