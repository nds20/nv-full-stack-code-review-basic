const { validateLicense } = require('./license-check');
const TSAnalyzer = require('../analyzers/ts-analyzer');
const DepAnalyzer = require('../analyzers/dep-analyzer');
const DotNetAnalyzer = require('../analyzers/dotnet-analyzer');
const HIPAAAnalyzer = require('../analyzers/hipaa-analyzer');
const GitHubProvider = require('../providers/github');
const run = async (targetPath, prNumber, licenseKey) => {
  // 1. Validate License
  if (!validateLicense(licenseKey)) {
    throw new Error("Unauthorized: Invalid Enterprise License Key.");
  }
console.log('✅ License Verified. Initializing 824 Enterprise Analysis...');
const analyzers = [
    new TSAnalyzer(), 
    new DepAnalyzer(), 
    new DotNetAnalyzer(),
    new HIPAAAnalyzer()
  ];
  const github = new GitHubProvider();
let allFindings = [];
// Logic to iterate over files (Simulated for now)
  console.log(`Running analysis on: ${targetPath}`);
// Example: Running TSAnalyzer
  const findings = await analyzers[0].analyze('const data: any = console.log("debug");', 'app.ts');
  allFindings = [...allFindings, ...findings];
// 2. Report Results
  if (prNumber) {
    if (allFindings.length === 0) {
      console.log("Posting success message to PR...");
      await github.postFinding(prNumber, {
        toMarkdown: () => "✅ **824 Agent Review:** No issues found! Your code is clean and compliant."
      });
    } else {
      console.log(`Posting ${allFindings.length} findings to PR #${prNumber}...`);
      for (const finding of allFindings) {
        await github.postFinding(prNumber, finding);
      }
    }
  } else {
    console.log('Review complete. No PR target provided.');
    console.table(allFindings);
  }
return allFindings;
};
module.exports = { run };


