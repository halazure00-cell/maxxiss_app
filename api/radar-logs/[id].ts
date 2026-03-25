import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteRadarLogHandler } from '../../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return deleteRadarLogHandler(req, res);
}
