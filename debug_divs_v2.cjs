const fs = require('fs');
const content = fs.readFileSync('src/pages/PlanningView.tsx', 'utf8');
const lines = content.split('\n');
let balance = 0;
let results = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Simple regex to count <div and </div> (ignoring case and whitespace)
    const openTags = (line.match(/<div(\s|>)/gi) || []).length;
    const closeTags = (line.match(/<\/div>/gi) || []).length;
    
    if (openTags !== 0 || closeTags !== 0) {
        balance += (openTags - closeTags);
        results.push({ line: i + 1, open: openTags, close: closeTags, balance: balance, content: line.trim().substring(0, 50) });
    }
}

// Print lines where balance changes or stays high
console.log("Significant balance changes:");
results.forEach(r => {
    if (r.open !== r.close) {
        console.log(`L${r.line.toString().padEnd(4)} | Bal: ${r.balance.toString().padEnd(2)} | +${r.open} -${r.close} | ${r.content}`);
    }
});

console.log(`\nFinal Balance: ${balance}`);
