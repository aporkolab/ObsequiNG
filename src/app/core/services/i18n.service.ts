import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag?: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
    grouping: number[];
  };
  currency: {
    code: string;
    symbol: string;
    position: 'before' | 'after';
  };
}

export interface TranslationNamespace {
  [key: string]: string | TranslationNamespace;
}

export type TranslationData = Record<string, TranslationNamespace>;

export interface LocaleFormats {
  date: {
    short: string;
    medium: string;
    long: string;
    full: string;
  };
  time: {
    short: string;
    medium: string;
    long: string;
    full: string;
  };
  currency: {
    symbol: string;
    code: string;
    display: 'symbol' | 'code' | 'symbol-narrow';
  };
  number: {
    minimumIntegerDigits?: number;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class I18nService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private translations = new Map<string, TranslationData>();
  private fallbackTranslations: TranslationData = {};
  
  private currentLanguageSubject = new BehaviorSubject<string>('en');
  private directionSubject = new BehaviorSubject<'ltr' | 'rtl'>('ltr');
  private loadingSubject = new BehaviorSubject<boolean>(false);
  
  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  public direction$ = this.directionSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  
  private languageConfigs: LanguageConfig[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      direction: 'ltr',
      flag: '🇺🇸',
      dateFormat: 'MM/dd/yyyy',
      timeFormat: 'h:mm a',
      numberFormat: { decimal: '.', thousands: ',', grouping: [3] },
      currency: { code: 'USD', symbol: '$', position: 'before' }
    },
    {
      code: 'es',
      name: 'Spanish',
      nativeName: 'Español',
      direction: 'ltr',
      flag: '🇪🇸',
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm',
      numberFormat: { decimal: ',', thousands: '.', grouping: [3] },
      currency: { code: 'EUR', symbol: '€', position: 'after' }
    },
    {
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      direction: 'ltr',
      flag: '🇫🇷',
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm',
      numberFormat: { decimal: ',', thousands: ' ', grouping: [3] },
      currency: { code: 'EUR', symbol: '€', position: 'after' }
    },
    {
      code: 'de',
      name: 'German',
      nativeName: 'Deutsch',
      direction: 'ltr',
      flag: '🇩🇪',
      dateFormat: 'dd.MM.yyyy',
      timeFormat: 'HH:mm',
      numberFormat: { decimal: ',', thousands: '.', grouping: [3] },
      currency: { code: 'EUR', symbol: '€', position: 'after' }
    },
    {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      direction: 'rtl',
      flag: '🇸🇦',
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'h:mm a',
      numberFormat: { decimal: '٫', thousands: '٬', grouping: [3] },
      currency: { code: 'SAR', symbol: 'ر.س', position: 'before' }
    },
    {
      code: 'zh',
      name: 'Chinese',
      nativeName: '中文',
      direction: 'ltr',
      flag: '🇨🇳',
      dateFormat: 'yyyy/MM/dd',
      timeFormat: 'HH:mm',
      numberFormat: { decimal: '.', thousands: ',', grouping: [3] },
      currency: { code: 'CNY', symbol: '¥', position: 'before' }
    }
  ];
  
  constructor() {
    this.initializeLanguage();
    this.setupDirectionHandling();
  }
  
  // Language management
  get currentLanguage(): string {
    return this.currentLanguageSubject.value;
  }
  
  get currentDirection(): 'ltr' | 'rtl' {
    return this.directionSubject.value;
  }
  
  getAvailableLanguages(): LanguageConfig[] {
    return [...this.languageConfigs];
  }
  
  getLanguageConfig(code: string): LanguageConfig | undefined {
    return this.languageConfigs.find(lang => lang.code === code);
  }
  
  async setLanguage(languageCode: string): Promise<void> {
    if (languageCode === this.currentLanguage) {
      return;
    }
    
    const config = this.getLanguageConfig(languageCode);
    if (!config) {
      console.error(`Language ${languageCode} not supported`);
      return;
    }
    
    this.loadingSubject.next(true);
    
    try {
      await this.loadTranslations(languageCode);
      
      this.currentLanguageSubject.next(languageCode);
      this.directionSubject.next(config.direction);
      
      // Persist language preference
      localStorage.setItem('preferred-language', languageCode);
      
      // Update HTML lang and dir attributes
      document.documentElement.lang = languageCode;
      document.documentElement.dir = config.direction;
      
    } catch (error) {
      console.error('Failed to load translations:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }
  
  // Translation methods
  translate(key: string, params?: Record<string, any>, namespace?: string): string {
    const currentTranslations = this.translations.get(this.currentLanguage) || {};
    const fallbackTranslations = this.fallbackTranslations;
    
    let translation = this.getNestedTranslation(currentTranslations, key, namespace) ||
                     this.getNestedTranslation(fallbackTranslations, key, namespace) ||
                     key;
    
    // Handle pluralization
    if (params && 'count' in params) {
      translation = this.handlePluralization(translation, params.count as number);
    }
    
    // Replace parameters
    if (params) {
      translation = this.replaceParams(translation, params);
    }
    
    return translation;
  }
  
  t(key: string, params?: Record<string, any>, namespace?: string): string {
    return this.translate(key, params, namespace);
  }
  
  // Async translation loading
  async loadTranslations(languageCode: string): Promise<void> {
    if (this.translations.has(languageCode)) {
      return;
    }
    
    try {
      // In a real app, these would be loaded from files or API
      const translations = await this.fetchTranslations(languageCode);
      this.translations.set(languageCode, translations);
      
      // Load fallback if it's the first language
      if (this.translations.size === 1) {
        this.fallbackTranslations = translations;
      }
    } catch (error) {
      console.error(`Failed to load translations for ${languageCode}:`, error);
      throw error;
    }
  }
  
  // Locale formatting
  formatDate(date: Date | string | number, format: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
    const dateObj = new Date(date);
    
    try {
      const formatter = new Intl.DateTimeFormat(this.currentLanguage, this.getDateFormatOptions(format));
      return formatter.format(dateObj);
    } catch (error) {
      // Fallback formatting
      return dateObj.toLocaleDateString(this.currentLanguage);
    }
  }
  
  formatTime(date: Date | string | number, format: 'short' | 'medium' | 'long' | 'full' = 'short'): string {
    const dateObj = new Date(date);
    
    try {
      const formatter = new Intl.DateTimeFormat(this.currentLanguage, this.getTimeFormatOptions(format));
      return formatter.format(dateObj);
    } catch (error) {
      return dateObj.toLocaleTimeString(this.currentLanguage);
    }
  }
  
  formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
    try {
      const formatter = new Intl.NumberFormat(this.currentLanguage, options);
      return formatter.format(num);
    } catch (error) {
      return num.toString();
    }
  }
  
  formatCurrency(amount: number, currencyCode?: string): string {
    const config = this.getLanguageConfig(this.currentLanguage);
    const currency = currencyCode || config?.currency.code || 'USD';
    
    try {
      const formatter = new Intl.NumberFormat(this.currentLanguage, {
        style: 'currency',
        currency: currency
      });
      return formatter.format(amount);
    } catch (error) {
      const symbol = config?.currency.symbol || '$';
      return config?.currency.position === 'before' 
        ? `${symbol}${amount}` 
        : `${amount}${symbol}`;
    }
  }
  
  // Pluralization
  private handlePluralization(text: string, count: number): string {
    const pluralRules = new Intl.PluralRules(this.currentLanguage);
    const rule = pluralRules.select(count);
    
    // Simple pluralization format: "singular|plural" or "zero|one|few|many|other"
    const forms = text.split('|');
    
    if (forms.length === 2) {
      return count === 1 ? forms[0] : forms[1];
    }
    
    // Full ICU pluralization
    const ruleIndex = ['zero', 'one', 'two', 'few', 'many', 'other'].indexOf(rule);
    return forms[ruleIndex] || forms[forms.length - 1] || text;
  }
  
  // Parameter replacement
  private replaceParams(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = params[key.trim()];
      return value !== undefined ? String(value) : match;
    });
  }
  
  // Translation lookup
  private getNestedTranslation(translations: TranslationData, key: string, namespace?: string): string | null {
    const keys = namespace ? `${namespace}.${key}`.split('.') : key.split('.');
    let current: any = translations;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }
    
    return typeof current === 'string' ? current : null;
  }
  
  // Translation management
  addTranslations(languageCode: string, translations: TranslationData): void {
    const existing = this.translations.get(languageCode) || {};
    const merged = this.deepMerge(existing, translations);
    this.translations.set(languageCode, merged);
  }
  
  removeTranslations(languageCode: string): void {
    this.translations.delete(languageCode);
  }
  
  hasTranslations(languageCode: string): boolean {
    return this.translations.has(languageCode);
  }
  
  // Browser language detection
  detectBrowserLanguage(): string {
    const browserLang = navigator.language || (navigator as any).userLanguage;
    const langCode = browserLang.split('-')[0].toLowerCase();
    
    // Check if we support this language
    const supportedLang = this.languageConfigs.find(lang => lang.code === langCode);
    return supportedLang ? langCode : 'en';
  }
  
  // RTL support
  isRTL(languageCode?: string): boolean {
    const code = languageCode || this.currentLanguage;
    const config = this.getLanguageConfig(code);
    return config?.direction === 'rtl' || false;
  }
  
  // Export/Import
  exportTranslations(languageCode: string): TranslationData | null {
    return this.translations.get(languageCode) || null;
  }
  
  importTranslations(languageCode: string, translations: TranslationData): void {
    this.translations.set(languageCode, translations);
  }
  
  private async fetchTranslations(languageCode: string): Promise<TranslationData> {
    // Mock implementation - in real app, this would fetch from API or files
    const mockTranslations: Record<string, TranslationData> = {
      en: {
        common: {
          yes: 'Yes',
          no: 'No',
          ok: 'OK',
          cancel: 'Cancel',
          save: 'Save',
          delete: 'Delete',
          edit: 'Edit',
          add: 'Add',
          search: 'Search',
          loading: 'Loading...',
          error: 'An error occurred',
          success: 'Success',
          warning: 'Warning',
          info: 'Information'
        },
        messages: {
          welcome: 'Welcome to our application',
          itemCount: 'You have {{count}} item|You have {{count}} items'
        }
      },
      es: {
        common: {
          yes: 'Sí',
          no: 'No',
          ok: 'OK',
          cancel: 'Cancelar',
          save: 'Guardar',
          delete: 'Eliminar',
          edit: 'Editar',
          add: 'Agregar',
          search: 'Buscar',
          loading: 'Cargando...',
          error: 'Se produjo un error',
          success: 'Éxito',
          warning: 'Advertencia',
          info: 'Información'
        },
        messages: {
          welcome: 'Bienvenido a nuestra aplicación',
          itemCount: 'Tienes {{count}} elemento|Tienes {{count}} elementos'
        }
      }
    };
    
    return mockTranslations[languageCode] || mockTranslations.en;
  }
  
  private initializeLanguage(): void {
    const savedLanguage = localStorage.getItem('preferred-language');
    const browserLanguage = this.detectBrowserLanguage();
    const initialLanguage = savedLanguage || browserLanguage;
    
    this.setLanguage(initialLanguage).catch(console.error);
  }
  
  private setupDirectionHandling(): void {
    this.direction$.pipe(takeUntil(this.destroy$)).subscribe(direction => {
      document.documentElement.dir = direction;
      document.body.classList.toggle('rtl', direction === 'rtl');
      document.body.classList.toggle('ltr', direction === 'ltr');
    });
  }
  
  private getDateFormatOptions(format: string): Intl.DateTimeFormatOptions {
    const options: Record<string, Intl.DateTimeFormatOptions> = {
      short: { year: 'numeric', month: 'numeric', day: 'numeric' },
      medium: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
      full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    };
    return options[format] || options.medium;
  }
  
  private getTimeFormatOptions(format: string): Intl.DateTimeFormatOptions {
    const options: Record<string, Intl.DateTimeFormatOptions> = {
      short: { hour: 'numeric', minute: 'numeric' },
      medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
      long: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' },
      full: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'long' }
    };
    return options[format] || options.short;
  }
  
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
