import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse } from '@angular/common/http';

interface CacheEntry {
  url: string;
  response: HttpResponse<any>;
  timestamp: number;
  expirationTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class HttpCacheService {
  private cache = new Map<string, CacheEntry>();
  private defaultTtl = 5 * 60 * 1000; // 5 minutes default TTL

  get(req: HttpRequest<any>): HttpResponse<any> | null {
    const key = this.generateKey(req);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() > cached.expirationTime) {
      this.cache.delete(key);
      return null;
    }

    return cached.response;
  }

  put(req: HttpRequest<any>, response: HttpResponse<any>, ttl?: number): void {
    const key = this.generateKey(req);
    const expirationTime = Date.now() + (ttl || this.defaultTtl);

    const entry: CacheEntry = {
      url: req.urlWithParams,
      response: response.clone(),
      timestamp: Date.now(),
      expirationTime
    };

    this.cache.set(key, entry);

    // Cleanup expired entries periodically
    this.cleanupExpiredEntries();
  }

  clear(): void {
    this.cache.clear();
  }

  delete(req: HttpRequest<any>): boolean {
    const key = this.generateKey(req);
    return this.cache.delete(key);
  }

  has(req: HttpRequest<any>): boolean {
    const key = this.generateKey(req);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return false;
    }

    // Check if still valid
    if (Date.now() > cached.expirationTime) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  getSize(): number {
    return this.cache.size;
  }

  getStats(): { size: number; entries: { url: string; age: number; expiresIn: number }[] } {
    const now = Date.now();
    const entries = Array.from(this.cache.values()).map(entry => ({
      url: entry.url,
      age: now - entry.timestamp,
      expiresIn: Math.max(0, entry.expirationTime - now)
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  private generateKey(req: HttpRequest<any>): string {
    // Generate cache key based on method, URL, and relevant headers
    const keyParts = [
      req.method,
      req.urlWithParams,
      req.headers.get('Accept') || '',
      req.headers.get('Authorization') || ''
    ];

    return btoa(keyParts.join('|'));
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expirationTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    // Limit cache size to prevent memory issues
    const maxCacheSize = 100;
    if (this.cache.size > maxCacheSize) {
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      );

      const toDelete = entries.slice(0, this.cache.size - maxCacheSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }
}
