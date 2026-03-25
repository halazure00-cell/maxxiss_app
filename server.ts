import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  adminResetPasswordHandler,
  adminUserByIdHandler,
  adminUsersHandler,
  adviceHandler,
  bootstrapAdminIfNeeded,
  bootstrapHandler,
  createRadarLogHandler,
  createTransactionHandler,
  deleteRadarLogHandler,
  healthHandler,
  localSyncCompatHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  patchUserSettingsHandler,
  resetTodayHandler,
  syncPendingHandler,
} from './src/server/handlers';

async function startServer() {
  const app = express();
  const port = Number.parseInt(process.env.PORT || '3000', 10);

  await bootstrapAdminIfNeeded();

  app.use(express.json());

  app.all('/api/health', healthHandler);
  app.all('/api/auth/login', loginHandler);
  app.all('/api/auth/logout', logoutHandler);
  app.all('/api/auth/me', meHandler);
  app.all('/api/bootstrap', bootstrapHandler);
  app.all('/api/advice/ai', adviceHandler);
  app.all('/api/transactions', createTransactionHandler);
  app.all('/api/radar-logs', createRadarLogHandler);
  app.all('/api/radar-logs/:id', deleteRadarLogHandler);
  app.all('/api/user-settings', patchUserSettingsHandler);
  app.all('/api/sync/pending', syncPendingHandler);
  app.all('/api/sync', localSyncCompatHandler);
  app.all('/api/day/reset', resetTodayHandler);
  app.all('/api/admin/users', adminUsersHandler);
  app.all('/api/admin/users/:id', adminUserByIdHandler);
  app.all('/api/admin/users/:id/reset-password', adminResetPasswordHandler);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Maxxiss dev server berjalan di http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('[SERVER ERROR]', error);
  process.exit(1);
});
