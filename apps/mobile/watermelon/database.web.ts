/**
 * Web Database Mock
 * =================
 *
 * Mock implementation for web platform.
 * WatermelonDB uses native SQLite which doesn't work on web.
 * This provides a basic localStorage-based alternative.
 */

// Simple collection interface for web
class WebCollection<T = Record<string, unknown>> {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getStorageKey(): string {
    return `campotech_${this.tableName}`;
  }

  private getData(): T[] {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setData(data: T[]): void {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(data));
  }

  async query(): Promise<{ fetch: () => Promise<T[]> }> {
    return {
      fetch: async () => this.getData(),
    };
  }

  async find(id: string): Promise<T | null> {
    const data = this.getData();
    return data.find((item: T & { id?: string }) => item.id === id) || null;
  }

  async create(writer: (record: Partial<T>) => void): Promise<T> {
    const record: Partial<T> & { id: string } = {
      id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    writer(record);
    const data = this.getData();
    data.push(record as T);
    this.setData(data);
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

  async write<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  async read<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
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
