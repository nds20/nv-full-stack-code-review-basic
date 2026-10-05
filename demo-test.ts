// 824 Enterprise Demo: Triggering multiple analyzers
import { something } from 'request'; // DEP-001 (Deprecated)
function beastDemo() {
  const data: any = "triggering TS-002"; // TS-002 (Any type)
  console.log("Triggering TS-001"); // TS-001 (Console log)
// SEC-001 (Direct process.env)
  const key = process.env.SECRET_KEY; 
// HIPAA-001 (Potential PHI in log)
  log.info("Patient ID: 123456789"); 
}


