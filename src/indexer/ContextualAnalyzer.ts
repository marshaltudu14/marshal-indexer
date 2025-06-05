// Import from the modular extractors and calculators
import { BasicExtractors } from './extractors/BasicExtractors.js';
import { FrameworkExtractors } from './extractors/FrameworkExtractors.js';
import { ComplexityCalculators } from './calculators/ComplexityCalculators.js';
import { SemanticAnalyzer } from './analyzers/SemanticAnalyzer.js';
import { RelationshipAnalyzer } from './analyzers/RelationshipAnalyzer.js';
import { QualityAnalyzer } from './analyzers/QualityAnalyzer.js';
import {
  CodeStructureInfo,
  SemanticContext,
  CodeRelationshipMap,
  CodeQualityMetrics,
  DependencyInfo
} from './types/AnalyzerTypes.js';

/**
 * Contextual analyzer that mimics Augment's understanding of code relationships
 * Now uses modular extractors and calculators for better maintainability
 */
export class ContextualAnalyzer {
  
  /**
   * Analyze code structure and extract semantic information
   */
  analyzeCodeStructure(content: string, filePath: string): CodeStructureInfo {
    const structure: CodeStructureInfo = {
      fileType: BasicExtractors.determineFileType(filePath),
      exports: BasicExtractors.extractExports(content),
      imports: BasicExtractors.extractImports(content),
      functions: BasicExtractors.extractFunctions(content),
      classes: BasicExtractors.extractClasses(content),
      interfaces: BasicExtractors.extractInterfaces(content),
      types: BasicExtractors.extractTypes(content),
      components: FrameworkExtractors.extractReactComponents(content),
      routes: FrameworkExtractors.extractRoutes(content, filePath),
      schemas: FrameworkExtractors.extractSchemas(content),
      hooks: FrameworkExtractors.extractHooks(content),
      apis: FrameworkExtractors.extractApiEndpoints(content, filePath),
      keywords: FrameworkExtractors.extractSemanticKeywords(content, filePath),
      complexity: ComplexityCalculators.calculateComplexity(content),
      importance: ComplexityCalculators.calculateImportance(content, filePath),
      // Enhanced semantic analysis
      semanticContext: this.extractSemanticContext(content, filePath),
      codeRelationships: this.extractCodeRelationships(content, filePath),
      qualityMetrics: this.calculateQualityMetrics(content, filePath)
    };

    return structure;
  }

  /**
   * Extract enhanced semantic context for better code understanding
   */
  private extractSemanticContext(content: string, filePath: string): SemanticContext {
    const domain = SemanticAnalyzer.determineDomain(content, filePath);
    const framework = SemanticAnalyzer.detectFrameworks(content, filePath);
    const patterns = SemanticAnalyzer.detectCodePatterns(content, filePath);
    const concepts = SemanticAnalyzer.extractConcepts(content, filePath);
    const businessLogic = SemanticAnalyzer.extractBusinessLogic(content, filePath);

    return {
      domain,
      framework,
      patterns,
      concepts,
      businessLogic
    };
  }

  /**
   * Extract code relationships for dependency mapping
   */
  private extractCodeRelationships(content: string, filePath: string): CodeRelationshipMap {
    const dependencies = RelationshipAnalyzer.extractDependencies(content, filePath);
    const dependents: DependencyInfo[] = []; // Will be populated during full codebase analysis
    const similarFiles: any[] = []; // Will be populated during similarity analysis
    const callGraph = RelationshipAnalyzer.buildCallGraph(content);
    const importGraph = RelationshipAnalyzer.buildImportGraph(content);

    return {
      dependencies,
      dependents,
      similarFiles,
      callGraph,
      importGraph
    };
  }

  /**
   * Calculate comprehensive code quality metrics
   */
  private calculateQualityMetrics(content: string, filePath: string): CodeQualityMetrics {
    const complexity = QualityAnalyzer.calculateCyclomaticComplexity(content);
    const maintainability = QualityAnalyzer.calculateMaintainabilityIndex(content);
    const testCoverage = QualityAnalyzer.estimateTestCoverage(content, filePath);
    const documentation = QualityAnalyzer.calculateDocumentationCoverage(content);
    const codeSmells = QualityAnalyzer.detectCodeSmells(content);
    const technicalDebt = QualityAnalyzer.calculateTechnicalDebt(content, filePath);

    return {
      complexity,
      maintainability,
      testCoverage,
      documentation,
      codeSmells,
      technicalDebt
    };
  }
}

// Re-export types for convenience
export * from './types/AnalyzerTypes.js';
