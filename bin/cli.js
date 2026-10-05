

#!/usr/bin/env node
const { Command } = require('commander');
const orchestrator = require('../lib/core/orchestrator');
const program = new Command();
program
  .version('1.0.0')
  .description('824 Enterprise Code Review Agent');
program
  .command('beast-code-review')
  .description('Run the 824 Enterprise Code Review Engine')
  .requiredOption('--pr <number>', 'GitHub Pull Request number')
  .requiredOption('--license <key>', 'Enterprise License Key')
  .option('-p, --path <path>', 'Target directory', '.')
  .action(async (options) => {
    console.log(`🚀 824 Engine initiating for PR #${options.pr}...`);
    try {
      await orchestrator.run(options.path, options.pr, options.license);
    } catch (error) {
      console.error('❌ Engine Error:', error.message);
      process.exit(1);
    }
  });
program.parse(process.argv);


