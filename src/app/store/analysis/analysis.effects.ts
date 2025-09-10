import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of, timer } from 'rxjs';
import { 
  map, 
  catchError, 
  switchMap, 
  withLatestFrom, 
  tap,
  debounceTime,
  distinctUntilChanged,
  filter
} from 'rxjs/operators';

import { AnalysisActions } from './analysis.actions';
import { VerseAnalysisService } from '../../services/verse-analysis.service';
import { NotificationService } from '../../core/notification.service';
import { AppState } from '../app.state';
import { selectAnalysisState } from './analysis.selectors';

@Injectable()
export class AnalysisEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private verseAnalysisService = inject(VerseAnalysisService);
  private notificationService = inject(NotificationService);

  // Main analysis effect
  performAnalysis$ = createEffect(() => {
    if (!this.actions$) {
      console.error('Actions service is not available');
      return of();
    }
    return this.actions$.pipe(
      ofType(AnalysisActions.startAnalysis),
      debounceTime(300), // Debounce rapid analysis requests
      switchMap(({ text, options }) => {
        const startTime = performance.now();
        
        return this.verseAnalysisService.analyze(text).pipe(
          map(results => {
            const processingTime = performance.now() - startTime;
            return AnalysisActions.analysisSuccess({ results, processingTime });
          }),
          catchError(error => {
            console.error('Analysis failed:', error);
            return of(AnalysisActions.analysisFailure({ 
              error: error.message || 'Analysis failed' 
            }));
          })
        );
      })
    );
  });

  // Auto-save to history after successful analysis
  autoSaveToHistory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnalysisActions.analysisSuccess),
      withLatestFrom(this.store.select(selectAnalysisState)),
      map(([action, analysisState]) => {
        const analysis = {
          text: analysisState.currentText,
          results: action.results,
          timestamp: Date.now()
        };
        return AnalysisActions.addToHistory({ analysis });
      })
    )
  );

  // Show success notification
  showSuccessNotification$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnalysisActions.analysisSuccess),
      tap(({ results, processingTime }) => {
        const message = `Analysis completed in ${processingTime.toFixed(2)}ms. Found ${results.length} verses.`;
        this.notificationService.showSuccess(message, { duration: 3000 });
      })
    ),
    { dispatch: false }
  );

  // Show error notification
  showErrorNotification$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnalysisActions.analysisFailure),
      tap(({ error }) => {
        this.notificationService.showError(`Analysis failed: ${error}`);
      })
    ),
    { dispatch: false }
  );

  // Cache analysis results
  cacheResults$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnalysisActions.analysisSuccess),
      withLatestFrom(this.store.select(selectAnalysisState)),
      map(([action, analysisState]) => {
        const cacheKey = this.generateCacheKey(analysisState.currentText);
        const ttl = 1000 * 60 * 30; // 30 minutes
        return AnalysisActions.cacheResult({ 
          key: cacheKey, 
          data: action.results, 
          ttl 
        });
      })
    )
  );

  // Batch analysis effect
  performBatchAnalysis$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnalysisActions.startBatchAnalysis),
      switchMap(({ texts, options }) => {
        const total = texts.length;
        let completed = 0;
        const results: any[] = [];

        return of(...texts).pipe(
          switchMap((text, index) =>
            this.verseAnalysisService.analyze(text).pipe(
              map(result => {
                completed++;
                results[index] = result;
                
                if (completed === total) {
                  return AnalysisActions.batchAnalysisComplete({ results });
                } else {
                  return AnalysisActions.batchAnalysisProgress({ 
                    completed, 
                    total, 
                    currentResult: result 
                  });
                }
              }),
              catchError(error => of(AnalysisActions.batchAnalysisError({ 
                error: error.message, 
                failedIndex: index 
              })))
            )
          )
        );
      })
    )
  );

  // Export analysis effect
  exportAnalysis$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnalysisActions.exportAnalysis),
      withLatestFrom(this.store.select(selectAnalysisState)),
      tap(([{ format }, analysisState]) => {
        this.exportToFormat(analysisState, format);
        this.notificationService.showSuccess(`Analysis exported as ${format.toUpperCase()}`);
      })
    ),
    { dispatch: false }
  );

  // Clean expired cache periodically
  cleanExpiredCache$ = createEffect(() =>
    timer(0, 1000 * 60 * 5).pipe( // Every 5 minutes
      map(() => AnalysisActions.invalidateCache({ key: undefined }))
    )
  );

  // Real-time analysis for text changes
  realTimeAnalysis$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnalysisActions.updateText),
      debounceTime(1000), // Wait for 1 second of no typing
      distinctUntilChanged(),
      filter(({ text }) => text.length > 10), // Only analyze substantial text
      switchMap(({ text }) =>
        this.verseAnalysisService.analyze(text).pipe(
          map(results => AnalysisActions.realTimeAnalysisResult({ results })),
          catchError(error => of(AnalysisActions.analysisFailure({ 
            error: error.message 
          })))
        )
      )
    )
  );

  private generateCacheKey(text: string): string {
    // Simple hash function for cache key generation
    let hash = 0;
    if (text.length === 0) return hash.toString();
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return `analysis_${Math.abs(hash)}`;
  }

  private exportToFormat(analysisState: any, format: string): void {
    let content: string;
    let mimeType: string;
    let filename: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(analysisState, null, 2);
        mimeType = 'application/json';
        filename = 'cadentis-analysis.json';
        break;
      case 'csv':
        content = this.convertToCSV(analysisState.results);
        mimeType = 'text/csv';
        filename = 'cadentis-analysis.csv';
        break;
      case 'xml':
        content = this.convertToXML(analysisState);
        mimeType = 'application/xml';
        filename = 'cadentis-analysis.xml';
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    this.downloadFile(content, filename, mimeType);
  }

  private convertToCSV(results: any[]): string {
    if (!results || results.length === 0) return '';
    
    const headers = Object.keys(results[0]);
    const csvRows = [
      headers.join(','),
      ...results.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }

  private convertToXML(analysisState: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<analysis>
  <timestamp>${new Date().toISOString()}</timestamp>
  <text><![CDATA[${analysisState.currentText}]]></text>
  <results>
    ${analysisState.results.map((result: any, index: number) => `
    <verse index="${index}">
      <text><![CDATA[${result.text}]]></text>
      <pattern>${result.meterPattern}</pattern>
      <syllables>${result.syllableCount}</syllables>
      <type>${result.verseType}</type>
    </verse>`).join('')}
  </results>
</analysis>`;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
