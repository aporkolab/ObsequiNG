import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-container">
        <a routerLink="/home" class="nav-brand">ObsequiNG</a>
        <div class="nav-links">
          <a routerLink="/home" routerLinkActive="active">Home</a>
          <a routerLink="/security" routerLinkActive="active">Security</a>
          <a routerLink="/testing" routerLinkActive="active">Testing</a>
          <a routerLink="/pwa" routerLinkActive="active">PWA</a>
          <a routerLink="/analytics" routerLinkActive="active">Analytics</a>
          <a routerLink="/documentation" routerLinkActive="active">Docs & DevOps</a>
        </div>
      </div>
    </nav>
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .navbar {
      background: #2c3e50;
      padding: 1rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
    }
    
    .nav-brand {
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
      text-decoration: none;
    }
    
    .nav-links {
      display: flex;
      gap: 2rem;
    }
    
    .nav-links a {
      color: #bdc3c7;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      transition: all 0.3s ease;
    }
    
    .nav-links a:hover,
    .nav-links a.active {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .main-content {
      min-height: calc(100vh - 80px);
      background: #ecf0f1;
    }
  `]
})
export class AppComponent {
  title = 'ObsequiNG';
}
