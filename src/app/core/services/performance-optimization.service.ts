import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, fromEvent, interval, Observable } from 'rxjs';
import { throttleTime, map, filter, startWith } from 'rxjs/operators';

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  
  // Custom metrics
  memoryUsage?: number;
  jsHeapSize?: number;
  domNodeCount: number;
  renderTime: number;
  scriptExecutionTime: number;
  networkConnections: number;
  cacheHitRatio: number;
  
  // User experience
  scrollPerformance: number;
  clickResponsiveness: number;
  
  timestamp: number;
}

export interface VirtualScrollConfig {
  itemHeight: number;
  bufferSize: number;
  overscan: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceOptimizationService implements OnDestroy {
  private metrics = new BehaviorSubject<PerformanceMetrics>({
    domNodeCount: 0,
    renderTime: 0,
    scriptExecutionTime: 0,
    networkConnections: 0,
    cacheHitRatio: 1,
    scrollPerformance: 1,
    clickResponsiveness: 1,
    timestamp: Date.now()
  });

  private performanceObserver?: PerformanceObserver;
  private intersectionObservers = new Map<string, IntersectionObserver>();
  private animationFrameId?: number;
  
  public metrics$ = this.metrics.asObservable();

  constructor(private ngZone: NgZone) {
    this.initializePerformanceMonitoring();
  }

  // Core Web Vitals measurement
  measureCoreWebVitals(): Observable<PerformanceMetrics> {
    return new Observable(subscriber => {
      if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const currentMetrics = this.metrics.value;
          
          entries.forEach(entry => {
            if (entry.entryType === 'paint') {
              if (entry.name === 'first-contentful-paint') {
                currentMetrics.fcp = entry.startTime;
              }
            } else if (entry.entryType === 'largest-contentful-paint') {
              currentMetrics.lcp = entry.startTime;
            } else if (entry.entryType === 'first-input') {
              currentMetrics.fid = entry.processingStart - entry.startTime;
            } else if (entry.entryType === 'layout-shift') {
              if (!(entry as any).hadRecentInput) {
                currentMetrics.cls = (currentMetrics.cls || 0) + (entry as any).value;
              }
            }
          });
          
          this.updateMetrics(currentMetrics);
          subscriber.next(currentMetrics);
        });
        
        try {
          observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
        } catch (error) {
          console.warn('PerformanceObserver not supported for some entry types');
        }
      }
    });
  }

  // Virtual scrolling implementation
  createVirtualScrolling<T>(
    items: T[], 
    container: HTMLElement, 
    renderItem: (item: T, index: number) => HTMLElement,
    config: VirtualScrollConfig = { itemHeight: 50, bufferSize: 5, overscan: 3 }
  ): {
    update: () => void;
    scrollTo: (index: number) => void;
    destroy: () => void;
  } {
    let startIndex = 0;
    let endIndex = 0;
    let scrollTop = 0;
    
    const viewport = document.createElement('div');
    viewport.style.height = '100%';
    viewport.style.overflow = 'auto';
    
    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.height = `${items.length * config.itemHeight}px`;
    
    viewport.appendChild(content);
    container.appendChild(viewport);
    
    const visibleItems = new Map<number, HTMLElement>();
    
    const update = () => {
      const containerHeight = viewport.clientHeight;
      const visibleStart = Math.floor(scrollTop / config.itemHeight);
      const visibleEnd = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / config.itemHeight)
      );
      
      const newStartIndex = Math.max(0, visibleStart - config.overscan);
      const newEndIndex = Math.min(items.length - 1, visibleEnd + config.overscan);
      
      // Remove items that are no longer visible
      for (let i = startIndex; i < newStartIndex; i++) {
        const element = visibleItems.get(i);
        if (element) {
          content.removeChild(element);
          visibleItems.delete(i);
        }
      }
      
      for (let i = newEndIndex + 1; i <= endIndex; i++) {
        const element = visibleItems.get(i);
        if (element) {
          content.removeChild(element);
          visibleItems.delete(i);
        }
      }
      
      // Add new visible items
      for (let i = newStartIndex; i <= newEndIndex; i++) {
        if (!visibleItems.has(i)) {
          const element = renderItem(items[i], i);
          element.style.position = 'absolute';
          element.style.top = `${i * config.itemHeight}px`;
          element.style.height = `${config.itemHeight}px`;
          content.appendChild(element);
          visibleItems.set(i, element);
        }
      }
      
      startIndex = newStartIndex;
      endIndex = newEndIndex;
    };
    
    const scrollHandler = () => {
      scrollTop = viewport.scrollTop;
      requestAnimationFrame(update);
    };
    
    viewport.addEventListener('scroll', scrollHandler, { passive: true });
    
    // Initial render
    update();
    
    return {
      update,
      scrollTo: (index: number) => {
        viewport.scrollTop = index * config.itemHeight;
      },
      destroy: () => {
        viewport.removeEventListener('scroll', scrollHandler);
        container.removeChild(viewport);
      }
    };
  }

  // Lazy loading for images
  setupLazyLoading(images?: NodeListOf<HTMLImageElement>): IntersectionObserver {
    const imageElements = images || document.querySelectorAll('img[data-src]');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset['src'];
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.1
    });
    
    imageElements.forEach(img => observer.observe(img));
    return observer;
  }

  // Memory usage monitoring
  monitorMemoryUsage(): Observable<number> {
    return interval(5000).pipe(
      map(() => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          return {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit
          };
        }
        return null;
      }),
      filter(memory => memory !== null),
      map(memory => memory!.used / memory!.total)
    );
  }

  // Debounce expensive operations
  debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number, 
    immediate = false
  ): (...args: Parameters<T>) => void {
    let timeout: number | undefined;
    
    return (...args: Parameters<T>) => {
      const later = () => {
        timeout = undefined;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = window.setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  }

  // Throttle scroll/resize events
  throttleEvent<T extends Event>(
    element: HTMLElement, 
    eventType: string, 
    handler: (event: T) => void, 
    delay = 16
  ): () => void {
    let ticking = false;
    
    const throttledHandler = (event: T) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handler(event);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    element.addEventListener(eventType, throttledHandler as EventListener);
    
    return () => {
      element.removeEventListener(eventType, throttledHandler as EventListener);
    };
  }

  // Code splitting helper
  async loadModule<T>(moduleLoader: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    try {
      const module = await moduleLoader();
      const loadTime = performance.now() - startTime;
      
      console.log(`Module loaded in ${loadTime.toFixed(2)}ms`);
      return module;
    } catch (error) {
      console.error('Failed to load module:', error);
      throw error;
    }
  }

  // Bundle optimization analysis
  analyzeBundleSize(): { 
    totalScripts: number; 
    totalSize: number; 
    largestScripts: { name: string; size: number }[] 
  } {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const analysis = {
      totalScripts: scripts.length,
      totalSize: 0,
      largestScripts: [] as { name: string; size: number }[]
    };
    
    // This would need actual network timing data
    // Simplified implementation
    return analysis;
  }

  // Performance recommendations
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics.value;
    
    if (metrics.lcp && metrics.lcp > 2500) {
      recommendations.push('LCP is slower than recommended (>2.5s). Consider optimizing images and reducing server response times.');
    }
    
    if (metrics.fid && metrics.fid > 100) {
      recommendations.push('FID is higher than recommended (>100ms). Consider breaking up long JavaScript tasks.');
    }
    
    if (metrics.cls && metrics.cls > 0.1) {
      recommendations.push('CLS is higher than recommended (>0.1). Add size attributes to images and avoid inserting content above existing content.');
    }
    
    if (metrics.domNodeCount > 1500) {
      recommendations.push('DOM node count is high. Consider using virtual scrolling for large lists.');
    }
    
    if (metrics.memoryUsage && metrics.memoryUsage > 0.8) {
      recommendations.push('High memory usage detected. Check for memory leaks and optimize data structures.');
    }
    
    return recommendations;
  }

  // Critical resource hints
  addResourceHints(resources: { href: string; as: string; type?: string }[]): void {
    resources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      if (resource.type) {
        link.type = resource.type;
      }
      document.head.appendChild(link);
    });
  }

  private initializePerformanceMonitoring(): void {
    // Start monitoring immediately
    this.ngZone.runOutsideAngular(() => {
      this.measureCoreWebVitals().subscribe();
      this.startDOMMonitoring();
      this.startScrollPerformanceMonitoring();
      this.startClickResponsivenessMonitoring();
    });
  }

  private startDOMMonitoring(): void {
    const updateDOMMetrics = () => {
      const currentMetrics = { ...this.metrics.value };
      currentMetrics.domNodeCount = document.querySelectorAll('*').length;
      currentMetrics.timestamp = Date.now();
      
      this.updateMetrics(currentMetrics);
      
      // Monitor every 10 seconds
      setTimeout(updateDOMMetrics, 10000);
    };
    
    updateDOMMetrics();
  }

  private startScrollPerformanceMonitoring(): void {
    let scrollStart = 0;
    let frameCount = 0;
    
    const measureScrollPerformance = () => {
      frameCount++;
      
      if (performance.now() - scrollStart > 1000) {
        const fps = frameCount;
        const scrollPerformance = Math.min(1, fps / 60);
        
        const currentMetrics = { ...this.metrics.value };
        currentMetrics.scrollPerformance = scrollPerformance;
        this.updateMetrics(currentMetrics);
        
        frameCount = 0;
        scrollStart = performance.now();
      }
      
      this.animationFrameId = requestAnimationFrame(measureScrollPerformance);
    };
    
    window.addEventListener('scroll', () => {
      if (scrollStart === 0) {
        scrollStart = performance.now();
        measureScrollPerformance();
      }
    }, { passive: true });
  }

  private startClickResponsivenessMonitoring(): void {
    let clickTimes: number[] = [];
    
    document.addEventListener('click', () => {
      const now = performance.now();
      clickTimes.push(now);
      
      // Keep only last 10 clicks
      if (clickTimes.length > 10) {
        clickTimes = clickTimes.slice(-10);
      }
      
      // Calculate average response time
      if (clickTimes.length > 1) {
        const intervals = [];
        for (let i = 1; i < clickTimes.length; i++) {
          intervals.push(clickTimes[i] - clickTimes[i - 1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const responsiveness = Math.min(1, 1000 / avgInterval);
        
        const currentMetrics = { ...this.metrics.value };
        currentMetrics.clickResponsiveness = responsiveness;
        this.updateMetrics(currentMetrics);
      }
    });
  }

  private updateMetrics(metrics: PerformanceMetrics): void {
    metrics.timestamp = Date.now();
    this.metrics.next(metrics);
  }

  ngOnDestroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    this.intersectionObservers.forEach(observer => observer.disconnect());
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
