import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminResetPasswordHandler } from '../../../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return adminResetPasswordHandler(req, res);
}
