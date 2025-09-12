import { Injectable } from '@angular/core';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt?: string;
}

export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  iterations?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private readonly defaultOptions: EncryptionOptions = {
    algorithm: 'AES-GCM',
    keyLength: 256,
    iterations: 100000
  };

  // Generate a cryptographically secure random key
  async generateKey(options: EncryptionOptions = {}): Promise<CryptoKey> {
    const opts = { ...this.defaultOptions, ...options };
    
    return await window.crypto.subtle.generateKey(
      {
        name: opts.algorithm!,
        length: opts.keyLength!,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  // Derive a key from a password using PBKDF2
  async deriveKeyFromPassword(password: string, salt?: Uint8Array, options: EncryptionOptions = {}): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    const opts = { ...this.defaultOptions, ...options };
    const enc = new TextEncoder();
    
    // Generate salt if not provided
    if (!salt) {
      salt = window.crypto.getRandomValues(new Uint8Array(32));
    }

    // Import password as key material
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive key using PBKDF2
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: opts.iterations!,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: opts.algorithm!, length: opts.keyLength! },
      true,
      ['encrypt', 'decrypt']
    );

    return { key, salt };
  }

  // Encrypt data using AES-GCM
  async encrypt(data: string, key: CryptoKey, options: EncryptionOptions = {}): Promise<EncryptionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const enc = new TextEncoder();
    
    // Generate a random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    try {
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: opts.algorithm!,
          iv: iv,
        },
        key,
        enc.encode(data)
      );

      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  // Decrypt data using AES-GCM
  async decrypt(encryptedData: EncryptionResult, key: CryptoKey, options: EncryptionOptions = {}): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const dec = new TextDecoder();

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: opts.algorithm!,
          iv: this.base64ToArrayBuffer(encryptedData.iv),
        },
        key,
        this.base64ToArrayBuffer(encryptedData.encrypted)
      );

      return dec.decode(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  // Encrypt data with password (combines key derivation and encryption)
  async encryptWithPassword(data: string, password: string, options: EncryptionOptions = {}): Promise<EncryptionResult> {
    const { key, salt } = await this.deriveKeyFromPassword(password, undefined, options);
    const result = await this.encrypt(data, key, options);
    
    return {
      ...result,
      salt: this.arrayBufferToBase64(salt)
    };
  }

  // Decrypt data with password
  async decryptWithPassword(encryptedData: EncryptionResult, password: string, options: EncryptionOptions = {}): Promise<string> {
    if (!encryptedData.salt) {
      throw new Error('Salt is required for password-based decryption');
    }

    const salt = this.base64ToArrayBuffer(encryptedData.salt);
    const { key } = await this.deriveKeyFromPassword(password, new Uint8Array(salt), options);
    
    return await this.decrypt(encryptedData, key, options);
  }

  // Hash data using SHA-256
  async hash(data: string, algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'): Promise<string> {
    const enc = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest(algorithm, enc.encode(data));
    return this.arrayBufferToHex(hashBuffer);
  }

  // Generate HMAC for data integrity
  async generateHMAC(data: string, key: CryptoKey | string, algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'): Promise<string> {
    const enc = new TextEncoder();
    
    let hmacKey: CryptoKey;
    if (typeof key === 'string') {
      hmacKey = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(key),
        { name: 'HMAC', hash: algorithm },
        false,
        ['sign', 'verify']
      );
    } else {
      hmacKey = key;
    }

    const signature = await window.crypto.subtle.sign('HMAC', hmacKey, enc.encode(data));
    return this.arrayBufferToHex(signature);
  }

  // Verify HMAC
  async verifyHMAC(data: string, signature: string, key: CryptoKey | string, algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'): Promise<boolean> {
    const expectedSignature = await this.generateHMAC(data, key, algorithm);
    return this.constantTimeStringCompare(signature, expectedSignature);
  }

  // Generate secure random bytes
  generateRandomBytes(length: number): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }

  // Generate secure random string
  generateRandomString(length: number, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    const randomBytes = this.generateRandomBytes(length);
    return Array.from(randomBytes, byte => charset[byte % charset.length]).join('');
  }

  // Generate UUID v4
  generateUUID(): string {
    const randomBytes = this.generateRandomBytes(16);
    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Version 4
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Variant bits
    
    const hex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  // Secure storage helpers
  async encryptForStorage(data: any, password?: string): Promise<string> {
    const jsonData = JSON.stringify(data);
    
    if (password) {
      const encrypted = await this.encryptWithPassword(jsonData, password);
      return JSON.stringify(encrypted);
    } else {
      // Use a session-based key
      const key = await this.generateKey();
      const keyData = await window.crypto.subtle.exportKey('jwk', key);
      sessionStorage.setItem('temp-encryption-key', JSON.stringify(keyData));
      
      const encrypted = await this.encrypt(jsonData, key);
      return JSON.stringify(encrypted);
    }
  }

  async decryptFromStorage(encryptedData: string, password?: string): Promise<any> {
    const parsedData = JSON.parse(encryptedData);
    
    if (password) {
      const decrypted = await this.decryptWithPassword(parsedData, password);
      return JSON.parse(decrypted);
    } else {
      // Use session-based key
      const keyDataStr = sessionStorage.getItem('temp-encryption-key');
      if (!keyDataStr) {
        throw new Error('Encryption key not found in session');
      }
      
      const keyData = JSON.parse(keyDataStr);
      const key = await window.crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
      
      const decrypted = await this.decrypt(parsedData, key);
      return JSON.parse(decrypted);
    }
  }

  // Utility methods
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private constantTimeStringCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  // Check if Web Crypto API is supported
  isSupported(): boolean {
    return 'crypto' in window && 'subtle' in window.crypto && typeof window.crypto.subtle !== 'undefined';
  }

  // Get supported algorithms
  async getSupportedAlgorithms(): Promise<string[]> {
    const algorithms = ['AES-GCM', 'AES-CBC', 'RSA-OAEP'];
    const supported: string[] = [];

    for (const algorithm of algorithms) {
      try {
        const key = await window.crypto.subtle.generateKey(
          { name: algorithm, ...(algorithm.startsWith('AES') ? { length: 256 } : { modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }) },
          false,
          algorithm.startsWith('AES') ? ['encrypt', 'decrypt'] : ['encrypt', 'decrypt']
        );
        if (key) {
          supported.push(algorithm);
        }
      } catch (error) {
        // Algorithm not supported
      }
    }

    return supported;
  }
}
