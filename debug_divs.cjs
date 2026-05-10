const fs = require('fs');
const content = fs.readFileSync('src/pages/PlanningView.tsx', 'utf8');
const open = (content.match(/<div/g) || []).length;
const close = (content.match(/<\/div/g) || []).length;
console.log(`Open: ${open}, Close: ${close}`);

// Try to find the first line where imbalance occurs
const lines = content.split('\n');
let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const o = (line.match(/<div/g) || []).length;
  const c = (line.match(/<\/div/g) || []).length;
  balance += (o - c);
  if (balance < 0) {
    console.log(`Error at line ${i + 1}: balance is ${balance}`);
    console.log(line);
    // break; // continue to see the end balance
  }
}
console.log(`Final balance: ${balance}`);
