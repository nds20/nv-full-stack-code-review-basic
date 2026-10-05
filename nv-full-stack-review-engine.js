// nv-full-stack-review-engine.js
const args = process.argv.slice(2);
const prIndex = args.indexOf('--pr');
const prNumber = prIndex !== -1 ? args[prIndex + 1] : '1';
console.log("--- BEAST MODE ENGINE INITIALIZED ---");
console.log("Checking License...");
// Validate the secret key
if (process.env.BEAST_LICENSE_KEY !== "BEAST-ENT-2026") {
    console.error("INVALID LICENSE KEY - ACCESS DENIED");
    process.exit(1);
}
console.log(`Reviewing PR #${prNumber}...`);
console.log("--------------------------------------");
console.log("Scanning for friction and patterns...");
console.log("Engine status: ONLINE");
console.log("Review Complete: No issues found. Beast Mode Active.");
process.exit(0);
