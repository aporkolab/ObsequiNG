import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  DocumentationService, 
  DocumentationSection, 
  APIEndpoint, 
  DeploymentGuide,
  DevOpsMetrics,
  CICDPipeline,
  ProjectArchitecture,
  OnboardingGuide
} from '../../../core/services/documentation.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-documentation-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documentation-dashboard.component.html',
  styleUrls: ['./documentation-dashboard.component.scss']
})
export class DocumentationDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data
  documentation: DocumentationSection[] = [];
  apiEndpoints: APIEndpoint[] = [];
  deploymentGuides: DeploymentGuide[] = [];
  devopsMetrics: DevOpsMetrics | null = null;
  cicdPipelines: CICDPipeline[] = [];
  architectures: ProjectArchitecture[] = [];
  onboardingGuides: OnboardingGuide[] = [];
  
  // UI State
  activeTab = 'overview';
  searchQuery = '';
  selectedCategory = 'all';
  selectedDoc: DocumentationSection | null = null;
  selectedAPI: APIEndpoint | null = null;
  selectedDeployment: DeploymentGuide | null = null;
  selectedPipeline: CICDPipeline | null = null;
  
  // Loading States
  isLoading = false;
  isGenerating = false;
  isDeploying = false;
  isPipelineRunning = false;
  
  // Filters
  categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'api', label: 'API Documentation' },
    { value: 'guide', label: 'User Guides' },
    { value: 'tutorial', label: 'Tutorials' },
    { value: 'reference', label: 'Reference' },
    { value: 'deployment', label: 'Deployment' },
    { value: 'architecture', label: 'Architecture' }
  ];
  
  // Code Generation
  codeTemplateTypes = ['component', 'service', 'module'];
  selectedTemplateType = 'component';
  templateName = '';
  generatedCode = '';
  
  // Export/Import
  exportFormats = ['json', 'markdown', 'pdf'];
  selectedExportFormat = 'json';
  
  // Deployment Execution
  deploymentSteps: { step: number; status: string; message: string }[] = [];
  
  // Pipeline Execution
  pipelineStages: { stage: string; status: string; message: string }[] = [];
  
  constructor(private documentationService: DocumentationService) {}
  
  ngOnInit(): void {
    this.loadData();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Data Loading
  loadData(): void {
    this.isLoading = true;
    
    // Load documentation
    this.documentationService.getDocumentation()
      .pipe(takeUntil(this.destroy$))
      .subscribe(docs => {
        this.documentation = docs;
        this.isLoading = false;
      });
    
    // Load API endpoints
    this.documentationService.getAPIEndpoints()
      .pipe(takeUntil(this.destroy$))
      .subscribe(endpoints => this.apiEndpoints = endpoints);
    
    // Load deployment guides
    this.documentationService.getDeploymentGuides()
      .pipe(takeUntil(this.destroy$))
      .subscribe(guides => this.deploymentGuides = guides);
    
    // Load DevOps metrics
    this.documentationService.getDevOpsMetrics()
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => this.devopsMetrics = metrics);
    
    // Load CI/CD pipelines
    this.documentationService.getCICDPipelines()
      .pipe(takeUntil(this.destroy$))
      .subscribe(pipelines => this.cicdPipelines = pipelines);
    
    // Load architecture
    this.documentationService.getProjectArchitecture()
      .pipe(takeUntil(this.destroy$))
      .subscribe(architectures => this.architectures = architectures);
    
    // Load onboarding guides
    this.documentationService.getOnboardingGuides()
      .pipe(takeUntil(this.destroy$))
      .subscribe(guides => this.onboardingGuides = guides);
  }
  
  // Tab Management
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
  
  // Search and Filter
  onSearch(): void {
    if (this.searchQuery.trim()) {
      this.documentationService.searchDocumentation(this.searchQuery)
        .pipe(takeUntil(this.destroy$))
        .subscribe(results => {
          this.documentation = results;
        });
    } else {
      this.loadData();
    }
  }
  
  onCategoryFilter(): void {
    if (this.selectedCategory === 'all') {
      this.loadData();
    } else {
      this.documentationService.getDocumentationByCategory(this.selectedCategory)
        .pipe(takeUntil(this.destroy$))
        .subscribe(docs => {
          this.documentation = docs;
        });
    }
  }
  
  // Documentation Management
  selectDoc(doc: DocumentationSection): void {
    this.selectedDoc = doc;
  }
  
  closeDocModal(): void {
    this.selectedDoc = null;
  }
  
  updateDocStatus(docId: string, status: string): void {
    this.documentationService.updateDocumentation(docId, { status: status as any })
      .subscribe(() => {
        this.loadData();
      });
  }
  
  deleteDoc(docId: string): void {
    if (confirm('Are you sure you want to delete this documentation?')) {
      this.documentationService.deleteDocumentation(docId)
        .subscribe(() => {
          this.loadData();
          this.selectedDoc = null;
        });
    }
  }
  
  // API Documentation
  selectAPI(endpoint: APIEndpoint): void {
    this.selectedAPI = endpoint;
  }
  
  closeAPIModal(): void {
    this.selectedAPI = null;
  }
  
  generateAPIDoc(): void {
    this.isGenerating = true;
    this.documentationService.generateAPIDocumentation()
      .subscribe(spec => {
        this.downloadFile(spec, 'api-documentation.json', 'application/json');
        this.isGenerating = false;
      });
  }
  
  // Deployment Management
  selectDeployment(guide: DeploymentGuide): void {
    this.selectedDeployment = guide;
  }
  
  closeDeploymentModal(): void {
    this.selectedDeployment = null;
    this.deploymentSteps = [];
  }
  
  executeDeployment(): void {
    if (!this.selectedDeployment) return;
    
    this.isDeploying = true;
    this.deploymentSteps = [];
    
    this.documentationService.executeDeployment(this.selectedDeployment.id)
      .subscribe({
        next: (step) => {
          this.deploymentSteps.push(step);
        },
        complete: () => {
          this.isDeploying = false;
        },
        error: (error) => {
          console.error('Deployment failed:', error);
          this.isDeploying = false;
        }
      });
  }
  
  // DevOps Metrics
  refreshMetrics(): void {
    this.documentationService.updateDevOpsMetrics()
      .subscribe(metrics => {
        this.devopsMetrics = metrics;
      });
  }
  
  // CI/CD Pipeline Management
  selectPipeline(pipeline: CICDPipeline): void {
    this.selectedPipeline = pipeline;
  }
  
  closePipelineModal(): void {
    this.selectedPipeline = null;
    this.pipelineStages = [];
  }
  
  runPipeline(): void {
    if (!this.selectedPipeline) return;
    
    this.isPipelineRunning = true;
    this.pipelineStages = [];
    
    this.documentationService.runPipeline(this.selectedPipeline.id)
      .subscribe({
        next: (stage) => {
          this.pipelineStages.push(stage);
        },
        complete: () => {
          this.isPipelineRunning = false;
          this.loadData(); // Refresh pipeline status
        },
        error: (error) => {
          console.error('Pipeline failed:', error);
          this.isPipelineRunning = false;
        }
      });
  }
  
  // Code Generation
  generateCodeTemplate(): void {
    if (!this.templateName.trim()) return;
    
    this.isGenerating = true;
    this.documentationService.generateCodeTemplate(
      this.selectedTemplateType as any,
      this.templateName,
      {}
    ).subscribe(code => {
      this.generatedCode = code;
      this.isGenerating = false;
    });
  }
  
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert('Code copied to clipboard!');
    });
  }
  
  // Documentation Templates
  generateDocTemplate(type: string): void {
    this.isGenerating = true;
    this.documentationService.generateDocumentationTemplate(type as any)
      .subscribe(template => {
        this.downloadFile(template, `${type}-template.md`, 'text/markdown');
        this.isGenerating = false;
      });
  }
  
  // Export/Import
  exportDocumentation(): void {
    this.isGenerating = true;
    this.documentationService.exportDocumentation(this.selectedExportFormat as any)
      .subscribe(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `documentation.${this.selectedExportFormat}`;
        link.click();
        URL.revokeObjectURL(url);
        this.isGenerating = false;
      });
  }
  
  onFileImport(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.documentationService.importDocumentation(file)
        .subscribe(() => {
          this.loadData();
          alert('Documentation imported successfully!');
        });
    }
  }
  
  // Architecture Diagram
  generateArchitectureDiagram(architectureId: string): void {
    this.isGenerating = true;
    this.documentationService.generateArchitectureDiagram(architectureId)
      .subscribe(diagramUrl => {
        // In a real app, this would display the diagram
        console.log('Architecture diagram generated:', diagramUrl);
        this.isGenerating = false;
      });
  }
  
  // Onboarding
  trackOnboardingProgress(guideId: string, moduleId: string): void {
    const userId = 'current-user'; // In real app, get from auth service
    this.documentationService.trackOnboardingProgress(guideId, userId, moduleId)
      .subscribe(() => {
        console.log('Progress tracked');
      });
  }
  
  // Utility Methods
  formatDate(date: Date): string {
    return date.toLocaleDateString();
  }
  
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }
  
  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }
  
  formatNumber(value: number): string {
    return value.toLocaleString();
  }
  
  getStatusColor(status: string): string {
    const colors = {
      complete: '#27ae60',
      'in-progress': '#f39c12',
      draft: '#95a5a6',
      outdated: '#e74c3c',
      success: '#27ae60',
      failed: '#e74c3c',
      running: '#3498db',
      idle: '#95a5a6'
    };
    return colors[status as keyof typeof colors] || '#95a5a6';
  }
  
  getPriorityIcon(priority: string): string {
    const icons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    return icons[priority as keyof typeof icons] || '⚪';
  }
  
  getDifficultyColor(difficulty: string): string {
    const colors = {
      beginner: '#27ae60',
      intermediate: '#f39c12',
      advanced: '#e74c3c'
    };
    return colors[difficulty as keyof typeof colors] || '#95a5a6';
  }
  
  getMethodColor(method: string): string {
    const colors = {
      GET: '#27ae60',
      POST: '#3498db',
      PUT: '#f39c12',
      DELETE: '#e74c3c',
      PATCH: '#9b59b6'
    };
    return colors[method as keyof typeof colors] || '#95a5a6';
  }
  
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  // Filtered Data Getters
  get filteredDocumentation(): DocumentationSection[] {
    let filtered = this.documentation;
    
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === this.selectedCategory);
    }
    
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.description.toLowerCase().includes(query) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }
  
  get documentationStats() {
    return {
      total: this.documentation.length,
      complete: this.documentation.filter(doc => doc.status === 'complete').length,
      inProgress: this.documentation.filter(doc => doc.status === 'in-progress').length,
      draft: this.documentation.filter(doc => doc.status === 'draft').length,
      outdated: this.documentation.filter(doc => doc.status === 'outdated').length
    };
  }
  
  get apiStats() {
    return {
      total: this.apiEndpoints.length,
      deprecated: this.apiEndpoints.filter(api => api.deprecated).length,
      authenticated: this.apiEndpoints.filter(api => api.authentication).length
    };
  }
}
