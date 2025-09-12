import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService, DashboardMetrics, UserEvent, ConversionFunnel, UserSegment } from '../../../core/services/analytics.service';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss']
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('heatmapCanvas', { static: false }) heatmapCanvas!: ElementRef<HTMLCanvasElement>;
  
  private destroy$ = new Subject<void>();
  
  // Dashboard Data
  metrics: DashboardMetrics | null = null;
  recentEvents: UserEvent[] = [];
  conversionFunnels: ConversionFunnel[] = [];
  userSegments: UserSegment[] = [];
  
  // UI State
  selectedTimeRange = '24h';
  selectedMetric = 'users';
  isRealTimeEnabled = true;
  isLoading = false;
  
  // Chart Data
  metricsChartData: any = null;
  conversionChartData: any = null;
  segmentChartData: any = null;
  trafficChartData: any = null;
  
  // Filters
  availableFilters = [
    { key: 'device', label: 'Device Type', options: ['desktop', 'mobile', 'tablet'] },
    { key: 'location', label: 'Location', options: ['US', 'EU', 'Asia', 'Other'] },
    { key: 'source', label: 'Traffic Source', options: ['direct', 'search', 'social', 'referral'] }
  ];
  
  activeFilters: Record<string, string[]> = {};
  
  // Export Options
  exportFormats = ['json', 'csv', 'pdf'];
  selectedExportFormat = 'json';
  
  // Real-time Stats
  realTimeStats = {
    activeUsers: 0,
    pageViews: 0,
    conversionRate: 0,
    avgSessionDuration: 0,
    topPages: [] as { path: string; views: number; uniqueViews: number }[],
    recentEvents: [] as UserEvent[]
  };
  
  // A/B Testing
  activeExperiments = [
    { id: 'exp1', name: 'Button Color Test', variants: ['red', 'blue'], status: 'running' },
    { id: 'exp2', name: 'Landing Page Layout', variants: ['A', 'B'], status: 'paused' }
  ];
  
  constructor(private analyticsService: AnalyticsService) {}
  
  ngOnInit(): void {
    this.loadDashboardData();
    this.setupRealTimeUpdates();
    this.initializeCharts();
    this.trackDashboardUsage();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Data Loading
  loadDashboardData(): void {
    this.isLoading = true;
    
    // Load main metrics
    this.analyticsService.metrics$
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        this.metrics = metrics;
        this.updateCharts();
        this.isLoading = false;
      });
    
    // Load recent events
    this.recentEvents = this.analyticsService.getEventHistory(50);
    
    // Load conversion funnels
    this.conversionFunnels = this.analyticsService.getConversionFunnels();
    
    // Load user segments
    this.userSegments = this.analyticsService.getUserSegments();
  }
  
  private setupRealTimeUpdates(): void {
    if (!this.isRealTimeEnabled) return;
    
    // Update real-time stats every 5 seconds
    interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isRealTimeEnabled) {
          this.updateRealTimeStats();
        }
      });
    
    // Listen to new events
    this.analyticsService.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.recentEvents.unshift(event);
        if (this.recentEvents.length > 50) {
          this.recentEvents.pop();
        }
      });
  }
  
  private updateRealTimeStats(): void {
    const currentMetrics = this.analyticsService.getRealTimeMetrics();
    
    this.realTimeStats = {
      activeUsers: currentMetrics.realTimeUsers,
      pageViews: currentMetrics.pageViews,
      conversionRate: currentMetrics.conversionRate,
      avgSessionDuration: currentMetrics.avgSessionDuration,
      topPages: currentMetrics.topPages.slice(0, 5),
      recentEvents: this.recentEvents.slice(0, 10)
    };
  }
  
  // Chart Initialization
  private initializeCharts(): void {
    this.updateCharts();
  }
  
  private updateCharts(): void {
    if (!this.metrics) return;
    
    // Metrics Overview Chart
    this.metricsChartData = {
      labels: ['Users', 'Sessions', 'Page Views', 'Conversions'],
      datasets: [{
        data: [
          this.metrics.totalUsers,
          this.metrics.sessions,
          this.metrics.pageViews,
          Math.floor(this.metrics.totalUsers * this.metrics.conversionRate)
        ],
        backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'],
        borderWidth: 0
      }]
    };
    
    // Conversion Funnel Chart
    if (this.conversionFunnels.length > 0) {
      const funnel = this.conversionFunnels[0];
      this.conversionChartData = {
        labels: funnel.steps.map(step => step.name),
        datasets: [{
          label: 'Users',
          data: funnel.steps.map(step => step.completedUsers),
          backgroundColor: '#2196F3',
          borderColor: '#1976D2',
          borderWidth: 1
        }]
      };
    }
    
    // User Segments Chart
    this.segmentChartData = {
      labels: this.userSegments.map(segment => segment.name),
      datasets: [{
        data: this.userSegments.map(segment => segment.userCount),
        backgroundColor: ['#FF5722', '#607D8B', '#795548', '#3F51B5'],
        borderWidth: 0
      }]
    };
    
    // Traffic Sources Chart (Mock data)
    this.trafficChartData = {
      labels: ['Direct', 'Search', 'Social', 'Referral', 'Email'],
      datasets: [{
        data: [40, 30, 15, 10, 5],
        backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'],
        borderWidth: 0
      }]
    };
  }
  
  // Event Handlers
  onTimeRangeChange(range: string): void {
    this.selectedTimeRange = range;
    this.loadDashboardData();
    this.analyticsService.trackFeatureUsage('analytics_time_range_change', 'dashboard', { range });
  }
  
  onMetricChange(metric: string): void {
    this.selectedMetric = metric;
    this.analyticsService.trackFeatureUsage('analytics_metric_change', 'dashboard', { metric });
  }
  
  onFilterToggle(filterKey: string, option: string): void {
    if (!this.activeFilters[filterKey]) {
      this.activeFilters[filterKey] = [];
    }
    
    const index = this.activeFilters[filterKey].indexOf(option);
    if (index > -1) {
      this.activeFilters[filterKey].splice(index, 1);
    } else {
      this.activeFilters[filterKey].push(option);
    }
    
    this.loadDashboardData();
    this.analyticsService.trackFeatureUsage('analytics_filter_toggle', 'dashboard', {
      filter: filterKey,
      option,
      activeFilters: this.activeFilters
    });
  }
  
  onRealTimeToggle(): void {
    this.isRealTimeEnabled = !this.isRealTimeEnabled;
    if (this.isRealTimeEnabled) {
      this.setupRealTimeUpdates();
    }
    
    this.analyticsService.trackFeatureUsage('analytics_realtime_toggle', 'dashboard', {
      enabled: this.isRealTimeEnabled
    });
  }
  
  // Data Export
  onExportData(): void {
    const format = this.selectedExportFormat as 'json' | 'csv';
    const data = this.analyticsService.exportData(format);
    
    const blob = new Blob([format === 'json' ? JSON.stringify(data, null, 2) : data], {
      type: format === 'json' ? 'application/json' : 'text/csv'
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics_${new Date().toISOString().split('T')[0]}.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    this.analyticsService.trackFeatureUsage('analytics_export', 'dashboard', { format });
  }
  
  // Privacy Controls
  onClearData(): void {
    if (confirm('Are you sure you want to clear all analytics data? This action cannot be undone.')) {
      this.analyticsService.clearData();
      this.loadDashboardData();
      this.analyticsService.trackFeatureUsage('analytics_clear_data', 'dashboard');
    }
  }
  
  onPrivacyModeToggle(): void {
    const config = this.analyticsService.getConfig();
    if (config.privacyMode) {
      this.analyticsService.updateConfig({ privacyMode: false });
    } else {
      this.analyticsService.enablePrivacyMode();
    }
    
    this.analyticsService.trackFeatureUsage('analytics_privacy_toggle', 'dashboard', {
      enabled: !config.privacyMode
    });
  }
  
  onOptOutToggle(): void {
    const config = this.analyticsService.getConfig();
    if (config.enabled) {
      this.analyticsService.optOutOfTracking();
    } else {
      this.analyticsService.optInToTracking();
    }
    
    this.analyticsService.trackFeatureUsage('analytics_opt_out_toggle', 'dashboard', {
      optedOut: config.enabled
    });
  }
  
  // Funnel Analysis
  onFunnelStepClick(funnel: ConversionFunnel, step: any): void {
    this.analyticsService.trackFeatureUsage('analytics_funnel_step_click', 'dashboard', {
      funnelId: funnel.id,
      stepId: step.id,
      stepName: step.name
    });
    
    // In a real app, this would show detailed step analysis
    alert(`Analyzing step: ${step.name}\nCompletion Rate: ${(step.completionRate * 100).toFixed(1)}%`);
  }
  
  // Segment Analysis
  onSegmentClick(segment: UserSegment): void {
    this.analyticsService.trackFeatureUsage('analytics_segment_click', 'dashboard', {
      segmentId: segment.id,
      segmentName: segment.name
    });
    
    // In a real app, this would show detailed segment analysis
    alert(`Segment: ${segment.name}\nUsers: ${segment.userCount}\nConversion Rate: ${(segment.conversionRate * 100).toFixed(1)}%`);
  }
  
  // A/B Testing
  onExperimentToggle(experiment: any): void {
    experiment.status = experiment.status === 'running' ? 'paused' : 'running';
    
    this.analyticsService.trackFeatureUsage('analytics_experiment_toggle', 'dashboard', {
      experimentId: experiment.id,
      status: experiment.status
    });
  }
  
  // Heatmap Functionality
  generateHeatmap(): void {
    this.analyticsService.trackFeatureUsage('analytics_heatmap_generate', 'dashboard');
    
    // Mock heatmap generation
    setTimeout(() => {
      if (this.heatmapCanvas) {
        const canvas = this.heatmapCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Simple mock heatmap visualization
          canvas.width = 800;
          canvas.height = 600;
          
          // Create gradient for heatmap effect
          const gradient = ctx.createRadialGradient(400, 300, 0, 400, 300, 300);
          gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.4)');
          gradient.addColorStop(1, 'rgba(0, 0, 255, 0.1)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 800, 600);
          
          // Add some click hotspots
          const hotspots = [
            { x: 150, y: 100, intensity: 0.9 },
            { x: 650, y: 150, intensity: 0.7 },
            { x: 400, y: 350, intensity: 0.8 },
            { x: 200, y: 450, intensity: 0.6 }
          ];
          
          hotspots.forEach(spot => {
            const spotGradient = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, 50);
            spotGradient.addColorStop(0, `rgba(255, 0, 0, ${spot.intensity})`);
            spotGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            ctx.fillStyle = spotGradient;
            ctx.fillRect(spot.x - 50, spot.y - 50, 100, 100);
          });
        }
      }
    }, 1000);
  }
  
  // User Journey Analysis
  showUserJourney(userId?: string): void {
    this.analyticsService.trackFeatureUsage('analytics_user_journey', 'dashboard', { userId });
    
    // Mock user journey data
    const journeyData = [
      { page: '/home', timestamp: new Date(Date.now() - 3600000), duration: 45000 },
      { page: '/features', timestamp: new Date(Date.now() - 3000000), duration: 120000 },
      { page: '/pricing', timestamp: new Date(Date.now() - 1800000), duration: 180000 },
      { page: '/signup', timestamp: new Date(Date.now() - 600000), duration: 300000 }
    ];
    
    console.log('User Journey:', journeyData);
    alert('User journey data logged to console. In a real app, this would show a detailed journey visualization.');
  }
  
  // Configuration Management
  updateAnalyticsConfig(): void {
    const config = this.analyticsService.getConfig();
    
    // Example configuration update
    this.analyticsService.updateConfig({
      sampleRate: 0.5, // Sample 50% of events
      enableHeatmaps: true,
      dataRetentionDays: 30
    });
    
    this.analyticsService.trackFeatureUsage('analytics_config_update', 'dashboard');
    alert('Analytics configuration updated');
  }
  
  // Custom Event Tracking
  trackCustomEvent(): void {
    const category = prompt('Event Category:') || 'custom';
    const action = prompt('Event Action:') || 'test';
    const label = prompt('Event Label (optional):') || undefined;
    
    if (category && action) {
      this.analyticsService.trackEvent(category, action, label);
      alert(`Custom event tracked: ${category}/${action}${label ? '/' + label : ''}`);
    }
  }
  
  // Utility Methods
  formatNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }
  
  formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  
  formatPercentage(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }
  
  getEventTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'page_view': '👁️',
      'click': '👆',
      'form_submit': '📝',
      'error': '❌',
      'performance': '⚡',
      'feature_use': '🎯',
      'custom': '⭐'
    };
    return icons[type] || '📊';
  }
  
  getSegmentColor(index: number): string {
    const colors = ['#FF5722', '#607D8B', '#795548', '#3F51B5', '#4CAF50', '#FF9800'];
    return colors[index % colors.length];
  }
  
  isFilterActive(filterKey: string, option: string): boolean {
    return this.activeFilters[filterKey]?.includes(option) || false;
  }
  
  private trackDashboardUsage(): void {
    this.analyticsService.trackFeatureUsage('analytics_dashboard', 'view');
    
    // Track dashboard interactions
    this.analyticsService.trackPageView('/analytics', 'Analytics Dashboard');
  }
}
