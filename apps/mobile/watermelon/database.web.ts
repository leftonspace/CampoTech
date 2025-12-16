/**
 * Web Database Mock
 * =================
 *
 * Mock implementation for web platform.
 * WatermelonDB uses native SQLite which doesn't work on web.
 * This provides a basic localStorage-based alternative with
 * a compatible API surface.
 */

// Observable mock for reactive queries
class MockObservable<T> {
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  subscribe(callback: (value: T) => void) {
    // Call immediately with current value
    callback(this.value);
    // Return unsubscribe function
    return {
      unsubscribe: () => {},
    };
  }

  pipe() {
    return this;
  }
}

// Query builder mock
class WebQuery<T> {
  private collection: WebCollection<T>;
  private filters: Array<(item: T) => boolean> = [];

  constructor(collection: WebCollection<T>) {
    this.collection = collection;
  }

  extend(...conditions: unknown[]): WebQuery<T> {
    // Mock query conditions - in real implementation would filter
    return this;
  }

  async fetch(): Promise<T[]> {
    const data = this.collection.getData();
    return this.filters.length > 0
      ? data.filter((item) => this.filters.every((f) => f(item)))
      : data;
  }

  async fetchCount(): Promise<number> {
    const data = await this.fetch();
    return data.length;
  }

  observe(): MockObservable<T[]> {
    return new MockObservable(this.collection.getData());
  }

  observeCount(): MockObservable<number> {
    return new MockObservable(this.collection.getData().length);
  }
}

// Simple collection interface for web
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
    } catch {
      // Ignore storage errors
    }
  }

  query(...conditions: unknown[]): WebQuery<T> {
    return new WebQuery<T>(this);
  }

  async find(id: string): Promise<T | null> {
    const data = this.getData();
    return data.find((item: T & { id?: string }) => item.id === id) || null;
  }

  async create(writer: (record: Partial<T>) => void): Promise<T> {
    const record: Partial<T> & { id: string; _status: string; _changed: string } = {
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

  // Alias for prepareCreate used in some patterns
  prepareCreate(writer: (record: Partial<T>) => void): T {
    const record: Partial<T> & { id: string; _status: string; _changed: string } = {
      id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _status: 'created',
      _changed: '',
    };
    writer(record);
    return record as T;
  }
}

// Mock database class
class WebDatabase {
  private collections: Map<string, WebCollection> = new Map();

  get<T>(tableName: string): WebCollection<T> {
    if (!this.collections.has(tableName)) {
      this.collections.set(tableName, new WebCollection<T>(tableName));
    }
    return this.collections.get(tableName) as WebCollection<T>;
  }

  // Batch operations
  async write<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  async read<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  batch(...records: unknown[]): Promise<void> {
    // Mock batch - records are already prepared
    return Promise.resolve();
  }

  // For compatibility with WatermelonDB patterns
  get collections() {
    return {
      get: <T>(tableName: string) => this.get<T>(tableName),
    };
  }
}

// Create and export web database instance
export const database = new WebDatabase();

// Export mock collections
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

export default database;
