# 🤝 Contributing to ObsequiNG

Welcome to the ObsequiNG project! We're excited to have you contribute to our enterprise-grade Angular application. This document provides comprehensive guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Process](#contributing-process)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Security Guidelines](#security-guidelines)
- [Documentation Standards](#documentation-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## 📜 Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher  
- **Angular CLI**: v17.0.0 or higher
- **Git**: Latest version
- **VS Code**: Recommended editor with Angular extensions

### Environment Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ObsequiNG.git
   cd ObsequiNG
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/APorkolab/ObsequiNG.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Verify setup**:
   ```bash
   npm run test
   npm run lint
   ng serve
   ```

## 🛠️ Development Setup

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "angular.ng-template",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "angular.ng-template"
  ]
}
```

### Development Scripts

```bash
# Start development server
npm start

# Run tests
npm run test
npm run test:watch
npm run test:coverage

# Run E2E tests
npm run e2e

# Lint and format
npm run lint
npm run lint:fix
npm run format

# Build
npm run build
npm run build:prod

# Analyze bundle
npm run analyze

# Security audit
npm run audit
```

## 🔄 Contributing Process

### 1. **Issue First**
- Always create or find an existing issue before starting work
- Discuss your approach in the issue comments
- Get approval from maintainers for significant changes

### 2. **Branch Naming**
Use the following branch naming convention:
```bash
# Feature branches
feature/issue-number-brief-description
feature/123-add-security-dashboard

# Bug fix branches  
bugfix/issue-number-brief-description
bugfix/456-fix-memory-leak

# Documentation branches
docs/issue-number-brief-description
docs/789-update-api-documentation
```

### 3. **Development Workflow**

```bash
# 1. Sync with upstream
git checkout main
git pull upstream main

# 2. Create feature branch
git checkout -b feature/123-your-feature

# 3. Make changes and commit
git add .
git commit -m "feat: add new security feature"

# 4. Keep branch updated
git pull upstream main
git rebase main

# 5. Push to your fork
git push origin feature/123-your-feature

# 6. Create Pull Request
```

## 📝 Code Standards

### TypeScript Standards

- **Strict Mode**: Always use TypeScript strict mode
- **Explicit Types**: Define explicit types for all function parameters and return values
- **No Any**: Avoid `any` type, use proper typing or `unknown`
- **Interfaces**: Use interfaces for object structures
- **Enums**: Use const assertions or enums for constants

```typescript
// ✅ Good
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

function updateUser(user: UserProfile): Observable<UserProfile> {
  // implementation
}

// ❌ Bad
function updateUser(user: any): any {
  // implementation
}
```

### Angular Standards

- **Standalone Components**: Use standalone components for new features
- **OnPush Strategy**: Use OnPush change detection where appropriate
- **Reactive Forms**: Prefer reactive forms over template-driven forms
- **Services**: Use services for business logic and API communication
- **Observables**: Use RxJS observables for asynchronous operations

```typescript
// ✅ Good - Standalone Component
@Component({
  selector: 'app-feature',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`
})
export class FeatureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### SCSS Standards

- **BEM Methodology**: Use BEM naming convention
- **Variables**: Use CSS custom properties for theming
- **Mixins**: Create reusable mixins for common patterns
- **Mobile First**: Write mobile-first responsive styles

```scss
// ✅ Good - BEM + CSS Custom Properties
.feature-card {
  background: var(--surface-color);
  border-radius: var(--border-radius-lg);
  
  &__header {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }
  
  &__content {
    padding: var(--spacing-md);
  }
  
  &--highlighted {
    border: 2px solid var(--primary-color);
  }
}
```

## 🧪 Testing Requirements

### Test Coverage Requirements

- **Minimum Coverage**: 90% for new code
- **Critical Paths**: 100% coverage for security and payment flows
- **Components**: Test all public methods and user interactions
- **Services**: Test all methods and error conditions

### Testing Types

#### 1. **Unit Tests**
```typescript
describe('SecurityService', () => {
  let service: SecurityService;
  
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SecurityService);
  });
  
  it('should detect XSS attempts', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    expect(service.sanitizeInput(maliciousInput)).not.toContain('<script>');
  });
});
```

#### 2. **Integration Tests**
```typescript
describe('Feature Integration', () => {
  it('should complete user workflow', () => {
    // Test complete feature workflow
  });
});
```

#### 3. **E2E Tests**
```typescript
describe('User Journey', () => {
  it('should allow user to complete critical path', () => {
    cy.visit('/');
    cy.get('[data-cy=login-button]').click();
    cy.get('[data-cy=username]').type('testuser');
    cy.get('[data-cy=password]').type('password');
    cy.get('[data-cy=submit]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## 🔒 Security Guidelines

### Security Requirements

- **Input Validation**: Sanitize all user inputs
- **Output Encoding**: Encode all outputs appropriately
- **Authentication**: Implement proper authentication checks
- **Authorization**: Verify user permissions for actions
- **HTTPS**: Ensure all communications use HTTPS
- **Dependencies**: Keep dependencies updated and audit regularly

### Security Checklist

- [ ] All user inputs are validated and sanitized
- [ ] No sensitive data in console logs
- [ ] HTTPS enforced in production
- [ ] CSP headers implemented
- [ ] No hardcoded secrets or API keys
- [ ] Regular dependency security audits
- [ ] Error messages don't leak sensitive information

### Reporting Security Issues

🚨 **Do not open public issues for security vulnerabilities**

Email security issues to: `security@cadentis.dev` (if available) or create a private security advisory on GitHub.

## 📚 Documentation Standards

### Documentation Requirements

- **API Documentation**: Document all public APIs with JSDoc
- **Component Documentation**: Document component inputs, outputs, and usage
- **Service Documentation**: Document service methods and their purposes
- **README Updates**: Update relevant README sections for new features

### JSDoc Examples

```typescript
/**
 * Validates and sanitizes user input to prevent XSS attacks
 * @param input - The raw user input to be sanitized
 * @param options - Configuration options for sanitization
 * @returns The sanitized input safe for display
 * @throws {ValidationError} When input contains malicious content
 * @example
 * ```typescript
 * const safe = sanitizeInput('<script>alert("xss")</script>');
 * console.log(safe); // '&lt;script&gt;alert("xss")&lt;/script&gt;'
 * ```
 */
public sanitizeInput(input: string, options?: SanitizationOptions): string {
  // implementation
}
```

## 🔍 Pull Request Process

### Before Creating a PR

1. **Code Quality**:
   ```bash
   npm run lint
   npm run format
   npm run test
   npm run build
   ```

2. **Security Check**:
   ```bash
   npm audit
   npm run security-scan
   ```

3. **Documentation**:
   - Update relevant documentation
   - Add JSDoc comments for new public APIs
   - Update CHANGELOG.md if needed

### PR Requirements

#### PR Title Format
```
type(scope): brief description

Examples:
feat(security): add rate limiting middleware
fix(analytics): resolve memory leak in event tracking
docs(api): update authentication examples
```

#### PR Description Template
```markdown
## 🎯 Purpose
Brief description of what this PR does and why.

## 🔄 Changes Made
- List of specific changes
- Breaking changes (if any)
- New dependencies added

## 🧪 Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## 🔒 Security
- [ ] No sensitive data exposed
- [ ] Input validation implemented
- [ ] Security audit passed

## 📚 Documentation
- [ ] Code commented
- [ ] API documentation updated
- [ ] README updated (if needed)

## ✅ Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass
- [ ] No merge conflicts
- [ ] Reviewers assigned
```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer approval required
3. **Security Review**: Security-sensitive changes need security team approval
4. **Documentation Review**: Documentation changes reviewed by docs team

## 🐛 Issue Guidelines

### Bug Reports

Use the bug report template and include:
- **Environment**: Browser, OS, Node.js version
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: Visual evidence when applicable
- **Console Logs**: Relevant error messages

### Feature Requests

Use the feature request template and include:
- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: Your suggested approach
- **Alternatives Considered**: Other solutions you've thought about
- **Additional Context**: Screenshots, examples, etc.

### Issue Labels

- **Type**: `bug`, `feature`, `documentation`, `security`
- **Priority**: `critical`, `high`, `medium`, `low`
- **Status**: `needs-triage`, `in-progress`, `blocked`, `ready`
- **Area**: `frontend`, `backend`, `infrastructure`, `testing`

## 🏆 Recognition

Contributors who make significant contributions will be:
- Added to the CONTRIBUTORS.md file
- Mentioned in release notes
- Invited to join the project team (for consistent contributors)

## 📞 Getting Help

### Communication Channels

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: For private or security-related communications

### Resources

- [Angular Style Guide](https://angular.io/guide/styleguide)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [RxJS Documentation](https://rxjs.dev)
- [Angular Testing Guide](https://angular.io/guide/testing)

---

## 📝 Final Notes

- **Be Patient**: Code reviews take time, please be patient with maintainers
- **Be Respectful**: Treat all community members with respect
- **Be Collaborative**: Work together to make the project better
- **Have Fun**: Enjoy the process of contributing to open source!

Thank you for contributing to Cadentis! 🎉

---

*This contributing guide is a living document and may be updated periodically. Contributors will be notified of significant changes.*
