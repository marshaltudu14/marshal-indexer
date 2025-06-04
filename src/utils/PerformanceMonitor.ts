/**
 * Performance monitoring and analytics for the Marshal Context Engine
 */

export interface PerformanceMetrics {
  queryProcessingTime: number[];
  searchTime: number[];
  fusionTime: number[];
  totalQueries: number;
  averageQueryTime: number;
  averageSearchTime: number;
  averageFusionTime: number;
  memoryUsage: number[];
  cacheHitRate: number;
  errorRate: number;
  timestamp: number;
}

export interface QueryPerformanceData {
  query: string;
  processingTime: number;
  searchTime: number;
  fusionTime: number;
  resultCount: number;
  cacheHit: boolean;
  timestamp: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private queryHistory: QueryPerformanceData[] = [];
  private maxHistorySize = 1000;
  private startTime = Date.now();

  constructor() {
    this.metrics = {
      queryProcessingTime: [],
      searchTime: [],
      fusionTime: [],
      totalQueries: 0,
      averageQueryTime: 0,
      averageSearchTime: 0,
      averageFusionTime: 0,
      memoryUsage: [],
      cacheHitRate: 0,
      errorRate: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Record query processing time
   */
  recordQueryProcessingTime(time: number): void {
    this.metrics.queryProcessingTime.push(time);
    this.updateAverages();
  }

  /**
   * Record search time
   */
  recordSearchTime(time: number): void {
    this.metrics.searchTime.push(time);
    this.updateAverages();
  }

  /**
   * Record fusion time
   */
  recordFusionTime(time: number): void {
    this.metrics.fusionTime.push(time);
    this.updateAverages();
  }

  /**
   * Record complete query performance data
   */
  recordQueryPerformance(data: QueryPerformanceData): void {
    this.queryHistory.push(data);
    this.metrics.totalQueries++;

    // Keep history size manageable
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory.shift();
    }

    // Update metrics
    this.recordQueryProcessingTime(data.processingTime);
    this.recordSearchTime(data.searchTime);
    this.recordFusionTime(data.fusionTime);
    this.updateCacheHitRate();
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsage.push(usage.heapUsed / 1024 / 1024); // MB
      
      // Keep only recent memory measurements
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage.shift();
      }
    }
  }

  /**
   * Record error occurrence
   */
  recordError(): void {
    // Simple error counting - in production, this would be more sophisticated
    this.metrics.errorRate = this.calculateErrorRate();
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.recordMemoryUsage();
    this.metrics.timestamp = Date.now();
    return { ...this.metrics };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalQueries: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    memoryUsage: number;
    uptime: number;
  } {
    const allTimes = this.queryHistory.map(q => q.processingTime + q.searchTime + q.fusionTime);
    allTimes.sort((a, b) => a - b);

    const p95Index = Math.floor(allTimes.length * 0.95);
    const p99Index = Math.floor(allTimes.length * 0.99);

    return {
      totalQueries: this.metrics.totalQueries,
      averageResponseTime: this.calculateAverage(allTimes),
      p95ResponseTime: allTimes[p95Index] || 0,
      p99ResponseTime: allTimes[p99Index] || 0,
      cacheHitRate: this.metrics.cacheHitRate,
      errorRate: this.metrics.errorRate,
      memoryUsage: this.getCurrentMemoryUsage(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get slow queries (above threshold)
   */
  getSlowQueries(thresholdMs: number = 1000): QueryPerformanceData[] {
    return this.queryHistory.filter(q => 
      (q.processingTime + q.searchTime + q.fusionTime) > thresholdMs
    ).sort((a, b) => 
      (b.processingTime + b.searchTime + b.fusionTime) - 
      (a.processingTime + a.searchTime + a.fusionTime)
    );
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(windowSizeMinutes: number = 60): {
    timestamps: number[];
    averageResponseTimes: number[];
    queryVolumes: number[];
  } {
    const windowMs = windowSizeMinutes * 60 * 1000;
    const now = Date.now();
    const windows: Map<number, QueryPerformanceData[]> = new Map();

    // Group queries by time windows
    for (const query of this.queryHistory) {
      const windowStart = Math.floor(query.timestamp / windowMs) * windowMs;
      if (!windows.has(windowStart)) {
        windows.set(windowStart, []);
      }
      windows.get(windowStart)!.push(query);
    }

    const timestamps: number[] = [];
    const averageResponseTimes: number[] = [];
    const queryVolumes: number[] = [];

    for (const [timestamp, queries] of windows) {
      if (timestamp > now - (24 * 60 * 60 * 1000)) { // Last 24 hours
        timestamps.push(timestamp);
        
        const responseTimes = queries.map(q => q.processingTime + q.searchTime + q.fusionTime);
        averageResponseTimes.push(this.calculateAverage(responseTimes));
        queryVolumes.push(queries.length);
      }
    }

    return { timestamps, averageResponseTimes, queryVolumes };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const summary = this.getPerformanceSummary();
    const slowQueries = this.getSlowQueries(500);

    let report = `# Marshal Context Engine Performance Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Uptime:** ${Math.round(summary.uptime / 1000 / 60)} minutes\n\n`;

    report += `## Summary\n`;
    report += `- **Total Queries:** ${summary.totalQueries}\n`;
    report += `- **Average Response Time:** ${summary.averageResponseTime.toFixed(2)}ms\n`;
    report += `- **95th Percentile:** ${summary.p95ResponseTime.toFixed(2)}ms\n`;
    report += `- **99th Percentile:** ${summary.p99ResponseTime.toFixed(2)}ms\n`;
    report += `- **Cache Hit Rate:** ${(summary.cacheHitRate * 100).toFixed(1)}%\n`;
    report += `- **Error Rate:** ${(summary.errorRate * 100).toFixed(2)}%\n`;
    report += `- **Memory Usage:** ${summary.memoryUsage.toFixed(1)}MB\n\n`;

    if (slowQueries.length > 0) {
      report += `## Slow Queries (>500ms)\n`;
      for (const query of slowQueries.slice(0, 5)) {
        const totalTime = query.processingTime + query.searchTime + query.fusionTime;
        report += `- **${totalTime.toFixed(2)}ms:** "${query.query.substring(0, 50)}..."\n`;
      }
      report += `\n`;
    }

    report += `## Performance Breakdown\n`;
    report += `- **Query Processing:** ${this.metrics.averageQueryTime.toFixed(2)}ms avg\n`;
    report += `- **Search:** ${this.metrics.averageSearchTime.toFixed(2)}ms avg\n`;
    report += `- **Result Fusion:** ${this.metrics.averageFusionTime.toFixed(2)}ms avg\n`;

    return report;
  }

  /**
   * Update average calculations
   */
  private updateAverages(): void {
    this.metrics.averageQueryTime = this.calculateAverage(this.metrics.queryProcessingTime);
    this.metrics.averageSearchTime = this.calculateAverage(this.metrics.searchTime);
    this.metrics.averageFusionTime = this.calculateAverage(this.metrics.fusionTime);
  }

  /**
   * Calculate average of an array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    if (this.queryHistory.length === 0) {
      this.metrics.cacheHitRate = 0;
      return;
    }

    const cacheHits = this.queryHistory.filter(q => q.cacheHit).length;
    this.metrics.cacheHitRate = cacheHits / this.queryHistory.length;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    // This would be implemented based on actual error tracking
    // For now, return a placeholder
    return 0.01; // 1% error rate
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (this.metrics.memoryUsage.length === 0) return 0;
    return this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] || 0;
  }

  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.metrics = {
      queryProcessingTime: [],
      searchTime: [],
      fusionTime: [],
      totalQueries: 0,
      averageQueryTime: 0,
      averageSearchTime: 0,
      averageFusionTime: 0,
      memoryUsage: [],
      cacheHitRate: 0,
      errorRate: 0,
      timestamp: Date.now()
    };
    this.queryHistory = [];
    this.startTime = Date.now();
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.getMetrics(),
      summary: this.getPerformanceSummary(),
      queryHistory: this.queryHistory.slice(-100) // Last 100 queries
    }, null, 2);
  }
}
