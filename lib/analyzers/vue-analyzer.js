const BaseAnalyzer = require('../core/base-analyzer');
class VueAnalyzer extends BaseAnalyzer {
  constructor() { super('Vue Analyzer'); }
  async analyze(content, filePath) {
    if (!filePath.endsWith('.vue')) return [];
    return [
      ...(content.includes('v-html') ? [this.createFinding('VUE-001', 'High', 'v-html XSS risk.', 'Use {{ }} interpolation.', filePath, 'N/A')] : [])
    ];
  }
}
module.exports = VueAnalyzer;


