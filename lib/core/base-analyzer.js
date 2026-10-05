

/**
 * Base class for all language analyzers
 */
class BaseAnalyzer {
  constructor(name) {
    this.name = name;
  }
// Every analyzer must implement this
  async analyze(content, filePath) {
    throw new Error('Analyze method must be implemented');
  }
// Helper to create our standard Finding object
  createFinding(id, severity, rationale, fixSnippet, file, line) {
    return { id, severity, rationale, fixSnippet, file, line };
  }
}
module.exports = BaseAnalyzer;


