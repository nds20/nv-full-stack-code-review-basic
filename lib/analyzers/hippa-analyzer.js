

const BaseAnalyzer = require('../core/base-analyzer');
class HIPAAAnalyzer extends BaseAnalyzer {
  constructor() {
    super('HIPAA Compliance Analyzer');
  }
async analyze(content, filePath) {
    const findings = [];
// Pattern: Detecting potential PII/PHI in logs
    if (content.match(/log\.(info|warn|debug)\(.*(ssn|patient_id|dob|medical_record_number).*\)/i)) {
      findings.push(this.createFinding(
        'HIPAA-001',
        'Critical',
        'Potential exposure of PHI (Protected Health Information) in logs.',
        'Sanitize logs to remove PII/PHI before logging.',
        filePath,
        'N/A'
      ));
    }
// Pattern: Checking for insecure data storage
    if (content.match(/localStorage\.setItem.*(ssn|patient_name)/i)) {
      findings.push(this.createFinding(
        'HIPAA-002',
        'Critical',
        'Storing PHI in localStorage is a HIPAA violation.',
        'Use encrypted, server-side storage or secure session management.',
        filePath,
        'N/A'
      ));
    }
return findings;
  }
}
module.exports = HIPAAAnalyzer;


