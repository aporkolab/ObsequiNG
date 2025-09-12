import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  announcePageChanges: boolean;
  focusIndicators: boolean;
  skipLinks: boolean;
  keyboardNavigation: boolean;
  screenReaderOptimizations: boolean;
}

export interface FocusInfo {
  element: HTMLElement;
  elementType: string;
  label?: string;
  role?: string;
  describedBy?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private renderer: Renderer2;
  private settings = new BehaviorSubject<AccessibilitySettings>({
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium',
    announcePageChanges: true,
    focusIndicators: true,
    skipLinks: true,
    keyboardNavigation: true,
    screenReaderOptimizations: true
  });

  private announcements = new BehaviorSubject<string>('');
  private focusedElement = new BehaviorSubject<FocusInfo | null>(null);

  public settings$ = this.settings.asObservable();
  public announcements$ = this.announcements.asObservable();
  public focusedElement$ = this.focusedElement.asObservable();

  constructor(private rendererFactory: RendererFactory2) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this.initializeAccessibility();
  }

  // Settings management
  updateSettings(newSettings: Partial<AccessibilitySettings>): void {
    const current = this.settings.value;
    const updated = { ...current, ...newSettings };
    this.settings.next(updated);
    this.applySettings(updated);
    this.saveSettingsToStorage(updated);
  }

  // Announcements for screen readers
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.announcements.next(message);
    this.updateAriaLiveRegion(message, priority);
  }

  // Focus management
  setFocus(element: HTMLElement, announce = true): void {
    if (!element) return;

    element.focus();
    
    const focusInfo = this.extractFocusInfo(element);
    this.focusedElement.next(focusInfo);
    
    if (announce && focusInfo.label) {
      this.announce(`Focused on ${focusInfo.label}`, 'polite');
    }
  }

  // Keyboard navigation
  setupKeyboardNavigation(): void {
    const keyboardEvents$ = fromEvent<KeyboardEvent>(document, 'keydown');
    
    keyboardEvents$.subscribe(event => {
      this.handleGlobalKeyboardEvents(event);
    });
    
    // Tab trap management
    this.setupTabTrapping();
  }

  // Skip links
  addSkipLink(targetId: string, linkText: string): void {
    const skipLink = this.renderer.createElement('a');
    this.renderer.setAttribute(skipLink, 'href', `#${targetId}`);
    this.renderer.setAttribute(skipLink, 'class', 'skip-link');
    this.renderer.setProperty(skipLink, 'textContent', linkText);
    
    this.renderer.addEventListener(skipLink, 'focus', () => {
      this.renderer.addClass(skipLink, 'visible');
    });
    
    this.renderer.addEventListener(skipLink, 'blur', () => {
      this.renderer.removeClass(skipLink, 'visible');
    });
    
    const body = document.body;
    this.renderer.insertBefore(body, skipLink, body.firstChild);
  }

  // Heading structure analysis
  analyzeHeadingStructure(): { isValid: boolean; issues: string[] } {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const issues: string[] = [];
    let isValid = true;
    
    // Check for h1
    const h1Elements = headings.filter(h => h.tagName === 'H1');
    if (h1Elements.length === 0) {
      issues.push('Page should have exactly one H1 element');
      isValid = false;
    } else if (h1Elements.length > 1) {
      issues.push('Page should not have multiple H1 elements');
      isValid = false;
    }
    
    // Check heading hierarchy
    let previousLevel = 0;
    for (const heading of headings) {
      const currentLevel = parseInt(heading.tagName.substr(1), 10);
      
      if (currentLevel > previousLevel + 1 && previousLevel !== 0) {
        issues.push(`Heading level jumps from H${previousLevel} to H${currentLevel}`);
        isValid = false;
      }
      
      previousLevel = currentLevel;
    }
    
    return { isValid, issues };
  }

  // Color contrast checking
  checkColorContrast(element: HTMLElement): { ratio: number; isAACompliant: boolean; isAAACompliant: boolean } {
    const styles = getComputedStyle(element);
    const backgroundColor = styles.backgroundColor;
    const textColor = styles.color;
    
    const ratio = this.calculateContrastRatio(textColor, backgroundColor);
    
    return {
      ratio,
      isAACompliant: ratio >= 4.5,
      isAAACompliant: ratio >= 7
    };
  }

  // Image alt text analysis
  analyzeImages(): { totalImages: number; missingAlt: number; emptyAlt: number; goodAlt: number } {
    const images = Array.from(document.querySelectorAll('img'));
    let missingAlt = 0;
    let emptyAlt = 0;
    let goodAlt = 0;
    
    images.forEach(img => {
      const alt = img.getAttribute('alt');
      if (alt === null) {
        missingAlt++;
      } else if (alt.trim() === '') {
        emptyAlt++;
      } else {
        goodAlt++;
      }
    });
    
    return {
      totalImages: images.length,
      missingAlt,
      emptyAlt,
      goodAlt
    };
  }

  // Form accessibility
  validateForm(form: HTMLFormElement): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach((input: Element) => {
      const htmlInput = input as HTMLInputElement;
      
      // Check for labels
      const label = form.querySelector(`label[for="${htmlInput.id}"]`) || 
                   htmlInput.closest('label');
      
      if (!label && !htmlInput.getAttribute('aria-label') && !htmlInput.getAttribute('aria-labelledby')) {
        issues.push(`Input "${htmlInput.name || htmlInput.type}" lacks proper labeling`);
      }
      
      // Check required fields
      if (htmlInput.hasAttribute('required') && !htmlInput.getAttribute('aria-required')) {
        issues.push(`Required field "${htmlInput.name}" should have aria-required attribute`);
      }
    });
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // Generate accessibility report
  generateAccessibilityReport(): {
    headings: ReturnType<typeof this.analyzeHeadingStructure>;
    images: ReturnType<typeof this.analyzeImages>;
    forms: { formCount: number; issues: string[] };
    landmarks: { count: number; types: string[] };
  } {
    const headings = this.analyzeHeadingStructure();
    const images = this.analyzeImages();
    
    const forms = Array.from(document.querySelectorAll('form'));
    const formIssues: string[] = [];
    forms.forEach(form => {
      const validation = this.validateForm(form);
      formIssues.push(...validation.issues);
    });
    
    const landmarks = Array.from(document.querySelectorAll('[role], main, nav, aside, header, footer'));
    const landmarkTypes = [...new Set(landmarks.map(el => 
      el.getAttribute('role') || el.tagName.toLowerCase()
    ))];
    
    return {
      headings,
      images,
      forms: {
        formCount: forms.length,
        issues: formIssues
      },
      landmarks: {
        count: landmarks.length,
        types: landmarkTypes
      }
    };
  }

  private initializeAccessibility(): void {
    this.loadSettingsFromStorage();
    this.detectSystemPreferences();
    this.setupAriaLiveRegion();
    this.setupKeyboardNavigation();
    this.monitorFocusChanges();
  }

  private loadSettingsFromStorage(): void {
    try {
      const stored = localStorage.getItem('accessibility-settings');
      if (stored) {
        const settings = JSON.parse(stored);
        this.updateSettings(settings);
      }
    } catch (error) {
      console.warn('Failed to load accessibility settings from storage:', error);
    }
  }

  private saveSettingsToStorage(settings: AccessibilitySettings): void {
    try {
      localStorage.setItem('accessibility-settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save accessibility settings to storage:', error);
    }
  }

  private detectSystemPreferences(): void {
    // Detect reduced motion preference
    if (window.matchMedia) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (prefersReducedMotion.matches) {
        this.updateSettings({ reducedMotion: true });
      }
      
      // Detect high contrast preference
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
      if (prefersHighContrast.matches) {
        this.updateSettings({ highContrast: true });
      }
    }
  }

  private applySettings(settings: AccessibilitySettings): void {
    const root = document.documentElement;
    
    // Apply high contrast
    if (settings.highContrast) {
      this.renderer.addClass(root, 'high-contrast');
    } else {
      this.renderer.removeClass(root, 'high-contrast');
    }
    
    // Apply reduced motion
    if (settings.reducedMotion) {
      this.renderer.addClass(root, 'reduced-motion');
    } else {
      this.renderer.removeClass(root, 'reduced-motion');
    }
    
    // Apply font size
    this.renderer.removeClass(root, 'font-small');
    this.renderer.removeClass(root, 'font-medium');
    this.renderer.removeClass(root, 'font-large');
    this.renderer.removeClass(root, 'font-x-large');
    this.renderer.addClass(root, `font-${settings.fontSize}`);
    
    // Apply focus indicators
    if (settings.focusIndicators) {
      this.renderer.addClass(root, 'enhanced-focus');
    } else {
      this.renderer.removeClass(root, 'enhanced-focus');
    }
  }

  private setupAriaLiveRegion(): void {
    const liveRegion = this.renderer.createElement('div');
    this.renderer.setAttribute(liveRegion, 'id', 'aria-live-region');
    this.renderer.setAttribute(liveRegion, 'aria-live', 'polite');
    this.renderer.setAttribute(liveRegion, 'aria-atomic', 'true');
    this.renderer.setStyle(liveRegion, 'position', 'absolute');
    this.renderer.setStyle(liveRegion, 'left', '-10000px');
    this.renderer.setStyle(liveRegion, 'width', '1px');
    this.renderer.setStyle(liveRegion, 'height', '1px');
    this.renderer.setStyle(liveRegion, 'overflow', 'hidden');
    
    this.renderer.appendChild(document.body, liveRegion);
  }

  private updateAriaLiveRegion(message: string, priority: 'polite' | 'assertive'): void {
    const liveRegion = document.getElementById('aria-live-region');
    if (liveRegion) {
      this.renderer.setAttribute(liveRegion, 'aria-live', priority);
      this.renderer.setProperty(liveRegion, 'textContent', message);
    }
  }

  private extractFocusInfo(element: HTMLElement): FocusInfo {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    // const ariaLabelledBy = element.getAttribute('aria-labelledby');
    const label = element.querySelector('label')?.textContent?.trim() || 
                 document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim();
    
    return {
      element,
      elementType: role || tagName,
      label: ariaLabel || label || element.textContent?.trim() || `${tagName} element`,
      role,
      describedBy: element.getAttribute('aria-describedby') || undefined
    };
  }

  private monitorFocusChanges(): void {
    fromEvent(document, 'focusin').pipe(
      map(event => event.target as HTMLElement),
      distinctUntilChanged()
    ).subscribe(element => {
      if (element) {
        const focusInfo = this.extractFocusInfo(element);
        this.focusedElement.next(focusInfo);
      }
    });
  }

  private handleGlobalKeyboardEvents(event: KeyboardEvent): void {
    const settings = this.settings.value;
    
    if (!settings.keyboardNavigation) return;
    
    // Escape key handling
    if (event.key === 'Escape') {
      this.handleEscapeKey(event);
    }
    
    // Skip links with Alt+S
    if (event.altKey && event.key === 's') {
      event.preventDefault();
      this.focusSkipLinks();
    }
    
    // Help dialog with F1 or Alt+H
    if (event.key === 'F1' || (event.altKey && event.key === 'h')) {
      event.preventDefault();
      this.showKeyboardHelp();
    }
  }

  private setupTabTrapping(): void {
    // Implementation for modal tab trapping would go here
    // This is a simplified version
  }

  private handleEscapeKey(_event: KeyboardEvent): void {
    // Close modals, dropdowns, etc.
    const openModal = document.querySelector('[role="dialog"][aria-hidden="false"]');
    if (openModal) {
      // Emit close event or call close method
      this.announce('Dialog closed', 'polite');
    }
  }

  private focusSkipLinks(): void {
    const skipLink = document.querySelector('.skip-link') as HTMLElement;
    if (skipLink) {
      skipLink.focus();
    }
  }

  private showKeyboardHelp(): void {
    this.announce('Keyboard help: Use Tab to navigate, Enter to activate, Escape to close dialogs, Alt+S for skip links');
  }

  private calculateContrastRatio(_color1: string, _color2: string): number {
    // Simplified contrast ratio calculation
    // In a real implementation, you'd parse RGB values and use the WCAG formula
    return 4.5; // Placeholder
  }
}
