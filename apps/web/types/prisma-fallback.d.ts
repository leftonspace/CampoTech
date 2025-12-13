/**
 * Prisma Client Fallback Types
 * ============================
 *
 * This file provides fallback type definitions for @prisma/client
 * when the Prisma client hasn't been generated (e.g., in CI environments
 * where prisma generate hasn't run yet).
 *
 * These types will be overridden by the actual generated types when
 * `prisma generate` is run (e.g., during Vercel deployment).
 */

declare module '@prisma/client' {
  export class PrismaClient {
    constructor(options?: any);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(event: string, callback: (e: any) => void): void;
    $transaction<T>(fn: (prisma: any) => Promise<T>): Promise<T>;
    $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
    $use(middleware: any): void;
    $extends(extension: any): any;
    $queryRaw<T = unknown>(query: TemplateStringsArray | any, ...values: any[]): Promise<T>;
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
    $executeRaw(query: TemplateStringsArray | any, ...values: any[]): Promise<number>;
    $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
    [key: string]: any;
  }

  export namespace Prisma {
    export type TransactionClient = Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >;

    export const dmmf: any;
    export const sql: any;
    export const raw: any;
    export const join: any;
    export const empty: any;

    export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
    export type JsonObject = { [key: string]: JsonValue };
    export type JsonArray = JsonValue[];
    export type InputJsonValue = string | number | boolean | null | InputJsonObject | InputJsonArray;
    export type InputJsonObject = { [key: string]: InputJsonValue };
    export type InputJsonArray = InputJsonValue[];

    export type Decimal = any;
  }
}
