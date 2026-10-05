const BaseAnalyzer = require('../core/base-analyzer');
class K8sAnalyzer extends BaseAnalyzer {
  constructor() { super('K8s Analyzer'); }
  async analyze(content, filePath) {
    if (!filePath.endsWith('.yaml')) return [];
    return [
      ...(content.includes('privileged: true') ? [this.createFinding('K8S-001', 'Critical', 'Privileged container.', 'Disable privileged mode.', filePath, 'N/A')] : [])
    ];
  }
}
module.exports = K8sAnalyzer;


