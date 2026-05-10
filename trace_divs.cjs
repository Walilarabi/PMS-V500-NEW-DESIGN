const fs = require('fs');
const content = fs.readFileSync('src/pages/PlanningView.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Find all <div or </div>
    // This is a naive parser but it should work for standard JSX
    const matches = line.match(/<div(\s|>)|<\/div>/gi);
    
    if (matches) {
        matches.forEach(match => {
            if (match.startsWith('<div')) {
                // Try to extract className
                const classMatch = line.match(/className=["']([^"']+)["']/);
                const className = classMatch ? classMatch[1] : 'unnamed';
                stack.push({ line: i + 1, className });
            } else {
                if (stack.length > 0) {
                    stack.pop();
                } else {
                    console.log(`Unmatched closing div at line ${i + 1}`);
                }
            }
        });
    }
}

console.log("\nUnclosed divs at end of file:");
stack.forEach(s => {
    console.log(`L${s.line}: <div className="${s.className}">`);
});
