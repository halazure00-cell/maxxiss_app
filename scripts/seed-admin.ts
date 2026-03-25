import 'dotenv/config';
import { UserRole } from '@prisma/client';
import { hashPassword } from '../src/server/auth';
import { prisma } from '../src/server/prisma';

async function main() {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  const displayName = process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() || 'Developer';

  if (!username || !password) {
    throw new Error('ADMIN_BOOTSTRAP_USERNAME dan ADMIN_BOOTSTRAP_PASSWORD wajib diisi.');
  }

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('ADMIN_BOOTSTRAP_USERNAME harus 3-32 karakter dan hanya boleh berisi huruf kecil, angka, titik, strip, atau underscore.');
  }

  if (displayName.length < 3 || displayName.length > 60) {
    throw new Error('ADMIN_BOOTSTRAP_DISPLAY_NAME harus 3-60 karakter.');
  }

  if (password.length < 8) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD minimal 8 karakter.');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.appUser.upsert({
    where: { username },
    update: {
      displayName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      username,
      displayName,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      userSettings: {
        create: {},
      },
    },
  });

  console.log(`Admin bootstrap siap untuk username: ${user.username}`);
}

main()
  .catch((error) => {
    console.error('[SEED ADMIN ERROR]', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
