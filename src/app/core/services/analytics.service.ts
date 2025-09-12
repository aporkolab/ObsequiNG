import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, fromEvent } from 'rxjs';
import { takeUntil, throttleTime, debounceTime } from 'rxjs/operators';

export interface UserEvent {
  id: string;
  type: 'page_view' | 'click' | 'form_submit' | 'error' | 'performance' | 'feature_use' | 'custom';
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
  source: string;
  device?: DeviceInfo;
  location?: GeolocationInfo;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenResolution: string;
  viewportSize: string;
  deviceMemory?: number;
  connectionType?: string;
  language: string;
  timezone: string;
  colorDepth: number;
  pixelRatio: number;
}

export interface GeolocationInfo {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
}

export interface PerformanceEvent {
  id: string;
  type: 'page_load' | 'api_call' | 'user_interaction' | 'error' | 'memory' | 'network';
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ConversionFunnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  totalUsers: number;
  completedUsers: number;
  conversionRate: number;
  avgCompletionTime: number;
  dropOffPoints: Record<string, number>;
}

export interface FunnelStep {
  id: string;
  name: string;
  description: string;
  order: number;
  completedUsers: number;
  completionRate: number;
}

export interface UserSegment {
  id: string;
  name: string;
  criteria: SegmentCriteria;
  userCount: number;
  avgSessionDuration: number;
  conversionRate: number;
  topFeatures: { name: string; usage: number }[];
}

export interface SegmentCriteria {
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  location?: string;
  userType?: 'new' | 'returning' | 'power_user';
  activityLevel?: 'low' | 'medium' | 'high';
  featureUsage?: Record<string, number>;
}

export interface AnalyticsConfig {
  enabled: boolean;
  trackingId?: string;
  sampleRate: number;
  enableUserTracking: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  enableHeatmaps: boolean;
  enableRecordings: boolean;
  privacyMode: boolean;
  dataRetentionDays: number;
  remoteEndpoint?: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  pageViews: number;
  uniquePageViews: number;
  conversionRate: number;
  topPages: { path: string; views: number; uniqueViews: number }[];
  topFeatures: { name: string; usage: number; trend: number }[];
  userFlow: { from: string; to: string; count: number }[];
  realTimeUsers: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private events: UserEvent[] = [];
  private performanceEvents: PerformanceEvent[] = [];
  private sessionId: string;
  private userId?: string;
  private pageLoadTime: number;
  
  private metricsSubject = new BehaviorSubject<DashboardMetrics>(this.getInitialMetrics());
  private eventsSubject = new Subject<UserEvent>();
  
  public metrics$ = this.metricsSubject.asObservable();
  public events$ = this.eventsSubject.asObservable();
  
  private config: AnalyticsConfig = {
    enabled: true,
    sampleRate: 1.0,
    enableUserTracking: true,
    enablePerformanceTracking: true,
    enableErrorTracking: true,
    enableHeatmaps: false,
    enableRecordings: false,
    privacyMode: false,
    dataRetentionDays: 90,
  };
  
  constructor() {
    this.sessionId = this.generateSessionId();
    this.pageLoadTime = performance.now();
    this.initializeTracking();
    this.setupEventListeners();
    this.startPerformanceMonitoring();
  }
  
  // Event Tracking
  trackEvent(
    category: string, 
    action: string, 
    label?: string, 
    value?: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enabled || !this.shouldSample()) return;
    
    const event: UserEvent = {
      id: this.generateId(),
      type: 'custom',
      category,
      action,
      label,
      value,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      metadata,
      source: 'user',
      device: this.getDeviceInfo()
    };
    
    this.recordEvent(event);
  }
  
  trackPageView(path: string, title?: string): void {
    if (!this.config.enabled) return;
    
    const event: UserEvent = {
      id: this.generateId(),
      type: 'page_view',
      category: 'navigation',
      action: 'page_view',
      label: path,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      metadata: { title, referrer: document.referrer },
      source: 'router',
      device: this.getDeviceInfo()
    };
    
    this.recordEvent(event);
  }
  
  trackFeatureUsage(featureName: string, context?: string, metadata?: any): void {
    this.trackEvent('feature', 'use', featureName, 1, { context, ...metadata });
  }
  
  trackError(error: Error, context?: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    if (!this.config.enableErrorTracking) return;
    
    const event: UserEvent = {
      id: this.generateId(),
      type: 'error',
      category: 'error',
      action: 'exception',
      label: error.name,
      timestamp: new Date(),
      userId: this.userId,
      sessionId: this.sessionId,
      metadata: {
        message: error.message,
        stack: error.stack,
        context,
        severity,
        url: window.location.href
      },
      source: 'error_handler',
      device: this.getDeviceInfo()
    };
    
    this.recordEvent(event);
  }
  
  trackPerformance(name: string, startTime: number, endTime: number, metadata?: any): void {
    if (!this.config.enablePerformanceTracking) return;
    
    const perfEvent: PerformanceEvent = {
      id: this.generateId(),
      type: 'user_interaction',
      name,
      startTime,
      duration: endTime - startTime,
      metadata,
      timestamp: new Date()
    };
    
    this.performanceEvents.push(perfEvent);
    this.updateMetrics();
  }
  
  // User Identification
  identifyUser(userId: string, traits?: Record<string, any>): void {
    this.userId = userId;
    
    this.trackEvent('user', 'identify', userId, undefined, traits);
    
    // Store in localStorage for session persistence
    if (!this.config.privacyMode) {
      localStorage.setItem('analytics_user_id', userId);
      if (traits) {
        localStorage.setItem('analytics_user_traits', JSON.stringify(traits));
      }
    }
  }
  
  // Conversion Tracking
  trackConversion(goalName: string, value?: number, metadata?: any): void {
    this.trackEvent('conversion', 'complete', goalName, value, metadata);
  }
  
  // A/B Testing Support
  trackExperiment(experimentId: string, variant: string, converted = false): void {
    this.trackEvent('experiment', converted ? 'convert' : 'view', experimentId, converted ? 1 : 0, {
      variant,
      experimentId
    });
  }
  
  // Funnel Analysis
  trackFunnelStep(funnelName: string, stepName: string, stepOrder: number): void {
    this.trackEvent('funnel', 'step_complete', funnelName, stepOrder, {
      stepName,
      stepOrder,
      funnelName
    });
  }
  
  // Cohort Analysis
  getCohortAnalysis(cohortType: 'daily' | 'weekly' | 'monthly' = 'weekly'): any {
    // This would typically query a backend service
    // For now, return mock data
    return {
      cohortType,
      cohorts: [
        { period: '2024-01', users: 1000, retention: [100, 85, 70, 60, 55] },
        { period: '2024-02', users: 1200, retention: [100, 88, 75, 65, 58] }
      ]
    };
  }
  
  // Real-time Analytics
  getRealTimeMetrics(): DashboardMetrics {
    return this.metricsSubject.value;
  }
  
  // User Segments
  getUserSegments(): UserSegment[] {
    // Mock data - in production this would come from analytics backend
    return [
      {
        id: 'power_users',
        name: 'Power Users',
        criteria: { activityLevel: 'high', userType: 'returning' },
        userCount: 1250,
        avgSessionDuration: 1800000, // 30 minutes
        conversionRate: 0.15,
        topFeatures: [
          { name: 'Security Dashboard', usage: 95 },
          { name: 'Testing Tools', usage: 88 },
          { name: 'Performance Analytics', usage: 82 }
        ]
      },
      {
        id: 'mobile_users',
        name: 'Mobile Users',
        criteria: { deviceType: 'mobile' },
        userCount: 3200,
        avgSessionDuration: 900000, // 15 minutes
        conversionRate: 0.08,
        topFeatures: [
          { name: 'PWA Install', usage: 78 },
          { name: 'Push Notifications', usage: 65 },
          { name: 'Offline Mode', usage: 72 }
        ]
      }
    ];
  }
  
  // Conversion Funnels
  getConversionFunnels(): ConversionFunnel[] {
    return [
      {
        id: 'user_onboarding',
        name: 'User Onboarding',
        totalUsers: 5000,
        completedUsers: 3250,
        conversionRate: 0.65,
        avgCompletionTime: 600000, // 10 minutes
        dropOffPoints: { 'step2': 0.15, 'step3': 0.12, 'step4': 0.08 },
        steps: [
          { id: 'step1', name: 'Landing Page', description: 'User visits home page', order: 1, completedUsers: 5000, completionRate: 1.0 },
          { id: 'step2', name: 'Feature Exploration', description: 'User explores features', order: 2, completedUsers: 4250, completionRate: 0.85 },
          { id: 'step3', name: 'Dashboard Access', description: 'User accesses dashboard', order: 3, completedUsers: 3740, completionRate: 0.88 },
          { id: 'step4', name: 'Feature Usage', description: 'User uses core features', order: 4, completedUsers: 3250, completionRate: 0.87 }
        ]
      }
    ];
  }
  
  // Export Analytics Data
  exportData(format: 'json' | 'csv' = 'json', dateRange?: { start: Date; end: Date }): any {
    let filteredEvents = this.events;
    
    if (dateRange) {
      filteredEvents = this.events.filter(event => 
        event.timestamp >= dateRange.start && event.timestamp <= dateRange.end
      );
    }
    
    if (format === 'csv') {
      return this.convertToCSV(filteredEvents);
    }
    
    return {
      events: filteredEvents,
      performance: this.performanceEvents,
      metrics: this.metricsSubject.value,
      exportDate: new Date(),
      config: this.config
    };
  }
  
  // Privacy Controls
  enablePrivacyMode(): void {
    this.config.privacyMode = true;
    this.userId = undefined;
    localStorage.removeItem('analytics_user_id');
    localStorage.removeItem('analytics_user_traits');
  }
  
  optOutOfTracking(): void {
    this.config.enabled = false;
    localStorage.setItem('analytics_opt_out', 'true');
  }
  
  optInToTracking(): void {
    this.config.enabled = true;
    localStorage.removeItem('analytics_opt_out');
  }
  
  // Configuration
  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }
  
  // Data Management
  clearData(): void {
    this.events = [];
    this.performanceEvents = [];
    this.updateMetrics();
  }
  
  getEventHistory(limit = 100): UserEvent[] {
    return this.events.slice(-limit);
  }
  
  // Private Methods
  private initializeTracking(): void {
    // Check for opt-out
    if (localStorage.getItem('analytics_opt_out') === 'true') {
      this.config.enabled = false;
      return;
    }
    
    // Restore user ID if available
    if (!this.config.privacyMode) {
      const storedUserId = localStorage.getItem('analytics_user_id');
      if (storedUserId) {
        this.userId = storedUserId;
      }
    }
    
    // Track initial page view
    this.trackPageView(window.location.pathname, document.title);
  }
  
  private setupEventListeners(): void {
    if (!this.config.enabled) return;
    
    // Click tracking
    fromEvent(document, 'click')
      .pipe(
        takeUntil(this.destroy$),
        throttleTime(100)
      )
      .subscribe((event: Event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.tagName === 'A') {
          this.trackEvent('ui', 'click', target.textContent || target.tagName.toLowerCase());
        }
      });
    
    // Form submissions
    fromEvent(document, 'submit')
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: Event) => {
        const form = event.target as HTMLFormElement;
        this.trackEvent('form', 'submit', form.name || 'unnamed_form');
      });
    
    // Page visibility changes
    fromEvent(document, 'visibilitychange')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.trackEvent('engagement', document.hidden ? 'page_hide' : 'page_show');
      });
    
    // Scroll depth tracking
    fromEvent(window, 'scroll')
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500)
      )
      .subscribe(() => {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        if (scrollPercent % 25 === 0 && scrollPercent > 0) {
          this.trackEvent('engagement', 'scroll', `${scrollPercent}%`, scrollPercent);
        }
      });
  }
  
  private startPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceTracking) return;
    
    // Monitor page load performance
    window.addEventListener('load', () => {
      if (performance.navigation && performance.timing) {
        const timing = performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        
        this.trackPerformance('page_load', timing.navigationStart, timing.loadEventEnd, {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstByte: timing.responseStart - timing.navigationStart,
          domInteractive: timing.domInteractive - timing.navigationStart
        });
      }
    });
    
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.trackPerformance('long_task', entry.startTime, entry.startTime + entry.duration, {
                taskType: entry.name,
                duration: entry.duration
              });
            }
          });
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.debug('Long task monitoring not supported');
      }
    }
  }
  
  private recordEvent(event: UserEvent): void {
    this.events.push(event);
    this.eventsSubject.next(event);
    this.updateMetrics();
    
    // Send to remote endpoint if configured
    if (this.config.remoteEndpoint) {
      this.sendToRemote(event);
    }
    
    // Maintain data retention
    this.cleanupOldData();
  }
  
  private async sendToRemote(event: UserEvent): Promise<void> {
    try {
      await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.debug('Failed to send analytics event:', error);
    }
  }
  
  private cleanupOldData(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.dataRetentionDays);
    
    this.events = this.events.filter(event => event.timestamp > cutoffDate);
    this.performanceEvents = this.performanceEvents.filter(event => event.timestamp > cutoffDate);
  }
  
  private updateMetrics(): void {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentEvents = this.events.filter(event => event.timestamp > last24Hours);
    const pageViews = recentEvents.filter(event => event.type === 'page_view');
    
    const metrics: DashboardMetrics = {
      totalUsers: new Set(this.events.map(e => e.userId).filter(Boolean)).size,
      activeUsers: new Set(recentEvents.map(e => e.userId).filter(Boolean)).size,
      newUsers: 0, // Would be calculated based on first-seen dates
      sessions: new Set(recentEvents.map(e => e.sessionId)).size,
      avgSessionDuration: 1800000, // Mock: 30 minutes
      bounceRate: 0.35, // Mock
      pageViews: pageViews.length,
      uniquePageViews: new Set(pageViews.map(e => e.label)).size,
      conversionRate: 0.12, // Mock
      topPages: this.getTopPages(pageViews),
      topFeatures: this.getTopFeatures(recentEvents),
      userFlow: [], // Mock
      realTimeUsers: Math.floor(Math.random() * 50) + 10
    };
    
    this.metricsSubject.next(metrics);
  }
  
  private getTopPages(pageViews: UserEvent[]): { path: string; views: number; uniqueViews: number }[] {
    const pageStats = new Map<string, { views: number; uniqueViews: Set<string> }>();
    
    pageViews.forEach(event => {
      const path = event.label || '/';
      if (!pageStats.has(path)) {
        pageStats.set(path, { views: 0, uniqueViews: new Set() });
      }
      
      const stats = pageStats.get(path)!;
      stats.views++;
      if (event.sessionId) {
        stats.uniqueViews.add(event.sessionId);
      }
    });
    
    return Array.from(pageStats.entries())
      .map(([path, stats]) => ({
        path,
        views: stats.views,
        uniqueViews: stats.uniqueViews.size
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }
  
  private getTopFeatures(events: UserEvent[]): { name: string; usage: number; trend: number }[] {
    const featureEvents = events.filter(event => event.category === 'feature');
    const featureStats = new Map<string, number>();
    
    featureEvents.forEach(event => {
      const feature = event.label || event.action;
      featureStats.set(feature, (featureStats.get(feature) || 0) + 1);
    });
    
    return Array.from(featureStats.entries())
      .map(([name, usage]) => ({
        name,
        usage,
        trend: Math.floor(Math.random() * 20) - 10 // Mock trend
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);
  }
  
  private getInitialMetrics(): DashboardMetrics {
    return {
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      sessions: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      pageViews: 0,
      uniquePageViews: 0,
      conversionRate: 0,
      topPages: [],
      topFeatures: [],
      userFlow: [],
      realTimeUsers: 0
    };
  }
  
  private getDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      deviceMemory: (navigator as any).deviceMemory,
      connectionType: (navigator as any).connection?.effectiveType,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio
    };
  }
  
  private shouldSample(): boolean {
    return Math.random() <= this.config.sampleRate;
  }
  
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  private convertToCSV(events: UserEvent[]): string {
    if (events.length === 0) return '';
    
    const headers = ['id', 'type', 'category', 'action', 'label', 'value', 'timestamp', 'userId', 'sessionId'];
    const csvContent = [
      headers.join(','),
      ...events.map(event => [
        event.id,
        event.type,
        event.category,
        event.action,
        event.label || '',
        event.value || '',
        event.timestamp.toISOString(),
        event.userId || '',
        event.sessionId
      ].join(','))
    ].join('\n');
    
    return csvContent;
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
