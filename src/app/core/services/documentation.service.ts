import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';

export interface DocumentationSection {
  id: string;
  title: string;
  description: string;
  category: 'api' | 'guide' | 'tutorial' | 'reference' | 'deployment' | 'architecture';
  priority: 'high' | 'medium' | 'low';
  status: 'complete' | 'in-progress' | 'draft' | 'outdated';
  lastUpdated: Date;
  author: string;
  tags: string[];
  content: string;
  codeExamples: CodeExample[];
  relatedSections: string[];
  readTime: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  explanation?: string;
  runnable: boolean;
  tags: string[];
}

export interface APIEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters: APIParameter[];
  responses: APIResponse[];
  examples: APIExample[];
  authentication: boolean;
  deprecated: boolean;
  version: string;
  tags: string[];
}

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: any;
  defaultValue?: any;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  schema: any;
  example: any;
}

export interface APIExample {
  title: string;
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    statusCode: number;
    headers?: Record<string, string>;
    body: any;
  };
}

export interface DeploymentGuide {
  id: string;
  title: string;
  environment: 'development' | 'staging' | 'production';
  platform: string;
  steps: DeploymentStep[];
  prerequisites: string[];
  troubleshooting: TroubleshootingItem[];
  rollbackProcedure: string[];
  estimatedTime: number; // in minutes
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface DeploymentStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  expectedOutput?: string;
  notes?: string;
  critical: boolean;
}

export interface TroubleshootingItem {
  problem: string;
  solution: string;
  preventiveMeasures?: string[];
}

export interface DevOpsMetrics {
  deploymentFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  leadTime: number; // average hours from commit to production
  changeFailureRate: number; // percentage
  meanTimeToRecovery: number; // average hours
  codeQuality: {
    coverage: number;
    maintainabilityIndex: number;
    technicalDebt: number; // hours
  };
  infrastructure: {
    uptime: number; // percentage
    responseTime: number; // milliseconds
    errorRate: number; // percentage
  };
}

export interface CICDPipeline {
  id: string;
  name: string;
  description: string;
  trigger: 'manual' | 'push' | 'schedule' | 'webhook';
  stages: PipelineStage[];
  environment: string;
  status: 'idle' | 'running' | 'success' | 'failed' | 'cancelled';
  lastRun?: Date;
  averageDuration: number; // in minutes
  successRate: number; // percentage
}

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  commands: string[];
  dependsOn: string[];
  timeout: number; // in minutes
  retryCount: number;
  parallel: boolean;
}

export interface ProjectArchitecture {
  id: string;
  name: string;
  description: string;
  components: ArchitectureComponent[];
  relationships: ComponentRelationship[];
  patterns: string[];
  principles: string[];
  diagram?: string; // base64 encoded diagram
}

export interface ArchitectureComponent {
  id: string;
  name: string;
  type: 'service' | 'module' | 'component' | 'database' | 'external';
  description: string;
  responsibilities: string[];
  technologies: string[];
  dependencies: string[];
}

export interface ComponentRelationship {
  from: string;
  to: string;
  type: 'depends-on' | 'communicates-with' | 'inherits-from' | 'implements';
  description: string;
}

export interface OnboardingGuide {
  id: string;
  title: string;
  targetAudience: 'developer' | 'qa' | 'devops' | 'designer' | 'manager';
  estimatedTime: number; // in hours
  prerequisites: string[];
  modules: OnboardingModule[];
  resources: OnboardingResource[];
  checkpoints: OnboardingCheckpoint[];
}

export interface OnboardingModule {
  id: string;
  title: string;
  description: string;
  content: string;
  practicalExercises: string[];
  estimatedTime: number; // in minutes
  order: number;
}

export interface OnboardingResource {
  title: string;
  type: 'documentation' | 'video' | 'tool' | 'repository' | 'external';
  url: string;
  description: string;
  required: boolean;
}

export interface OnboardingCheckpoint {
  title: string;
  description: string;
  tasks: string[];
  criteria: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DocumentationService {
  private documentationSubject = new BehaviorSubject<DocumentationSection[]>([]);
  private apiEndpointsSubject = new BehaviorSubject<APIEndpoint[]>([]);
  private deploymentGuidesSubject = new BehaviorSubject<DeploymentGuide[]>([]);
  private devopsMetricsSubject = new BehaviorSubject<DevOpsMetrics | null>(null);
  private cicdPipelinesSubject = new BehaviorSubject<CICDPipeline[]>([]);
  private architectureSubject = new BehaviorSubject<ProjectArchitecture[]>([]);
  private onboardingGuidesSubject = new BehaviorSubject<OnboardingGuide[]>([]);

  public documentation$ = this.documentationSubject.asObservable();
  public apiEndpoints$ = this.apiEndpointsSubject.asObservable();
  public deploymentGuides$ = this.deploymentGuidesSubject.asObservable();
  public devopsMetrics$ = this.devopsMetricsSubject.asObservable();
  public cicdPipelines$ = this.cicdPipelinesSubject.asObservable();
  public architecture$ = this.architectureSubject.asObservable();
  public onboardingGuides$ = this.onboardingGuidesSubject.asObservable();

  constructor() {
    this.initializeData();
  }

  // Documentation Management
  getDocumentation(): Observable<DocumentationSection[]> {
    return this.documentation$;
  }

  getDocumentationByCategory(category: string): Observable<DocumentationSection[]> {
    return this.documentation$.pipe(
      map(docs => docs.filter(doc => doc.category === category))
    );
  }

  getDocumentationById(id: string): Observable<DocumentationSection | undefined> {
    return this.documentation$.pipe(
      map(docs => docs.find(doc => doc.id === id))
    );
  }

  searchDocumentation(query: string): Observable<DocumentationSection[]> {
    return this.documentation$.pipe(
      map(docs => docs.filter(doc => 
        doc.title.toLowerCase().includes(query.toLowerCase()) ||
        doc.description.toLowerCase().includes(query.toLowerCase()) ||
        doc.content.toLowerCase().includes(query.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      ))
    );
  }

  addDocumentation(doc: DocumentationSection): Observable<boolean> {
    const currentDocs = this.documentationSubject.value;
    this.documentationSubject.next([...currentDocs, doc]);
    return of(true).pipe(delay(500));
  }

  updateDocumentation(id: string, updates: Partial<DocumentationSection>): Observable<boolean> {
    const currentDocs = this.documentationSubject.value;
    const updatedDocs = currentDocs.map(doc => 
      doc.id === id ? { ...doc, ...updates, lastUpdated: new Date() } : doc
    );
    this.documentationSubject.next(updatedDocs);
    return of(true).pipe(delay(500));
  }

  deleteDocumentation(id: string): Observable<boolean> {
    const currentDocs = this.documentationSubject.value;
    const filteredDocs = currentDocs.filter(doc => doc.id !== id);
    this.documentationSubject.next(filteredDocs);
    return of(true).pipe(delay(500));
  }

  // API Documentation
  getAPIEndpoints(): Observable<APIEndpoint[]> {
    return this.apiEndpoints$;
  }

  getAPIEndpointsByTag(tag: string): Observable<APIEndpoint[]> {
    return this.apiEndpoints$.pipe(
      map(endpoints => endpoints.filter(endpoint => endpoint.tags.includes(tag)))
    );
  }

  generateAPIDocumentation(): Observable<string> {
    return this.apiEndpoints$.pipe(
      map(endpoints => this.convertToOpenAPISpec(endpoints)),
      delay(1000)
    );
  }

  // Deployment Guides
  getDeploymentGuides(): Observable<DeploymentGuide[]> {
    return this.deploymentGuides$;
  }

  getDeploymentGuideByEnvironment(environment: string): Observable<DeploymentGuide[]> {
    return this.deploymentGuides$.pipe(
      map(guides => guides.filter(guide => guide.environment === environment))
    );
  }

  executeDeployment(guideId: string): Observable<{ step: number; status: string; message: string }> {
    return new Observable(observer => {
      const guide = this.deploymentGuidesSubject.value.find(g => g.id === guideId);
      if (!guide) {
        observer.error('Deployment guide not found');
        return;
      }

      let stepIndex = 0;
      const executeStep = () => {
        if (stepIndex < guide.steps.length) {
          const step = guide.steps[stepIndex];
          
          // Simulate step execution
          setTimeout(() => {
            observer.next({
              step: stepIndex + 1,
              status: 'running',
              message: `Executing: ${step.title}`
            });

            // Simulate completion after delay
            setTimeout(() => {
              observer.next({
                step: stepIndex + 1,
                status: 'completed',
                message: `Completed: ${step.title}`
              });
              
              stepIndex++;
              executeStep();
            }, Math.random() * 2000 + 1000); // 1-3 seconds per step
          }, 500);
        } else {
          observer.next({
            step: guide.steps.length,
            status: 'finished',
            message: 'Deployment completed successfully!'
          });
          observer.complete();
        }
      };

      executeStep();
    });
  }

  // DevOps Metrics
  getDevOpsMetrics(): Observable<DevOpsMetrics | null> {
    return this.devopsMetrics$;
  }

  updateDevOpsMetrics(): Observable<DevOpsMetrics> {
    // Simulate fetching fresh metrics
    const metrics: DevOpsMetrics = {
      deploymentFrequency: {
        daily: Math.floor(Math.random() * 5) + 1,
        weekly: Math.floor(Math.random() * 20) + 10,
        monthly: Math.floor(Math.random() * 50) + 25
      },
      leadTime: Math.floor(Math.random() * 48) + 2, // 2-50 hours
      changeFailureRate: Math.random() * 0.1, // 0-10%
      meanTimeToRecovery: Math.floor(Math.random() * 4) + 1, // 1-5 hours
      codeQuality: {
        coverage: 80 + Math.random() * 20, // 80-100%
        maintainabilityIndex: 70 + Math.random() * 30, // 70-100
        technicalDebt: Math.floor(Math.random() * 100) + 10 // 10-110 hours
      },
      infrastructure: {
        uptime: 99 + Math.random() * 1, // 99-100%
        responseTime: Math.floor(Math.random() * 200) + 50, // 50-250ms
        errorRate: Math.random() * 0.05 // 0-5%
      }
    };

    this.devopsMetricsSubject.next(metrics);
    return of(metrics).pipe(delay(1000));
  }

  // CI/CD Pipelines
  getCICDPipelines(): Observable<CICDPipeline[]> {
    return this.cicdPipelines$;
  }

  runPipeline(pipelineId: string): Observable<{ stage: string; status: string; message: string }> {
    return new Observable(observer => {
      const pipeline = this.cicdPipelinesSubject.value.find(p => p.id === pipelineId);
      if (!pipeline) {
        observer.error('Pipeline not found');
        return;
      }

      let stageIndex = 0;
      const runStage = () => {
        if (stageIndex < pipeline.stages.length) {
          const stage = pipeline.stages[stageIndex];
          
          observer.next({
            stage: stage.name,
            status: 'running',
            message: `Starting stage: ${stage.name}`
          });

          // Simulate stage execution
          setTimeout(() => {
            const success = Math.random() > 0.1; // 90% success rate
            observer.next({
              stage: stage.name,
              status: success ? 'success' : 'failed',
              message: success ? `Stage ${stage.name} completed` : `Stage ${stage.name} failed`
            });
            
            if (success) {
              stageIndex++;
              runStage();
            } else {
              observer.error(`Pipeline failed at stage: ${stage.name}`);
            }
          }, Math.random() * 3000 + 1000); // 1-4 seconds per stage
        } else {
          observer.next({
            stage: 'completion',
            status: 'success',
            message: 'Pipeline executed successfully!'
          });
          observer.complete();
        }
      };

      runStage();
    });
  }

  // Architecture Documentation
  getProjectArchitecture(): Observable<ProjectArchitecture[]> {
    return this.architecture$;
  }

  generateArchitectureDiagram(architectureId: string): Observable<string> {
    // Simulate diagram generation
    return of('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCI+PC9zdmc+').pipe(delay(2000));
  }

  // Onboarding Management
  getOnboardingGuides(): Observable<OnboardingGuide[]> {
    return this.onboardingGuides$;
  }

  getOnboardingGuideByAudience(audience: string): Observable<OnboardingGuide[]> {
    return this.onboardingGuides$.pipe(
      map(guides => guides.filter(guide => guide.targetAudience === audience))
    );
  }

  trackOnboardingProgress(guideId: string, userId: string, moduleId: string): Observable<boolean> {
    // In a real application, this would track user progress
    console.log(`User ${userId} completed module ${moduleId} in guide ${guideId}`);
    return of(true).pipe(delay(300));
  }

  // Code Generation and Templates
  generateCodeTemplate(type: 'component' | 'service' | 'module', name: string, options: any): Observable<string> {
    const templates = {
      component: this.generateAngularComponentTemplate(name, options),
      service: this.generateAngularServiceTemplate(name, options),
      module: this.generateAngularModuleTemplate(name, options)
    };

    return of(templates[type]).pipe(delay(500));
  }

  generateDocumentationTemplate(type: 'api' | 'guide' | 'deployment'): Observable<string> {
    const templates = {
      api: this.getAPIDocumentationTemplate(),
      guide: this.getUserGuideTemplate(),
      deployment: this.getDeploymentGuideTemplate()
    };

    return of(templates[type]).pipe(delay(300));
  }

  // Export and Import
  exportDocumentation(format: 'json' | 'markdown' | 'pdf'): Observable<Blob> {
    const docs = this.documentationSubject.value;
    
    switch (format) {
      case 'json':
        const jsonData = JSON.stringify(docs, null, 2);
        return of(new Blob([jsonData], { type: 'application/json' })).pipe(delay(1000));
      
      case 'markdown':
        const markdownData = this.convertDocsToMarkdown(docs);
        return of(new Blob([markdownData], { type: 'text/markdown' })).pipe(delay(1500));
      
      case 'pdf':
        // Simulate PDF generation
        return of(new Blob(['PDF content'], { type: 'application/pdf' })).pipe(delay(3000));
      
      default:
        throw new Error('Unsupported format');
    }
  }

  importDocumentation(file: File): Observable<DocumentationSection[]> {
    return new Observable(observer => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importedDocs = JSON.parse(content) as DocumentationSection[];
          
          const currentDocs = this.documentationSubject.value;
          const mergedDocs = [...currentDocs, ...importedDocs];
          this.documentationSubject.next(mergedDocs);
          
          observer.next(importedDocs);
          observer.complete();
        } catch (error) {
          observer.error('Invalid file format');
        }
      };
      reader.readAsText(file);
    });
  }

  // Private helper methods
  private initializeData(): void {
    // Initialize with mock data
    this.documentationSubject.next(this.getMockDocumentation());
    this.apiEndpointsSubject.next(this.getMockAPIEndpoints());
    this.deploymentGuidesSubject.next(this.getMockDeploymentGuides());
    this.devopsMetricsSubject.next(this.getMockDevOpsMetrics());
    this.cicdPipelinesSubject.next(this.getMockCICDPipelines());
    this.architectureSubject.next(this.getMockArchitecture());
    this.onboardingGuidesSubject.next(this.getMockOnboardingGuides());
  }

  private convertToOpenAPISpec(endpoints: APIEndpoint[]): string {
    const openAPISpec: any = {
      openapi: '3.0.0',
      info: {
        title: 'Cadentis API Documentation',
        version: '1.0.0',
        description: 'Comprehensive API documentation for the Cadentis application'
      },
      paths: {}
    };

    endpoints.forEach(endpoint => {
      const method = endpoint.method.toLowerCase();
      if (!openAPISpec.paths[endpoint.path]) {
        openAPISpec.paths[endpoint.path] = {};
      }

      openAPISpec.paths[endpoint.path][method] = {
        summary: endpoint.description,
        parameters: endpoint.parameters,
        responses: endpoint.responses.reduce((acc: any, response) => {
          acc[response.statusCode] = {
            description: response.description,
            content: {
              'application/json': {
                schema: response.schema,
                example: response.example
              }
            }
          };
          return acc;
        }, {} as any),
        tags: endpoint.tags
      };
    });

    return JSON.stringify(openAPISpec, null, 2);
  }

  private generateAngularComponentTemplate(name: string, options: any): string {
    const className = name.charAt(0).toUpperCase() + name.slice(1) + 'Component';
    return `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-${name}',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div class="${name}-container">
      <h2>${className}</h2>
      <p>Welcome to the ${className}!</p>
    </div>
  \`,
  styles: [\`
    .${name}-container {
      padding: 1rem;
      border-radius: 8px;
      background: #f8f9fa;
    }
  \`]
})
export class ${className} {
  
}`;
  }

  private generateAngularServiceTemplate(name: string, options: any): string {
    const className = name.charAt(0).toUpperCase() + name.slice(1) + 'Service';
    return `import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ${className} {
  private dataSubject = new BehaviorSubject<any[]>([]);
  public data$ = this.dataSubject.asObservable();

  constructor() {
    this.initializeData();
  }

  private initializeData(): void {
    // Initialize service data
  }

  getData(): Observable<any[]> {
    return this.data$;
  }
}`;
  }

  private generateAngularModuleTemplate(name: string, options: any): string {
    const className = name.charAt(0).toUpperCase() + name.slice(1) + 'Module';
    return `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    // Add components here
  ],
  imports: [
    CommonModule,
    RouterModule
  ],
  providers: [
    // Add services here
  ],
  exports: [
    // Add exports here
  ]
})
export class ${className} { }`;
  }

  private getAPIDocumentationTemplate(): string {
    return `# API Documentation Template

## Overview
Brief description of the API endpoint

## Endpoint
\`\`\`
METHOD /api/endpoint
\`\`\`

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | Description of param1 |

## Responses
### 200 OK
\`\`\`json
{
  "status": "success",
  "data": {}
}
\`\`\`

### 400 Bad Request
\`\`\`json
{
  "status": "error",
  "message": "Invalid request"
}
\`\`\`

## Examples
### Request
\`\`\`bash
curl -X GET "https://api.example.com/endpoint"
\`\`\`

### Response
\`\`\`json
{
  "status": "success"
}
\`\`\``;
  }

  private getUserGuideTemplate(): string {
    return `# User Guide Template

## Introduction
Brief introduction to the feature/functionality

## Prerequisites
- Requirement 1
- Requirement 2

## Step-by-step Instructions
1. Step 1 description
2. Step 2 description
3. Step 3 description

## Screenshots
[Add relevant screenshots here]

## Troubleshooting
### Common Issue 1
**Problem:** Description of the problem
**Solution:** How to solve it

### Common Issue 2
**Problem:** Description of the problem
**Solution:** How to solve it

## Additional Resources
- [Link 1](url)
- [Link 2](url)`;
  }

  private getDeploymentGuideTemplate(): string {
    return `# Deployment Guide Template

## Environment: [Development/Staging/Production]

## Prerequisites
- Node.js v18+
- Docker
- Access to deployment server

## Pre-deployment Checklist
- [ ] Code review completed
- [ ] Tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready

## Deployment Steps
1. **Backup current deployment**
   \`\`\`bash
   ./scripts/backup.sh
   \`\`\`

2. **Build the application**
   \`\`\`bash
   npm run build:prod
   \`\`\`

3. **Deploy to server**
   \`\`\`bash
   ./scripts/deploy.sh
   \`\`\`

## Post-deployment Verification
- [ ] Application starts successfully
- [ ] Health checks pass
- [ ] Critical user flows work
- [ ] Monitoring shows green status

## Rollback Procedure
1. Stop current deployment
2. Restore from backup
3. Restart services

## Troubleshooting
### Deployment fails
Check logs in \`/var/log/app/\`

### Application won't start
Verify environment variables and dependencies`;
  }

  private convertDocsToMarkdown(docs: DocumentationSection[]): string {
    return docs.map(doc => `# ${doc.title}

**Category:** ${doc.category}
**Status:** ${doc.status}
**Last Updated:** ${doc.lastUpdated.toDateString()}
**Author:** ${doc.author}
**Tags:** ${doc.tags.join(', ')}

## Description
${doc.description}

## Content
${doc.content}

${doc.codeExamples.length > 0 ? '## Code Examples' : ''}
${doc.codeExamples.map(example => `### ${example.title}
${example.description}

\`\`\`${example.language}
${example.code}
\`\`\`

${example.explanation || ''}
`).join('\n')}

---
`).join('\n');
  }

  // Mock data generators
  private getMockDocumentation(): DocumentationSection[] {
    return [
      {
        id: 'getting-started',
        title: 'Getting Started Guide',
        description: 'Complete guide to get started with the Cadentis application',
        category: 'guide',
        priority: 'high',
        status: 'complete',
        lastUpdated: new Date('2024-01-15'),
        author: 'Development Team',
        tags: ['beginner', 'setup', 'installation'],
        content: `# Getting Started with Cadentis

Welcome to Cadentis! This guide will help you get up and running quickly.

## Prerequisites
- Node.js v18 or higher
- npm or yarn
- Git

## Installation
1. Clone the repository
2. Install dependencies
3. Start the development server

## Next Steps
- Explore the features
- Read the API documentation
- Join our community`,
        codeExamples: [
          {
            id: 'install-deps',
            title: 'Install Dependencies',
            description: 'Install all required dependencies using npm',
            language: 'bash',
            code: 'npm install',
            explanation: 'This command installs all dependencies listed in package.json',
            runnable: true,
            tags: ['setup']
          }
        ],
        relatedSections: ['api-reference', 'architecture-overview'],
        readTime: 10,
        difficulty: 'beginner'
      },
      {
        id: 'api-reference',
        title: 'API Reference',
        description: 'Comprehensive API documentation for all endpoints',
        category: 'api',
        priority: 'high',
        status: 'complete',
        lastUpdated: new Date('2024-01-20'),
        author: 'Backend Team',
        tags: ['api', 'reference', 'endpoints'],
        content: `# API Reference

This document provides detailed information about all available API endpoints.

## Authentication
All API requests require authentication using Bearer tokens.

## Base URL
\`https://api.cadentis.com/v1\`

## Rate Limiting
- 1000 requests per hour for authenticated users
- 100 requests per hour for unauthenticated users`,
        codeExamples: [
          {
            id: 'auth-example',
            title: 'Authentication Example',
            description: 'Example of authenticated API request',
            language: 'javascript',
            code: `const response = await fetch('/api/data', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});`,
            explanation: 'Always include the Authorization header with your Bearer token',
            runnable: false,
            tags: ['authentication']
          }
        ],
        relatedSections: ['getting-started'],
        readTime: 25,
        difficulty: 'intermediate'
      }
    ];
  }

  private getMockAPIEndpoints(): APIEndpoint[] {
    return [
      {
        id: 'get-users',
        method: 'GET',
        path: '/api/users',
        description: 'Retrieve a list of users',
        parameters: [
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number for pagination',
            example: 1,
            defaultValue: 1
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Number of users per page',
            example: 10,
            defaultValue: 10
          }
        ],
        responses: [
          {
            statusCode: 200,
            description: 'Successfully retrieved users',
            schema: {
              type: 'object',
              properties: {
                data: { type: 'array' },
                pagination: { type: 'object' }
              }
            },
            example: {
              data: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
              pagination: { page: 1, limit: 10, total: 100 }
            }
          }
        ],
        examples: [
          {
            title: 'Get first page of users',
            request: {
              method: 'GET',
              url: '/api/users?page=1&limit=10'
            },
            response: {
              statusCode: 200,
              body: {
                data: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
                pagination: { page: 1, limit: 10, total: 100 }
              }
            }
          }
        ],
        authentication: true,
        deprecated: false,
        version: '1.0',
        tags: ['users', 'crud']
      }
    ];
  }

  private getMockDeploymentGuides(): DeploymentGuide[] {
    return [
      {
        id: 'production-deploy',
        title: 'Production Deployment Guide',
        environment: 'production',
        platform: 'AWS EC2',
        steps: [
          {
            id: 'backup',
            title: 'Create Backup',
            description: 'Create a backup of the current deployment',
            command: './scripts/backup.sh production',
            expectedOutput: 'Backup completed successfully',
            notes: 'Always create a backup before deploying to production',
            critical: true
          },
          {
            id: 'build',
            title: 'Build Application',
            description: 'Build the application for production',
            command: 'npm run build:prod',
            expectedOutput: 'Build completed successfully',
            critical: true
          },
          {
            id: 'deploy',
            title: 'Deploy to Production',
            description: 'Deploy the built application to production servers',
            command: './scripts/deploy.sh production',
            expectedOutput: 'Deployment successful',
            critical: true
          }
        ],
        prerequisites: [
          'Production access credentials',
          'Application built and tested',
          'Database migrations ready'
        ],
        troubleshooting: [
          {
            problem: 'Deployment script fails',
            solution: 'Check server connectivity and permissions',
            preventiveMeasures: ['Test deployment script in staging first']
          }
        ],
        rollbackProcedure: [
          'Stop current deployment',
          'Restore from backup',
          'Restart application services'
        ],
        estimatedTime: 30,
        complexity: 'moderate'
      }
    ];
  }

  private getMockDevOpsMetrics(): DevOpsMetrics {
    return {
      deploymentFrequency: {
        daily: 2,
        weekly: 12,
        monthly: 45
      },
      leadTime: 24,
      changeFailureRate: 0.05,
      meanTimeToRecovery: 2,
      codeQuality: {
        coverage: 87.5,
        maintainabilityIndex: 82,
        technicalDebt: 45
      },
      infrastructure: {
        uptime: 99.8,
        responseTime: 125,
        errorRate: 0.02
      }
    };
  }

  private getMockCICDPipelines(): CICDPipeline[] {
    return [
      {
        id: 'main-pipeline',
        name: 'Main CI/CD Pipeline',
        description: 'Main build and deployment pipeline for the application',
        trigger: 'push',
        stages: [
          {
            id: 'install',
            name: 'Install Dependencies',
            description: 'Install npm dependencies',
            commands: ['npm ci'],
            dependsOn: [],
            timeout: 5,
            retryCount: 2,
            parallel: false
          },
          {
            id: 'test',
            name: 'Run Tests',
            description: 'Execute unit and integration tests',
            commands: ['npm run test:ci'],
            dependsOn: ['install'],
            timeout: 10,
            retryCount: 1,
            parallel: false
          },
          {
            id: 'build',
            name: 'Build Application',
            description: 'Build the application for production',
            commands: ['npm run build:prod'],
            dependsOn: ['test'],
            timeout: 15,
            retryCount: 1,
            parallel: false
          },
          {
            id: 'deploy',
            name: 'Deploy to Production',
            description: 'Deploy the built application',
            commands: ['./scripts/deploy.sh'],
            dependsOn: ['build'],
            timeout: 20,
            retryCount: 0,
            parallel: false
          }
        ],
        environment: 'production',
        status: 'idle',
        lastRun: new Date('2024-01-20T10:30:00'),
        averageDuration: 25,
        successRate: 95.2
      }
    ];
  }

  private getMockArchitecture(): ProjectArchitecture[] {
    return [
      {
        id: 'cadentis-architecture',
        name: 'Cadentis Application Architecture',
        description: 'High-level architecture overview of the Cadentis application',
        components: [
          {
            id: 'frontend',
            name: 'Angular Frontend',
            type: 'component',
            description: 'Angular-based single page application',
            responsibilities: ['User interface', 'State management', 'API communication'],
            technologies: ['Angular 17', 'RxJS', 'TypeScript'],
            dependencies: ['api-gateway']
          },
          {
            id: 'api-gateway',
            name: 'API Gateway',
            type: 'service',
            description: 'Central API gateway for routing and authentication',
            responsibilities: ['Request routing', 'Authentication', 'Rate limiting'],
            technologies: ['Node.js', 'Express', 'JWT'],
            dependencies: ['user-service', 'analytics-service']
          }
        ],
        relationships: [
          {
            from: 'frontend',
            to: 'api-gateway',
            type: 'communicates-with',
            description: 'Frontend communicates with backend through API gateway'
          }
        ],
        patterns: ['Microservices', 'API Gateway', 'CQRS'],
        principles: ['Single Responsibility', 'Separation of Concerns', 'DRY']
      }
    ];
  }

  private getMockOnboardingGuides(): OnboardingGuide[] {
    return [
      {
        id: 'developer-onboarding',
        title: 'Developer Onboarding Guide',
        targetAudience: 'developer',
        estimatedTime: 8,
        prerequisites: [
          'Basic knowledge of Angular',
          'TypeScript experience',
          'Git version control'
        ],
        modules: [
          {
            id: 'environment-setup',
            title: 'Environment Setup',
            description: 'Set up your development environment',
            content: 'Install Node.js, Angular CLI, and configure your IDE',
            practicalExercises: [
              'Clone the repository',
              'Install dependencies',
              'Run the application locally'
            ],
            estimatedTime: 60,
            order: 1
          },
          {
            id: 'code-standards',
            title: 'Coding Standards',
            description: 'Learn our coding standards and best practices',
            content: 'Review TypeScript style guide, Angular conventions, and testing practices',
            practicalExercises: [
              'Review existing code',
              'Create a simple component following standards'
            ],
            estimatedTime: 90,
            order: 2
          }
        ],
        resources: [
          {
            title: 'Angular Documentation',
            type: 'documentation',
            url: 'https://angular.io/docs',
            description: 'Official Angular documentation',
            required: true
          },
          {
            title: 'TypeScript Handbook',
            type: 'documentation',
            url: 'https://www.typescriptlang.org/docs',
            description: 'Complete TypeScript reference',
            required: true
          }
        ],
        checkpoints: [
          {
            title: 'Environment Setup Complete',
            description: 'Development environment is properly configured',
            tasks: [
              'Application runs locally',
              'Tests pass',
              'IDE is configured with project settings'
            ],
            criteria: [
              'No compilation errors',
              'All unit tests pass',
              'Linting passes without warnings'
            ]
          }
        ]
      }
    ];
  }
}
