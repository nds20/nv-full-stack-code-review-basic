const engine = require('../lib/core/engine'); // Adjust path if needed
const ageAnalyzer = require('../lib/analyzers/age-analyzer');
// Mock configuration representing a "weak" setup
const mockConfig = {
  ageGateEnabled: false,
  verificationProvider: 'self-attestation',
  verificationBeforeCheckout: false,
  serverSideEnforcement: false,
  bypassProtection: false,
  jurisdictionRulesConfigured: false,
  auditLogging: false,
  privacyReviewCompleted: false
};
console.log('--- Running 824 AI Engine™️ Compliance Scan ---');
const result = ageAnalyzer.analyze(mockConfig);
console.log(`Compliance Passed: ${result.passed}`);
console.log(`Total Findings: ${result.findings.length}`);
result.findings.forEach(f => {
  console.log(`[${f.severity.toUpperCase()}] ${f.rule}: ${f.message}`);
  console.log(`   Recommendation: ${f.recommendation}`);
  console.log('---');
});