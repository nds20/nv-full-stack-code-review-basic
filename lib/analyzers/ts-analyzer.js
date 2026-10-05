

const BaseAnalyzer = require('../core/base-analyzer');
class TSAnalyzer extends BaseAnalyzer {
  constructor() {
    super('TypeScript/JS Analyzer');
  }
async analyze(content, filePath) {
    const findings = [];
// 1. Check for console.logs
    if (content.includes('console.log')) {
      findings.push(this.createFinding(
        'TS-001',
        'Medium',
        'Production code should not contain console.logs.',
        '// Use a proper logger or remove the log statement',
        filePath,
        'N/A'
      ));
    }
// 2. Check for 'any' types
    if (content.includes(': any')) {
      findings.push(this.createFinding(
        'TS-002',
        'High',
        'Usage of "any" type defeats the purpose of TypeScript.',
        '// Define a proper interface for the data structure',
        filePath,
        'N/A'
      ));
    }
return findings;
  }
}
module.exports = TSAnalyzer;


