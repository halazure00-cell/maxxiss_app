import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminUserByIdHandler } from '../../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return adminUserByIdHandler(req, res);
}
