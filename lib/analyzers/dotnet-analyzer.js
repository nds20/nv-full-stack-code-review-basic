const BaseAnalyzer = require('../core/base-analyzer');
class DotNetAnalyzer extends BaseAnalyzer {
  constructor() { super('.NET/C# Analyzer'); }
  async analyze(content, filePath) {
    if (!filePath.endsWith('.cs')) return [];
    return [
      ...(content.includes('public static') ? [this.createFinding('CS-001', 'High', 'Public static field.', 'Use property.', filePath, 'N/A')] : [])
    ];
  }
}
module.exports = DotNetAnalyzer;


