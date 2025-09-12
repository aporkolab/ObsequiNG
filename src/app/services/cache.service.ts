import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  expiration: number;
  accessCount: number;
  lastAccessed: number;
  metadata: {
    size: number;
    type: string;
    version: string;
  };
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private db: IDBDatabase | null = null;
  private memoryCache = new Map<string, CacheEntry>();
  private readonly DB_NAME = 'cadentis-cache';
  private readonly DB_VERSION = 1;
  private readonly OBJECT_STORE_NAME = 'analysis-cache';
  private readonly MAX_MEMORY_CACHE_SIZE = 50; // MB
  private readonly DEFAULT_TTL = 1000 * 60 * 60 * 24; // 24 hours

  private statsSubject = new BehaviorSubject<CacheStats>({
    totalEntries: 0,
    totalSize: 0,
    hitRate: 0,
    memoryUsage: 0,
    oldestEntry: 0,
    newestEntry: 0
  });

  private hitCount = 0;
  private missCount = 0;

  public stats$ = this.statsSubject.asObservable();

  constructor() {
    this.initializeIndexedDB();
    this.startCleanupScheduler();
  }

  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        // IndexedDB initialization failed - fallback to memory-only cache
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.loadMemoryCache();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.OBJECT_STORE_NAME)) {
          const objectStore = db.createObjectStore(this.OBJECT_STORE_NAME, { keyPath: 'key' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('expiration', 'expiration', { unique: false });
          objectStore.createIndex('type', 'metadata.type', { unique: false });
        }
      };
    });
  }

  private async loadMemoryCache(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.OBJECT_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const entries: CacheEntry[] = request.result;
        const now = Date.now();

        // Load recent, frequently accessed entries into memory cache
        entries
          .filter(entry => entry.expiration > now)
          .sort((a, b) => (b.accessCount * b.lastAccessed) - (a.accessCount * a.lastAccessed))
          .slice(0, 20) // Top 20 entries
          .forEach(entry => {
            this.memoryCache.set(entry.key, entry);
          });

        this.updateStats();
      };
    } catch (error) {
      // Failed to load memory cache - continue with empty cache
    }
  }

  private startCleanupScheduler(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanup();
    }, 1000 * 60 * 60);

    // Initial cleanup after 5 seconds
    setTimeout(() => {
      this.cleanup();
    }, 5000);
  }

  public async set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL, type = 'analysis'): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: now,
      expiration: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      metadata: {
        size: this.calculateSize(data),
        type,
        version: '1.0'
      }
    };

    // Store in memory cache if small enough
    if (entry.metadata.size < 1024 * 1024) { // < 1MB
      this.memoryCache.set(key, entry);
      this.enforceMemoryLimit();
    }

    // Store in IndexedDB
    await this.setInIndexedDB(entry);
    this.updateStats();
  }

  public async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // Try memory cache first
    let entry = this.memoryCache.get(key);
    
    if (entry && entry.expiration > now) {
      entry.accessCount++;
      entry.lastAccessed = now;
      this.hitCount++;
      return entry.data as T;
    }

    // Try IndexedDB
    const dbEntry = await this.getFromIndexedDB(key);
    entry = dbEntry ?? undefined;
    
    if (entry && entry.expiration > now) {
      entry.accessCount++;
      entry.lastAccessed = now;
      
      // Promote to memory cache if accessed frequently
      if (entry.accessCount > 2 && entry.metadata.size < 1024 * 1024) {
        this.memoryCache.set(key, entry);
        this.enforceMemoryLimit();
      }

      await this.setInIndexedDB(entry); // Update access stats
      this.hitCount++;
      return entry.data as T;
    }

    this.missCount++;
    return null;
  }

  public async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  public async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.deleteFromIndexedDB(key);
    this.updateStats();
  }

  public async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.clearIndexedDB();
    this.hitCount = 0;
    this.missCount = 0;
    this.updateStats();
  }

  public async cleanup(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiration <= now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Clean IndexedDB
    await this.cleanupIndexedDB();
    this.updateStats();
  }

  private async setInIndexedDB<T>(entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.OBJECT_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
      const request = objectStore.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async getFromIndexedDB(key: string): Promise<CacheEntry | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.OBJECT_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
      const request = objectStore.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.OBJECT_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
      const request = objectStore.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async clearIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.OBJECT_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
      const request = objectStore.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async cleanupIndexedDB(): Promise<void> {
    if (!this.db) return;

    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.OBJECT_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
      const index = objectStore.index('expiration');
      
      // Get all expired entries
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }

  private enforceMemoryLimit(): void {
    const currentSize = this.calculateMemoryUsage();
    const maxSize = this.MAX_MEMORY_CACHE_SIZE * 1024 * 1024; // Convert to bytes

    if (currentSize > maxSize) {
      const entries = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed); // Least recently used first

      while (this.calculateMemoryUsage() > maxSize && entries.length > 0) {
        const [key] = entries.shift()!;
        this.memoryCache.delete(key);
      }
    }
  }

  private calculateMemoryUsage(): number {
    return Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.metadata.size, 0);
  }

  private calculateSize(data: unknown): number {
    try {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    } catch {
      return JSON.stringify(data).length * 2; // Rough estimate
    }
  }

  private async updateStats(): Promise<void> {
    const memoryEntries = Array.from(this.memoryCache.values());
    let dbEntries: CacheEntry[] = [];

    try {
      if (this.db) {
        dbEntries = await new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([this.OBJECT_STORE_NAME], 'readonly');
          const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
          const request = objectStore.getAll();

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
      }
    } catch (error) {
      console.warn('Failed to get DB entries for stats:', error);
    }

    const allEntries = [...memoryEntries, ...dbEntries.filter(db => !memoryEntries.find(mem => mem.key === db.key))];
    const totalRequests = this.hitCount + this.missCount;

    const stats: CacheStats = {
      totalEntries: allEntries.length,
      totalSize: allEntries.reduce((total, entry) => total + entry.metadata.size, 0),
      hitRate: totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0,
      memoryUsage: this.calculateMemoryUsage(),
      oldestEntry: allEntries.length > 0 ? Math.min(...allEntries.map(e => e.timestamp)) : 0,
      newestEntry: allEntries.length > 0 ? Math.max(...allEntries.map(e => e.timestamp)) : 0
    };

    this.statsSubject.next(stats);
  }

  public async exportCache(): Promise<string> {
    const memoryEntries = Array.from(this.memoryCache.values());
    let dbEntries: CacheEntry[] = [];

    try {
      if (this.db) {
        dbEntries = await new Promise((resolve, reject) => {
          const transaction = this.db!.transaction([this.OBJECT_STORE_NAME], 'readonly');
          const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
          const request = objectStore.getAll();

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
      }
    } catch (error) {
      console.warn('Failed to export cache:', error);
    }

    return JSON.stringify({
      memoryEntries,
      dbEntries,
      stats: this.statsSubject.value,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  public generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}:${this.hashString(parts.join(''))}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}
