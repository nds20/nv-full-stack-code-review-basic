const BaseAnalyzer = require('../core/base-analyzer');
class PythonAnalyzer extends BaseAnalyzer {
  constructor() { super('Python Analyzer'); }
  async analyze(content, filePath) {
    if (!filePath.endsWith('.py')) return [];
    return [
      ...(content.includes('eval(') ? [this.createFinding('PY-001', 'Critical', 'Use of eval().', 'Use ast.literal_eval().', filePath, 'N/A')] : [])
    ];
  }
}
module.exports = PythonAnalyzer;


