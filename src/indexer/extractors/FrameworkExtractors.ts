import { ComponentInfo, RouteInfo, SchemaInfo, HookInfo, ApiInfo } from '../types/AnalyzerTypes.js';

/**
 * Framework-specific code element extractors
 */
export class FrameworkExtractors {

  /**
   * Extract React components
   */
  static extractReactComponents(content: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    
    // Function components
    const funcComponentMatches = content.match(/(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/g) || [];
    for (const match of funcComponentMatches) {
      const name = match.match(/function\s+([A-Z]\w+)/)?.[1];
      if (name) {
        components.push({
          name,
          type: 'function',
          isExported: match.includes('export')
        });
      }
    }

    // Arrow function components
    const arrowComponentMatches = content.match(/(?:export\s+)?const\s+([A-Z]\w+)\s*[=:][^=]*=>\s*[({]/g) || [];
    for (const match of arrowComponentMatches) {
      const name = match.match(/const\s+([A-Z]\w+)/)?.[1];
      if (name) {
        components.push({
          name,
          type: 'arrow',
          isExported: match.includes('export')
        });
      }
    }

    return components;
  }

  /**
   * Extract route definitions (Next.js specific)
   */
  static extractRoutes(content: string, filePath: string): RouteInfo[] {
    const routes: RouteInfo[] = [];
    
    // Next.js API routes
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        if (content.includes(`export async function ${method}`) || content.includes(`export function ${method}`)) {
          routes.push({
            method,
            path: filePath,
            isApi: true
          });
        }
      }
    }

    // Next.js page routes
    if (filePath.includes('/page.') || filePath.includes('\\page.')) {
      routes.push({
        method: 'GET',
        path: filePath,
        isApi: false
      });
    }

    return routes;
  }

  /**
   * Extract schema definitions (Zod, Joi, etc.)
   */
  static extractSchemas(content: string): SchemaInfo[] {
    const schemas: SchemaInfo[] = [];
    
    // Zod schemas
    const zodMatches = content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*z\./g) || [];
    for (const match of zodMatches) {
      const name = match.match(/const\s+(\w+)/)?.[1];
      if (name) {
        schemas.push({
          name,
          type: 'zod',
          isExported: match.includes('export')
        });
      }
    }

    // Joi schemas
    const joiMatches = content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*Joi\./g) || [];
    for (const match of joiMatches) {
      const name = match.match(/const\s+(\w+)/)?.[1];
      if (name) {
        schemas.push({
          name,
          type: 'joi',
          isExported: match.includes('export')
        });
      }
    }

    // Yup schemas
    const yupMatches = content.match(/(?:export\s+)?const\s+(\w+)\s*=\s*yup\./g) || [];
    for (const match of yupMatches) {
      const name = match.match(/const\s+(\w+)/)?.[1];
      if (name) {
        schemas.push({
          name,
          type: 'yup',
          isExported: match.includes('export')
        });
      }
    }

    return schemas;
  }

  /**
   * Extract React hooks
   */
  static extractHooks(content: string): HookInfo[] {
    const hooks: HookInfo[] = [];
    
    const hookMatches = content.match(/(?:export\s+)?(?:const|function)\s+(use[A-Z]\w*)/g) || [];
    for (const match of hookMatches) {
      const name = match.match(/(use[A-Z]\w*)/)?.[1];
      if (name) {
        hooks.push({
          name,
          isExported: match.includes('export')
        });
      }
    }

    return hooks;
  }

  /**
   * Extract API endpoint information
   */
  static extractApiEndpoints(content: string, _filePath: string): ApiInfo[] {
    const apis: ApiInfo[] = [];
    
    // Look for fetch calls
    const fetchMatches = content.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
    for (const match of fetchMatches) {
      const url = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
      if (url) {
        apis.push({
          url,
          method: 'unknown',
          type: 'fetch'
        });
      }
    }

    // Look for axios calls
    const axiosMatches = content.match(/axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
    for (const match of axiosMatches) {
      const method = match.match(/axios\.(\w+)/)?.[1]?.toUpperCase();
      const url = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
      if (url && method) {
        apis.push({
          url,
          method,
          type: 'axios'
        });
      }
    }

    // Look for API route definitions
    const routeMatches = content.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
    for (const match of routeMatches) {
      const method = match.match(/app\.(\w+)/)?.[1]?.toUpperCase();
      const url = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
      if (url && method) {
        apis.push({
          url,
          method,
          type: 'express-route'
        });
      }
    }

    return apis;
  }

  /**
   * Extract semantic keywords based on content and context
   */
  static extractSemanticKeywords(content: string, filePath: string): string[] {
    const keywords = new Set<string>();
    
    // Add file type keywords
    const fileType = this.determineFileTypeFromPath(filePath);
    keywords.add(fileType);
    
    // Add framework keywords
    if (content.includes('React') || content.includes('jsx') || content.includes('tsx')) {
      keywords.add('react');
    }
    if (content.includes('Next') || filePath.includes('next')) {
      keywords.add('nextjs');
    }
    if (content.includes('Supabase') || content.includes('supabase')) {
      keywords.add('supabase');
    }
    if (content.includes('Express') || content.includes('express')) {
      keywords.add('express');
    }
    if (content.includes('TypeScript') || filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      keywords.add('typescript');
    }
    
    // Add domain keywords
    if (content.includes('auth') || content.includes('login') || content.includes('signup')) {
      keywords.add('authentication');
    }
    if (content.includes('database') || content.includes('sql') || content.includes('query')) {
      keywords.add('database');
    }
    if (content.includes('api') || content.includes('endpoint') || content.includes('route')) {
      keywords.add('api');
    }
    if (content.includes('component') || content.includes('jsx') || content.includes('tsx')) {
      keywords.add('ui');
    }
    if (content.includes('test') || content.includes('spec') || content.includes('jest')) {
      keywords.add('testing');
    }
    if (content.includes('config') || content.includes('setting') || content.includes('env')) {
      keywords.add('configuration');
    }
    
    // Add pattern keywords
    if (content.includes('useState') || content.includes('useEffect') || content.includes('useContext')) {
      keywords.add('react-hooks');
    }
    if (content.includes('middleware') || content.includes('next()')) {
      keywords.add('middleware');
    }
    if (content.includes('schema') || content.includes('validation') || content.includes('z.')) {
      keywords.add('validation');
    }
    
    return Array.from(keywords);
  }

  /**
   * Helper method to determine file type from path
   */
  private static determineFileTypeFromPath(filePath: string): string {
    const path = filePath.toLowerCase();
    
    if (path.includes('/api/') || path.includes('\\api\\')) return 'api';
    if (path.includes('/components/') || path.includes('\\components\\')) return 'component';
    if (path.includes('/pages/') || path.includes('/app/') || path.includes('\\pages\\') || path.includes('\\app\\')) return 'page';
    if (path.includes('/lib/') || path.includes('/utils/') || path.includes('\\lib\\') || path.includes('\\utils\\')) return 'utility';
    if (path.includes('/types/') || path.includes('\\types\\') || path.endsWith('.d.ts')) return 'types';
    if (path.includes('/hooks/') || path.includes('\\hooks\\')) return 'hook';
    if (path.includes('/actions/') || path.includes('\\actions\\')) return 'action';
    if (path.includes('/middleware/') || path.includes('\\middleware\\')) return 'middleware';
    if (path.includes('schema') || path.includes('model')) return 'schema';
    if (path.includes('config') || path.includes('settings')) return 'config';
    if (path.includes('test') || path.includes('spec')) return 'test';
    
    return 'other';
  }
}
