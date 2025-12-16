/**
 * Web Database Mock
 * =================
 *
 * Complete mock for web platform - replaces ALL WatermelonDB functionality.
 * This file is used as a redirect target for all @nozbe/watermelondb imports on web.
 */

import React from 'react';

// ============================================================================
// Mock Observable
// ============================================================================

class MockObservable<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  subscribe(callback: (value: T) => void) {
    callback(this.value);
    return { unsubscribe: () => {} };
  }

  pipe(...args: unknown[]) {
    return this;
  }
}

// ============================================================================
// Mock Query - All chainable methods return this
// ============================================================================

class WebQuery<T> {
  private collection: WebCollection<T>;

  constructor(collection: WebCollection<T>) {
    this.collection = collection;
  }

  // All chainable query methods
  extend(...args: unknown[]): WebQuery<T> { return this; }
  where(...args: unknown[]): WebQuery<T> { return this; }
  sortBy(...args: unknown[]): WebQuery<T> { return this; }
  take(n: number): WebQuery<T> { return this; }
  skip(n: number): WebQuery<T> { return this; }

  // Data fetching methods
  async fetch(): Promise<T[]> {
    return this.collection.getData();
  }

  async fetchCount(): Promise<number> {
    return this.collection.getData().length;
  }

  async fetchIds(): Promise<string[]> {
    return this.collection.getData().map((item: any) => item.id || '');
  }

  // Observable methods
  observe(): MockObservable<T[]> {
    return new MockObservable(this.collection.getData());
  }

  observeCount(): MockObservable<number> {
    return new MockObservable(this.collection.getData().length);
  }

  observeWithColumns(columns: string[]): MockObservable<T[]> {
    return this.observe();
  }
}

// ============================================================================
// Mock Collection
// ============================================================================

class WebCollection<T = Record<string, unknown>> {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getStorageKey(): string {
    return `campotech_${this.tableName}`;
  }

  getData(): T[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(this.getStorageKey());
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setData(data: T[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
      }
    } catch {}
  }

  query(...args: unknown[]): WebQuery<T> {
    return new WebQuery<T>(this);
  }

  async find(id: string): Promise<T | null> {
    const data = this.getData();
    return data.find((item: any) => item.id === id) || null;
  }

  async create(writer: (record: any) => void): Promise<T> {
    const record = {
      id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _status: 'created',
      _changed: '',
    };
    writer(record);
    const data = this.getData();
    data.push(record as T);
    this.setData(data);
    return record as T;
  }

  prepareCreate(writer: (record: any) => void): T {
    const record = {
      id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _status: 'created',
      _changed: '',
    };
    writer(record);
    return record as T;
  }
}

// ============================================================================
// Mock Database
// ============================================================================

class WebDatabase {
  private _collections = new Map<string, WebCollection>();

  get<T>(tableName: string): WebCollection<T> {
    if (!this._collections.has(tableName)) {
      this._collections.set(tableName, new WebCollection<T>(tableName));
    }
    return this._collections.get(tableName) as WebCollection<T>;
  }

  async write<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  async read<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  async batch(...records: unknown[]): Promise<void> {}

  get collections() {
    return {
      get: <T>(name: string) => this.get<T>(name),
    };
  }
}

// ============================================================================
// Database singleton and collections
// ============================================================================

export const database = new WebDatabase();

export const jobsCollection = database.get('jobs');
export const customersCollection = database.get('customers');
export const priceBookCollection = database.get('price_book_items');
export const jobPhotosCollection = database.get('job_photos');
export const syncQueueCollection = database.get('sync_queue');
export const syncConflictsCollection = database.get('sync_conflicts');
export const userSessionCollection = database.get('user_session');
export const productsCollection = database.get('products');
export const vehicleStockCollection = database.get('vehicle_stock');
export const replenishmentRequestsCollection = database.get('replenishment_requests');

// ============================================================================
// Mock Q (Query helpers)
// ============================================================================

export const Q = {
  where: (...args: unknown[]) => args,
  eq: (value: unknown) => value,
  notEq: (value: unknown) => value,
  gt: (value: unknown) => value,
  gte: (value: unknown) => value,
  lt: (value: unknown) => value,
  lte: (value: unknown) => value,
  oneOf: (values: unknown[]) => values,
  notIn: (values: unknown[]) => values,
  between: (a: unknown, b: unknown) => [a, b],
  like: (value: string) => value,
  notLike: (value: string) => value,
  sanitizeLikeString: (s: string) => s,
  includes: (value: unknown) => value,
  on: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
  and: (...args: unknown[]) => args,
  sortBy: (column: string, order?: string) => ({ column, order }),
  take: (n: number) => n,
  skip: (n: number) => n,
  experimentalJoinTables: (...args: unknown[]) => args,
  experimentalNestedJoin: (...args: unknown[]) => args,
};

// ============================================================================
// Mock Model class
// ============================================================================

export class Model {
  id: string = '';
  _status: string = '';
  _changed: string = '';
  static table: string = '';
  static associations: Record<string, unknown> = {};

  async update(writer: (record: any) => void): Promise<void> {}
  async markAsDeleted(): Promise<void> {}
  async destroyPermanently(): Promise<void> {}
  observe() { return new MockObservable(this); }
  prepareUpdate(writer: (record: any) => void) { return this; }
  prepareMarkAsDeleted() { return this; }
  prepareDestroyPermanently() { return this; }
}

// ============================================================================
// Mock decorators (no-op on web)
// ============================================================================

export const field = (columnName: string) => (target: any, key: string) => {};
export const text = (columnName: string) => (target: any, key: string) => {};
export const json = (columnName: string, sanitizer?: any) => (target: any, key: string) => {};
export const date = (columnName: string) => (target: any, key: string) => {};
export const readonly = (target: any, key: string, descriptor?: any) => descriptor || {};
export const relation = (table: string, columnName: string) => (target: any, key: string) => {};
export const immutableRelation = (table: string, columnName: string) => (target: any, key: string) => {};
export const children = (table: string) => (target: any, key: string) => {};
export const lazy = (target: any, key: string, descriptor?: any) => descriptor || {};
export const action = (target: any, key: string, descriptor?: any) => descriptor || {};
export const writer = (target: any, key: string, descriptor?: any) => descriptor || {};
export const reader = (target: any, key: string, descriptor?: any) => descriptor || {};
export const nochange = (target: any, key: string) => {};

// ============================================================================
// Mock schema helpers
// ============================================================================

export const tableSchema = (schema: any) => schema;
export const appSchema = (schema: any) => schema;
export const columnName = (name: string) => name;

// ============================================================================
// Mock Database class export (for class extension)
// ============================================================================

export class Database extends WebDatabase {}

// ============================================================================
// Mock DatabaseProvider component
// ============================================================================

interface DatabaseProviderProps {
  database?: any;
  children: React.ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  return React.createElement(React.Fragment, null, children);
};

// ============================================================================
// Mock withDatabase HOC
// ============================================================================

export const withDatabase = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<Omit<P, 'database'>> => {
  return Component as any;
};

// ============================================================================
// Mock withObservables HOC
// ============================================================================

export const withObservables = (
  triggerProps: string[],
  getObservables: (props: any) => Record<string, any>
) => <P extends object>(Component: React.ComponentType<P>): React.ComponentType<any> => {
  return Component as any;
};

// ============================================================================
// Mock useDatabase hook
// ============================================================================

export const useDatabase = () => database;

// ============================================================================
// Mock model classes (empty implementations for imports)
// ============================================================================

export class Job extends Model { static table = 'jobs'; }
export class Customer extends Model { static table = 'customers'; }
export class PriceBookItem extends Model { static table = 'price_book_items'; }
export class JobPhoto extends Model { static table = 'job_photos'; }
export class SyncQueue extends Model { static table = 'sync_queue'; }
export class SyncConflict extends Model { static table = 'sync_conflicts'; }
export class UserSession extends Model { static table = 'user_session'; }
export class Product extends Model { static table = 'products'; }
export class VehicleStock extends Model { static table = 'vehicle_stock'; }
export class ReplenishmentRequest extends Model { static table = 'replenishment_requests'; }

// Model classes array for schema
export const modelClasses = [
  Job,
  Customer,
  PriceBookItem,
  JobPhoto,
  SyncQueue,
  SyncConflict,
  UserSession,
  Product,
  VehicleStock,
  ReplenishmentRequest,
];

// ============================================================================
// Default export
// ============================================================================

export default database;
