const BaseAnalyzer = require('../core/base-analyzer');
class SQLAnalyzer extends BaseAnalyzer {
  constructor() { super('SQL Analyzer'); }
  async analyze(content, filePath) {
    if (!filePath.endsWith('.sql')) return [];
    return [
      ...(content.match(/SELECT.*FROM.*WHERE.*=.*['"]/i) ? [this.createFinding('SQL-001', 'Critical', 'SQL Injection risk.', 'Use parameterization.', filePath, 'N/A')] : [])
    ];
  }
}
module.exports = SQLAnalyzer;


