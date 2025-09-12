import { MetaReducer } from '@ngrx/store';
import { environment } from '../../environments/environment';

// Feature state interfaces
export interface AppNotification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: number;
}

export interface UiState {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  sidebarCollapsed: boolean;
  notifications: AppNotification[];
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
}

export interface UserPreferencesState {
  appSettings: {
    autoSave: boolean;
    enableNotifications: boolean;
    maxHistoryItems: number;
  };
  displaySettings: {
    colorScheme: string;
    compactView: boolean;
  };
}

// Root state interface
export interface AppState {
  ui: UiState;
  userPreferences: UserPreferencesState;
}

// Initial states

export const initialUiState: UiState = {
  theme: 'auto',
  language: 'en',
  sidebarCollapsed: false,
  notifications: [],
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium'
  }
};

export const initialUserPreferencesState: UserPreferencesState = {
  appSettings: {
    autoSave: true,
    enableNotifications: true,
    maxHistoryItems: 50
  },
  displaySettings: {
    colorScheme: 'default',
    compactView: false
  }
};

// Meta reducers for development
export const metaReducers: MetaReducer<AppState>[] = !environment.production
  ? []
  : [];
