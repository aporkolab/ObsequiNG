import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface SecurityConfig {
  csp: {
    enabled: boolean;
    nonce?: string;
    reportUri?: string;
  };
  xss: {
    enabled: boolean;
    allowedTags: string[];
    allowedAttributes: string[];
  };
  csrf: {
    enabled: boolean;
    tokenHeaderName: string;
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  contentSecurityPolicy: string;
}

export interface SecurityThreat {
  id: string;
  type: 'xss' | 'csrf' | 'injection' | 'rate-limit' | 'suspicious-activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  source?: string;
  blocked: boolean;
}

export interface SecurityMetrics {
  totalThreats: number;
  blockedThreats: number;
  threatsByType: Record<string, number>;
  threatsBySeverity: Record<string, number>;
  lastThreatTime?: Date;
  securityScore: number; // 0-100
}

@Injectable({
  providedIn: 'root'
})
export class SecurityService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private threats: SecurityThreat[] = [];
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  
  private threatsSubject = new BehaviorSubject<SecurityThreat[]>([]);
  private metricsSubject = new BehaviorSubject<SecurityMetrics>(this.getInitialMetrics());
  
  public threats$ = this.threatsSubject.asObservable();
  public metrics$ = this.metricsSubject.asObservable();
  
  private config: SecurityConfig = {
    csp: {
      enabled: true,
      reportUri: '/api/csp-report'
    },
    xss: {
      enabled: true,
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      allowedAttributes: ['href', 'title', 'target']
    },
    csrf: {
      enabled: true,
      tokenHeaderName: 'X-CSRF-Token'
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 900000 // 15 minutes
    },
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https:; object-src 'none'; media-src 'self'; frame-src 'none';"
  };
  
  constructor() {
    this.initializeSecurity();
    this.setupEventListeners();
    this.startSecurityMonitoring();
  }
  
  // XSS Protection
  sanitizeHtml(html: string): string {
    if (!this.config.xss.enabled) {
      return html;
    }
    
    try {
      // Create a temporary DOM element
      const temp = document.createElement('div');
      temp.innerHTML = html;
      
      // Remove dangerous elements and attributes
      this.removeDangerousContent(temp);
      
      return temp.innerHTML;
    } catch (error) {
      this.logThreat({
        type: 'xss',
        severity: 'high',
        description: 'HTML sanitization failed',
        source: 'sanitizeHtml'
      });
      return ''; // Return empty string on error
    }
  }
  
  validateInput(input: string, type: 'email' | 'url' | 'text' | 'number' = 'text'): boolean {
    if (!input) return true;
    
    const patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
      text: /^[a-zA-Z0-9\s\-_.@#$%&*()+={}[\]|\\:";'<>?,./]+$/,
      number: /^[0-9.,-]+$/
    };
    
    const isValid = patterns[type]?.test(input) ?? true;
    
    if (!isValid) {
      this.logThreat({
        type: 'injection',
        severity: 'medium',
        description: `Invalid input detected for type: ${type}`,
        source: 'validateInput'
      });
    }
    
    return isValid;
  }
  
  detectXSSAttempt(input: string): boolean {
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
      /<embed[\s\S]*?>/gi,
      /<form[\s\S]*?>/gi,
      /vbscript:/gi,
      /data:text\/html/gi
    ];
    
    const isXSS = xssPatterns.some(pattern => pattern.test(input));
    
    if (isXSS) {
      this.logThreat({
        type: 'xss',
        severity: 'critical',
        description: 'XSS attempt detected in input',
        source: 'detectXSSAttempt'
      });
    }
    
    return isXSS;
  }
  
  // CSRF Protection
  generateCSRFToken(): string {
    const token = this.generateSecureToken(32);
    sessionStorage.setItem('csrf-token', token);
    return token;
  }
  
  validateCSRFToken(token: string): boolean {
    const storedToken = sessionStorage.getItem('csrf-token');
    const isValid = storedToken === token;
    
    if (!isValid) {
      this.logThreat({
        type: 'csrf',
        severity: 'high',
        description: 'CSRF token validation failed',
        source: 'validateCSRFToken'
      });
    }
    
    return isValid;
  }
  
  // Content Security Policy
  setupCSP(): void {
    if (!this.config.csp.enabled) return;
    
    const cspMeta = document.createElement('meta');
    cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    cspMeta.setAttribute('content', this.config.contentSecurityPolicy);
    document.head.appendChild(cspMeta);
    
    // Setup CSP violation reporting
    this.setupCSPReporting();
  }
  
  updateCSPNonce(nonce: string): void {
    this.config.csp.nonce = nonce;
    // Update all script and style tags with nonce
    document.querySelectorAll('script[nonce], style[nonce]').forEach(element => {
      element.setAttribute('nonce', nonce);
    });
  }
  
  // Rate Limiting
  checkRateLimit(identifier = 'default'): boolean {
    if (!this.config.rateLimit.enabled) return true;
    
    const now = Date.now();
    const limit = this.rateLimitMap.get(identifier);
    
    if (!limit || now > limit.resetTime) {
      // Reset or create new limit
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.rateLimit.windowMs
      });
      return true;
    }
    
    if (limit.count >= this.config.rateLimit.maxRequests) {
      this.logThreat({
        type: 'rate-limit',
        severity: 'medium',
        description: `Rate limit exceeded for identifier: ${identifier}`,
        source: 'checkRateLimit'
      });
      return false;
    }
    
    limit.count++;
    return true;
  }
  
  // Input Sanitization
  sanitizeForSQL(input: string): string {
    // Escape SQL injection patterns
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/g, '')
      .replace(/sp_/g, '');
  }
  
  sanitizeFilename(filename: string): string {
    // Remove dangerous characters from filenames
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  }
  
  validateFileUpload(file: File, allowedTypes: string[], maxSizeBytes: number): boolean {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      this.logThreat({
        type: 'injection',
        severity: 'medium',
        description: `Invalid file type: ${file.type}`,
        source: 'validateFileUpload'
      });
      return false;
    }
    
    // Check file size
    if (file.size > maxSizeBytes) {
      this.logThreat({
        type: 'suspicious-activity',
        severity: 'low',
        description: `File size exceeds limit: ${file.size}`,
        source: 'validateFileUpload'
      });
      return false;
    }
    
    // Check filename
    const safeName = this.sanitizeFilename(file.name);
    if (safeName !== file.name) {
      this.logThreat({
        type: 'injection',
        severity: 'medium',
        description: `Dangerous filename detected: ${file.name}`,
        source: 'validateFileUpload'
      });
      return false;
    }
    
    return true;
  }
  
  // Security Headers
  setSecurityHeaders(): void {
    // These would typically be set on the server, but we can enforce some client-side
    const headers = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    
    // Add meta tags for security headers that can be set client-side
    Object.entries(headers).forEach(([name, value]) => {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', name);
      meta.setAttribute('content', value);
      document.head.appendChild(meta);
    });
  }
  
  // Suspicious Activity Detection
  detectSuspiciousActivity(action: string, metadata?: any): boolean {
    const suspiciousPatterns = [
      /admin/i,
      /root/i,
      /password/i,
      /token/i,
      /api[_\-]?key/i,
      /secret/i,
      /\.\.\//
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(action));
    
    if (isSuspicious) {
      this.logThreat({
        type: 'suspicious-activity',
        severity: 'medium',
        description: `Suspicious activity detected: ${action}`,
        source: 'detectSuspiciousActivity'
      });
    }
    
    return isSuspicious;
  }
  
  // Security Audit
  performSecurityAudit(): SecurityMetrics {
    const metrics = this.calculateSecurityMetrics();
    
    // Check for common vulnerabilities
    this.auditDOMSecurity();
    this.auditLocalStorage();
    this.auditCookies();
    
    return metrics;
  }
  
  // Configuration
  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
  
  // Threat Management
  getThreats(filter?: { type?: string; severity?: string; timeRange?: { start: Date; end: Date } }): SecurityThreat[] {
    let filtered = [...this.threats];
    
    if (filter?.type) {
      filtered = filtered.filter(threat => threat.type === filter.type);
    }
    
    if (filter?.severity) {
      filtered = filtered.filter(threat => threat.severity === filter.severity);
    }
    
    if (filter?.timeRange) {
      filtered = filtered.filter(threat => 
        threat.timestamp >= filter.timeRange!.start && 
        threat.timestamp <= filter.timeRange!.end
      );
    }
    
    return filtered;
  }
  
  clearThreats(): void {
    this.threats = [];
    this.threatsSubject.next([]);
    this.updateMetrics();
  }
  
  // Private methods
  private initializeSecurity(): void {
    this.setupCSP();
    this.setSecurityHeaders();
    this.generateCSRFToken();
  }
  
  private setupEventListeners(): void {
    // Listen for potential security events
    window.addEventListener('error', (event) => {
      if (event.error?.name === 'SecurityError') {
        this.logThreat({
          type: 'suspicious-activity',
          severity: 'medium',
          description: `Security error: ${event.error.message}`,
          source: 'window.error'
        });
      }
    });
    
    // Monitor for suspicious DOM modifications
    if ('MutationObserver' in window) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.tagName === 'SCRIPT' || element.tagName === 'IFRAME') {
                  this.logThreat({
                    type: 'xss',
                    severity: 'high',
                    description: `Dynamic ${element.tagName} element added to DOM`,
                    source: 'MutationObserver'
                  });
                }
              }
            });
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  private setupCSPReporting(): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      this.logThreat({
        type: 'xss',
        severity: 'high',
        description: `CSP violation: ${event.violatedDirective} - ${event.sourceFile}`,
        source: 'CSPViolation'
      });
      
      // Report to server if configured
      if (this.config.csp.reportUri) {
        fetch(this.config.csp.reportUri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'csp-report': {
              'document-uri': event.documentURI,
              'violated-directive': event.violatedDirective,
              'blocked-uri': event.blockedURI,
              'source-file': event.sourceFile,
              'line-number': event.lineNumber,
              'column-number': event.columnNumber
            }
          })
        }).catch(console.error);
      }
    });
  }
  
  private startSecurityMonitoring(): void {
    setInterval(() => {
      this.performSecurityAudit();
    }, 60000); // Every minute
  }
  
  private removeDangerousContent(element: Element): void {
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta'];
    const dangerousAttributes = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
    
    // Remove dangerous tags
    dangerousTags.forEach(tag => {
      const elements = element.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });
    
    // Remove dangerous attributes
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      dangerousAttributes.forEach(attr => {
        if (el.hasAttribute(attr)) {
          el.removeAttribute(attr);
        }
      });
      
      // Remove href with javascript:
      if (el.hasAttribute('href') && el.getAttribute('href')?.startsWith('javascript:')) {
        el.removeAttribute('href');
      }
    });
  }
  
  private logThreat(threat: Omit<SecurityThreat, 'id' | 'timestamp' | 'blocked'>): void {
    const fullThreat: SecurityThreat = {
      ...threat,
      id: this.generateSecureToken(16),
      timestamp: new Date(),
      blocked: true
    };
    
    this.threats.push(fullThreat);
    this.threatsSubject.next([...this.threats]);
    this.updateMetrics();
    
    // Log to console in development
    if (this.isDevelopment()) {
      console.warn('Security Threat Detected:', fullThreat);
    }
  }
  
  private generateSecureToken(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => chars[byte % chars.length]).join('');
  }
  
  private auditDOMSecurity(): void {
    // Check for inline scripts
    const inlineScripts = document.querySelectorAll('script:not([src])');
    if (inlineScripts.length > 0) {
      this.logThreat({
        type: 'xss',
        severity: 'medium',
        description: `${inlineScripts.length} inline script(s) found`,
        source: 'auditDOMSecurity'
      });
    }
    
    // Check for external resources
    const externalResources = document.querySelectorAll('script[src], link[href], img[src]');
    externalResources.forEach(resource => {
      const src = resource.getAttribute('src') || resource.getAttribute('href');
      if (src && !src.startsWith('https://') && !src.startsWith('/') && !src.startsWith('./')) {
        this.logThreat({
          type: 'suspicious-activity',
          severity: 'low',
          description: `Non-HTTPS external resource: ${src}`,
          source: 'auditDOMSecurity'
        });
      }
    });
  }
  
  private auditLocalStorage(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('token') || key.includes('password') || key.includes('secret'))) {
          this.logThreat({
            type: 'suspicious-activity',
            severity: 'medium',
            description: `Sensitive data in localStorage: ${key}`,
            source: 'auditLocalStorage'
          });
        }
      }
    } catch (error) {
      // localStorage might not be available
    }
  }
  
  private auditCookies(): void {
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name && (name.includes('token') || name.includes('session') || name.includes('auth'))) {
        // Check if cookie is secure
        if (!cookie.includes('Secure') || !cookie.includes('HttpOnly')) {
          this.logThreat({
            type: 'suspicious-activity',
            severity: 'medium',
            description: `Insecure cookie configuration: ${name}`,
            source: 'auditCookies'
          });
        }
      }
    });
  }
  
  private calculateSecurityMetrics(): SecurityMetrics {
    const now = new Date();
    const recentThreats = this.threats.filter(threat => 
      (now.getTime() - threat.timestamp.getTime()) < 86400000 // 24 hours
    );
    
    const threatsByType: Record<string, number> = {};
    const threatsBySeverity: Record<string, number> = {};
    
    recentThreats.forEach(threat => {
      threatsByType[threat.type] = (threatsByType[threat.type] || 0) + 1;
      threatsBySeverity[threat.severity] = (threatsBySeverity[threat.severity] || 0) + 1;
    });
    
    const securityScore = this.calculateSecurityScore(recentThreats);
    
    return {
      totalThreats: recentThreats.length,
      blockedThreats: recentThreats.filter(t => t.blocked).length,
      threatsByType,
      threatsBySeverity,
      lastThreatTime: recentThreats.length > 0 ? recentThreats[recentThreats.length - 1].timestamp : undefined,
      securityScore
    };
  }
  
  private calculateSecurityScore(threats: SecurityThreat[]): number {
    let score = 100;
    
    threats.forEach(threat => {
      const penalty = {
        low: 1,
        medium: 3,
        high: 7,
        critical: 15
      }[threat.severity];
      
      score = Math.max(0, score - penalty);
    });
    
    return score;
  }
  
  private updateMetrics(): void {
    const metrics = this.calculateSecurityMetrics();
    this.metricsSubject.next(metrics);
  }
  
  private getInitialMetrics(): SecurityMetrics {
    return {
      totalThreats: 0,
      blockedThreats: 0,
      threatsByType: {},
      threatsBySeverity: {},
      securityScore: 100
    };
  }
  
  private isDevelopment(): boolean {
    return typeof environment === 'undefined' || !environment.production;
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Add environment import (this would normally be imported)
declare const environment: { production: boolean } | undefined;
