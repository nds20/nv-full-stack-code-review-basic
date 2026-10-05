const BaseAnalyzer = require('../core/base-analyzer');
class DepAnalyzer extends BaseAnalyzer {
  constructor() {
    super('Dependency Analyzer');
    // Common deprecated packages that should be flagged in enterprise environments
    this.deprecatedPackages = {
      'request': 'Use "axios" or "node-fetch" instead.',
      'moment': 'Use "date-fns" or "dayjs" for smaller bundle sizes.',
      'angularjs': 'Use "Angular" (v2+) for modern enterprise support.',
      'node-sass': 'Use "sass" (Dart Sass) instead.'
    };
  }
async analyze(content, filePath) {
    const findings = [];
// Only run this on dependency manifest files
    if (!filePath.endsWith('package.json')) return findings;
try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
for (const [name, version] of Object.entries(deps)) {
        if (this.deprecatedPackages[name]) {
          findings.push(this.createFinding(
            'DEP-001',
            'High',
            `Package "${name}" is deprecated: ${this.deprecatedPackages[name]}`,
            `npm uninstall ${name}\nnpm install <replacement>`,
            filePath,
            'N/A'
          ));
        }
      }
    } catch (e) {
      // If JSON is malformed, just skip
    }
return findings;
  }
}
module.exports = DepAnalyzer;


