import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminUsersHandler } from '../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return adminUsersHandler(req, res);
}
