import { Pipe, PipeTransform, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from '../../core/services/i18n.service';

@Pipe({
  name: 'translate',
  pure: false // Make it impure so it updates when language changes
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private destroy$ = new Subject<void>();
  private lastKey = '';
  private lastParams: any = null;
  private lastNamespace?: string;
  private lastTranslation = '';

  constructor(private i18nService: I18nService) {
    // Subscribe to language changes to trigger pipe updates
    this.i18nService.currentLanguage$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Force update by clearing cache
      this.lastKey = '';
    });
  }

  transform(key: string, params?: Record<string, any>, namespace?: string): string {
    // Check if we can use cached result
    if (key === this.lastKey && 
        JSON.stringify(params) === JSON.stringify(this.lastParams) && 
        namespace === this.lastNamespace) {
      return this.lastTranslation;
    }

    // Cache current values
    this.lastKey = key;
    this.lastParams = params;
    this.lastNamespace = namespace;
    
    // Get translation
    this.lastTranslation = this.i18nService.translate(key, params, namespace);
    
    return this.lastTranslation;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
