const BaseAnalyzer = require('../core/base-analyzer');
class DockerAnalyzer extends BaseAnalyzer {
  constructor() { super('Docker Analyzer'); }
  async analyze(content, filePath) {
    if (!filePath.includes('Dockerfile')) return [];
    return [
      ...(!content.includes('USER ') ? [this.createFinding('DOCKER-001', 'High', 'Running as root.', 'Add USER instruction.', filePath, 'N/A')] : [])
    ];
  }
}
module.exports = DockerAnalyzer;


