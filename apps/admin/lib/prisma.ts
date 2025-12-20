/**
 * Prisma Client for Admin Panel
 * ==============================
 *
 * Connects to the same database as the web app to access subscription data.
 */

import { PrismaClient } from '@prisma/client';

declare global {
  var adminPrisma: PrismaClient | undefined;
}

export const prisma = global.adminPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.adminPrisma = prisma;
}
