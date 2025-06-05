/**
 * Semantic analyzer for understanding code domains, frameworks, and patterns
 */
export class SemanticAnalyzer {
  
  /**
   * Determine the domain/category of the code file
   */
  static determineDomain(content: string, filePath: string): string {
    const path = filePath.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // API/Backend domain
    if (path.includes('/api/') || path.includes('\\api\\') || 
        contentLower.includes('express') || contentLower.includes('fastify') ||
        contentLower.includes('router') || contentLower.includes('endpoint')) {
      return 'api';
    }
    
    // Authentication domain
    if (path.includes('auth') || contentLower.includes('authentication') ||
        contentLower.includes('login') || contentLower.includes('signup') ||
        contentLower.includes('jwt') || contentLower.includes('session')) {
      return 'authentication';
    }
    
    // Database domain
    if (path.includes('db') || path.includes('database') || 
        contentLower.includes('prisma') || contentLower.includes('supabase') ||
        contentLower.includes('mongoose') || contentLower.includes('sql')) {
      return 'database';
    }
    
    // UI/Component domain
    if (path.includes('component') || path.includes('ui') ||
        contentLower.includes('react') || contentLower.includes('jsx') ||
        contentLower.includes('tsx') || contentLower.includes('vue')) {
      return 'ui';
    }
    
    // Utility domain
    if (path.includes('util') || path.includes('helper') ||
        contentLower.includes('utility') || contentLower.includes('helper')) {
      return 'utility';
    }
    
    // Configuration domain
    if (path.includes('config') || path.includes('setting') ||
        contentLower.includes('configuration') || contentLower.includes('env')) {
      return 'configuration';
    }
    
    // Testing domain
    if (path.includes('test') || path.includes('spec') ||
        contentLower.includes('jest') || contentLower.includes('vitest')) {
      return 'testing';
    }
    
    return 'general';
  }
  
  /**
   * Detect frameworks and libraries used in the code
   */
  static detectFrameworks(content: string, filePath: string): string[] {
    const frameworks: string[] = [];
    const contentLower = content.toLowerCase();
    const path = filePath.toLowerCase();
    
    // React ecosystem
    if (contentLower.includes('react') || contentLower.includes('jsx') || 
        contentLower.includes('usestate') || contentLower.includes('useeffect')) {
      frameworks.push('react');
    }
    
    // Next.js
    if (contentLower.includes('next') || path.includes('pages/') || 
        path.includes('app/') || contentLower.includes('getserversideprops')) {
      frameworks.push('nextjs');
    }
    
    // Express.js
    if (contentLower.includes('express') || contentLower.includes('app.get') ||
        contentLower.includes('app.post') || contentLower.includes('middleware')) {
      frameworks.push('express');
    }
    
    // Supabase
    if (contentLower.includes('supabase') || contentLower.includes('createclient')) {
      frameworks.push('supabase');
    }
    
    // Prisma
    if (contentLower.includes('prisma') || contentLower.includes('prismaclient')) {
      frameworks.push('prisma');
    }
    
    // TypeScript
    if (path.endsWith('.ts') || path.endsWith('.tsx') || 
        contentLower.includes('interface') || contentLower.includes('type ')) {
      frameworks.push('typescript');
    }
    
    // Tailwind CSS
    if (contentLower.includes('tailwind') || contentLower.includes('tw-') ||
        contentLower.includes('className=')) {
      frameworks.push('tailwindcss');
    }
    
    return frameworks;
  }
  
  /**
   * Detect code patterns and architectural patterns
   */
  static detectCodePatterns(content: string, filePath: string): string[] {
    const patterns: string[] = [];
    const contentLower = content.toLowerCase();
    
    // Hook pattern
    if (contentLower.includes('use') && (contentLower.includes('function use') || 
        contentLower.includes('const use') || contentLower.includes('export function use'))) {
      patterns.push('hook');
    }
    
    // Component pattern
    if (contentLower.includes('component') || contentLower.includes('jsx') ||
        contentLower.includes('return (') || contentLower.includes('render')) {
      patterns.push('component');
    }
    
    // Service pattern
    if (contentLower.includes('service') || contentLower.includes('api') ||
        contentLower.includes('fetch') || contentLower.includes('axios')) {
      patterns.push('service');
    }
    
    // Utility pattern
    if (contentLower.includes('util') || contentLower.includes('helper') ||
        filePath.toLowerCase().includes('util')) {
      patterns.push('utility');
    }
    
    // Middleware pattern
    if (contentLower.includes('middleware') || contentLower.includes('next()') ||
        contentLower.includes('req, res, next')) {
      patterns.push('middleware');
    }
    
    // Repository pattern
    if (contentLower.includes('repository') || contentLower.includes('repo') ||
        contentLower.includes('findall') || contentLower.includes('findone')) {
      patterns.push('repository');
    }
    
    // Factory pattern
    if (contentLower.includes('factory') || contentLower.includes('create') ||
        contentLower.includes('builder')) {
      patterns.push('factory');
    }
    
    return patterns;
  }
  
  /**
   * Extract semantic concepts from the code
   */
  static extractConcepts(content: string, filePath: string): string[] {
    const concepts: string[] = [];
    const contentLower = content.toLowerCase();
    const path = filePath.toLowerCase();
    
    // User management concepts
    if (contentLower.includes('user') || contentLower.includes('profile') ||
        contentLower.includes('account') || contentLower.includes('customer')) {
      concepts.push('user-management');
    }
    
    // Authentication concepts
    if (contentLower.includes('auth') || contentLower.includes('login') ||
        contentLower.includes('signup') || contentLower.includes('token')) {
      concepts.push('authentication');
    }
    
    // Data fetching concepts
    if (contentLower.includes('fetch') || contentLower.includes('api') ||
        contentLower.includes('query') || contentLower.includes('mutation')) {
      concepts.push('data-fetching');
    }
    
    // Form handling concepts
    if (contentLower.includes('form') || contentLower.includes('input') ||
        contentLower.includes('validation') || contentLower.includes('submit')) {
      concepts.push('form-handling');
    }
    
    // State management concepts
    if (contentLower.includes('state') || contentLower.includes('redux') ||
        contentLower.includes('context') || contentLower.includes('store')) {
      concepts.push('state-management');
    }
    
    // Routing concepts
    if (contentLower.includes('route') || contentLower.includes('router') ||
        contentLower.includes('navigation') || path.includes('pages/')) {
      concepts.push('routing');
    }
    
    // File handling concepts
    if (contentLower.includes('file') || contentLower.includes('upload') ||
        contentLower.includes('download') || contentLower.includes('storage')) {
      concepts.push('file-handling');
    }
    
    return concepts;
  }
  
  /**
   * Extract business logic concepts
   */
  static extractBusinessLogic(content: string, _filePath: string): string[] {
    const businessLogic: string[] = [];
    const contentLower = content.toLowerCase();
    
    // Payment processing
    if (contentLower.includes('payment') || contentLower.includes('stripe') ||
        contentLower.includes('paypal') || contentLower.includes('billing')) {
      businessLogic.push('payment-processing');
    }
    
    // User registration
    if (contentLower.includes('register') || contentLower.includes('signup') ||
        contentLower.includes('onboard') || contentLower.includes('welcome')) {
      businessLogic.push('user-registration');
    }
    
    // Content management
    if (contentLower.includes('content') || contentLower.includes('post') ||
        contentLower.includes('article') || contentLower.includes('blog')) {
      businessLogic.push('content-management');
    }
    
    // E-commerce
    if (contentLower.includes('product') || contentLower.includes('cart') ||
        contentLower.includes('order') || contentLower.includes('checkout')) {
      businessLogic.push('e-commerce');
    }
    
    // Analytics
    if (contentLower.includes('analytics') || contentLower.includes('tracking') ||
        contentLower.includes('metrics') || contentLower.includes('report')) {
      businessLogic.push('analytics');
    }
    
    // Notification system
    if (contentLower.includes('notification') || contentLower.includes('email') ||
        contentLower.includes('sms') || contentLower.includes('alert')) {
      businessLogic.push('notifications');
    }
    
    return businessLogic;
  }
}
