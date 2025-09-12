import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PerformanceMetrics {
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usedPercent: number;
  };
  timing: {
    analysisTime: number;
    renderTime: number;
    totalTime: number;
  };
  textMetrics: {
    textLength: number;
    lineCount: number;
    averageLineLength: number;
    processingRate: number; // characters per second
  };
  systemMetrics: {
    cpuUsage: number;
    networkLatency: number;
    deviceMemory: number;
    hardwareConcurrency: number;
  };
}

interface TaskMetrics {
  id: string;
  type: string;
  startTime: number;
  endTime?: number;
  textLength: number;
  lineCount: number;
  memoryBefore: number;
  memoryAfter?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitorService implements OnDestroy {
  private metricsSubject = new BehaviorSubject<PerformanceMetrics | null>(null);
  private activeTasks = new Map<string, TaskMetrics>();
  private performanceHistory: PerformanceMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  public metrics$ = this.metricsSubject.asObservable();
  public performanceObserver?: PerformanceObserver;

  constructor() {
    this.initializePerformanceObserver();
    this.startMemoryMonitoring();
  }

  private initializePerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.handlePerformanceMeasure(entry);
          }
        }
      });

      try {
        this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (error) {
        // Performance Observer not fully supported - using fallback methods
      }
    }
  }

  private startMemoryMonitoring(): void {
    // Monitor memory usage every 5 seconds
    setInterval(() => {
      this.updateMemoryMetrics();
    }, 5000);
  }

  private handlePerformanceMeasure(entry: PerformanceEntry): void {
    if (entry.name.startsWith('cadentis-analysis')) {
      const taskId = entry.name.split('-')[2];
      const task = this.activeTasks.get(taskId);
      
      if (task) {
        task.endTime = entry.startTime + entry.duration;
        this.completeTaskMetrics(task);
      }
    }
  }

  public startTask(taskId: string, type: string, text: string): void {
    const lines = text.split('\n');
    const task: TaskMetrics = {
      id: taskId,
      type,
      startTime: performance.now(),
      textLength: text.length,
      lineCount: lines.length,
      memoryBefore: this.getCurrentMemoryUsage()
    };

    this.activeTasks.set(taskId, task);
    
    // Start performance measurement
    performance.mark(`cadentis-analysis-start-${taskId}`);
  }

  public completeTask(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    
    if (task) {
      // End performance measurement
      performance.mark(`cadentis-analysis-end-${taskId}`);
      performance.measure(
        `cadentis-analysis-${taskId}`,
        `cadentis-analysis-start-${taskId}`,
        `cadentis-analysis-end-${taskId}`
      );

      task.endTime = performance.now();
      task.memoryAfter = this.getCurrentMemoryUsage();
      
      this.completeTaskMetrics(task);
      this.activeTasks.delete(taskId);
    }
  }

  private completeTaskMetrics(task: TaskMetrics): void {
    if (!task.endTime) return;

    const duration = task.endTime - task.startTime;
    const processingRate = task.textLength / (duration / 1000); // chars per second

    const metrics: PerformanceMetrics = {
      memoryUsage: this.getMemoryMetrics(),
      timing: {
        analysisTime: duration,
        renderTime: 0, // Will be updated by components
        totalTime: duration
      },
      textMetrics: {
        textLength: task.textLength,
        lineCount: task.lineCount,
        averageLineLength: task.textLength / task.lineCount,
        processingRate
      },
      systemMetrics: this.getSystemMetrics()
    };

    this.addToHistory(metrics);
    this.metricsSubject.next(metrics);
  }

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private getMemoryMetrics() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usedPercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }

    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      usedPercent: 0
    };
  }

  private getSystemMetrics() {
    return {
      cpuUsage: this.estimateCPUUsage(),
      networkLatency: this.estimateNetworkLatency(),
      deviceMemory: (navigator as any).deviceMemory || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 0
    };
  }

  private estimateCPUUsage(): number {
    // Simple CPU usage estimation based on task queue timing
    const start = performance.now();
    const iterations = 10000;
    
    for (let i = 0; i < iterations; i++) {
      Math.random();
    }
    
    const duration = performance.now() - start;
    const expectedDuration = 1; // Expected duration for this operation
    
    return Math.min((duration / expectedDuration) * 100, 100);
  }

  private estimateNetworkLatency(): number {
    // This would typically measure actual network requests
    // For now, return a placeholder value
    return 0;
  }

  private updateMemoryMetrics(): void {
    const currentMetrics = this.metricsSubject.value;
    if (currentMetrics) {
      const updatedMetrics = {
        ...currentMetrics,
        memoryUsage: this.getMemoryMetrics(),
        systemMetrics: this.getSystemMetrics()
      };
      this.metricsSubject.next(updatedMetrics);
    }
  }

  private addToHistory(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);
    
    if (this.performanceHistory.length > this.MAX_HISTORY_SIZE) {
      this.performanceHistory.shift();
    }
  }

  public getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  public getAverageMetrics(): PerformanceMetrics | null {
    if (this.performanceHistory.length === 0) return null;

    const count = this.performanceHistory.length;
    const sum = this.performanceHistory.reduce((acc, metrics) => ({
      memoryUsage: {
        usedJSHeapSize: acc.memoryUsage.usedJSHeapSize + metrics.memoryUsage.usedJSHeapSize,
        totalJSHeapSize: acc.memoryUsage.totalJSHeapSize + metrics.memoryUsage.totalJSHeapSize,
        jsHeapSizeLimit: acc.memoryUsage.jsHeapSizeLimit + metrics.memoryUsage.jsHeapSizeLimit,
        usedPercent: acc.memoryUsage.usedPercent + metrics.memoryUsage.usedPercent
      },
      timing: {
        analysisTime: acc.timing.analysisTime + metrics.timing.analysisTime,
        renderTime: acc.timing.renderTime + metrics.timing.renderTime,
        totalTime: acc.timing.totalTime + metrics.timing.totalTime
      },
      textMetrics: {
        textLength: acc.textMetrics.textLength + metrics.textMetrics.textLength,
        lineCount: acc.textMetrics.lineCount + metrics.textMetrics.lineCount,
        averageLineLength: acc.textMetrics.averageLineLength + metrics.textMetrics.averageLineLength,
        processingRate: acc.textMetrics.processingRate + metrics.textMetrics.processingRate
      },
      systemMetrics: {
        cpuUsage: acc.systemMetrics.cpuUsage + metrics.systemMetrics.cpuUsage,
        networkLatency: acc.systemMetrics.networkLatency + metrics.systemMetrics.networkLatency,
        deviceMemory: acc.systemMetrics.deviceMemory + metrics.systemMetrics.deviceMemory,
        hardwareConcurrency: acc.systemMetrics.hardwareConcurrency + metrics.systemMetrics.hardwareConcurrency
      }
    }), {
      memoryUsage: { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0, usedPercent: 0 },
      timing: { analysisTime: 0, renderTime: 0, totalTime: 0 },
      textMetrics: { textLength: 0, lineCount: 0, averageLineLength: 0, processingRate: 0 },
      systemMetrics: { cpuUsage: 0, networkLatency: 0, deviceMemory: 0, hardwareConcurrency: 0 }
    });

    return {
      memoryUsage: {
        usedJSHeapSize: sum.memoryUsage.usedJSHeapSize / count,
        totalJSHeapSize: sum.memoryUsage.totalJSHeapSize / count,
        jsHeapSizeLimit: sum.memoryUsage.jsHeapSizeLimit / count,
        usedPercent: sum.memoryUsage.usedPercent / count
      },
      timing: {
        analysisTime: sum.timing.analysisTime / count,
        renderTime: sum.timing.renderTime / count,
        totalTime: sum.timing.totalTime / count
      },
      textMetrics: {
        textLength: sum.textMetrics.textLength / count,
        lineCount: sum.textMetrics.lineCount / count,
        averageLineLength: sum.textMetrics.averageLineLength / count,
        processingRate: sum.textMetrics.processingRate / count
      },
      systemMetrics: {
        cpuUsage: sum.systemMetrics.cpuUsage / count,
        networkLatency: sum.systemMetrics.networkLatency / count,
        deviceMemory: sum.systemMetrics.deviceMemory / count,
        hardwareConcurrency: sum.systemMetrics.hardwareConcurrency / count
      }
    };
  }

  public clearHistory(): void {
    this.performanceHistory = [];
  }

  public exportMetrics(): string {
    return JSON.stringify({
      current: this.metricsSubject.value,
      history: this.performanceHistory,
      average: this.getAverageMetrics(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  ngOnDestroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }
}
