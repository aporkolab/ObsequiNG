import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideRouterStore } from '@ngrx/router-store';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { GlobalErrorHandler } from './core/global-error-handler';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { securityInterceptor } from './core/interceptors/security-functional.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Core Angular providers
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([
        securityInterceptor,
        httpErrorInterceptor,
        loadingInterceptor,
        cacheInterceptor
      ])
    ),
    
    // Error handling
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    
    // NgRx Store
    provideStore(
      {},
      {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true
        }
      }
    ),
    
    // NgRx Effects
    provideEffects([]),
    
    // NgRx Router Store
    provideRouterStore(),
    
    // NgRx Dev Tools (development only)
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
      connectInZone: true
    })
  ]
};
