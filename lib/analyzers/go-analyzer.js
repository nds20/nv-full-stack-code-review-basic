const BaseAnalyzer = require('../core/base-analyzer');
class GoAnalyzer extends BaseAnalyzer {
  constructor() { super('Go Analyzer'); }
  async analyze(content, filePath) {
    if (!filePath.endsWith('.go')) return [];
    return [
      ...(content.includes('panic(') ? [this.createFinding('GO-001', 'High', 'Avoid panic().', 'Use error handling.', filePath, 'N/A')] : [])
    ];
  }
}
module.exports = GoAnalyzer;


