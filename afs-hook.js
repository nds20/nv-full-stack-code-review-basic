

// afs-hook.js
const fs = require('fs');
const path = require('path');
function runAFSIntegrityCheck(dir = '.') {
    console.log("[AFS-HOOK] Scanning for friction...");
    const files = fs.readdirSync(dir);
files.forEach(file => {
        if (file.endsWith('.md') || file.endsWith('.js') || file.endsWith('.yml')) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes("<<<<<<<")) {
                console.log(`[AFS-HOOK] Conflict found in: ${file}. Initiating resolution...`);
                // The regex: finds the HEAD block and keeps it, discarding the incoming changes
                const resolved = content.replace(/<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>.*?\n/gs, '$1');
                fs.writeFileSync(file, resolved);
                console.log(`[AFS-HOOK] ${file} healed.`);
            }
        }
    });
}
module.exports = { runAFSIntegrityCheck };


