import type { VercelRequest, VercelResponse } from '@vercel/node';
import { patchUserSettingsHandler } from '../src/server/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return patchUserSettingsHandler(req, res);
}
