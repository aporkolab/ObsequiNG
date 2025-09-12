import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  timestamp: number;
  actions?: { text: string; action: () => void }[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private notificationHistory: Notification[] = [];
  private maxHistorySize = 100;

  constructor(private snackBar: MatSnackBar) {}

  showSuccess(message: string, options: Partial<MatSnackBarConfig> = {}): void {
    this.showNotification(message, 'success', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
      ...options
    });
  }

  showError(message: string, options: Partial<MatSnackBarConfig> = {}): void {
    this.showNotification(message, 'error', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
      ...options
    });
  }

  showWarning(message: string, options: Partial<MatSnackBarConfig> = {}): void {
    this.showNotification(message, 'warning', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['warning-snackbar'],
      ...options
    });
  }

  showInfo(message: string, options: Partial<MatSnackBarConfig> = {}): void {
    this.showNotification(message, 'info', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['info-snackbar'],
      ...options
    });
  }

  showPersistent(message: string, type: Notification['type'] = 'info', actions: Notification['actions'] = []): Notification {
    const notification: Notification = {
      id: this.generateId(),
      message,
      type,
      timestamp: Date.now(),
      actions
    };

    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([...currentNotifications, notification]);
    this.addToHistory(notification);

    return notification;
  }

  dismissNotification(id: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const filtered = currentNotifications.filter(n => n.id !== id);
    this.notificationsSubject.next(filtered);
  }

  clearAll(): void {
    this.notificationsSubject.next([]);
    this.snackBar.dismiss();
  }

  getHistory(): Notification[] {
    return [...this.notificationHistory];
  }

  clearHistory(): void {
    this.notificationHistory = [];
  }

  private showNotification(message: string, type: Notification['type'], config: MatSnackBarConfig): void {
    const notification: Notification = {
      id: this.generateId(),
      message,
      type,
      duration: config.duration,
      timestamp: Date.now()
    };

    this.addToHistory(notification);
    this.snackBar.open(message, 'Close', config);
  }

  private addToHistory(notification: Notification): void {
    this.notificationHistory.unshift(notification);
    
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(0, this.maxHistorySize);
    }
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
