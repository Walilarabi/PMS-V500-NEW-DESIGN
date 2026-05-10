const fs = require('fs');
const content = fs.readFileSync('src/pages/PlanningView.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Find all <div or </div> or <div ... />
    // We need to be careful with self-closing divs
    
    // First, find all div-related strings
    // We use a regex that captures the whole tag to check for self-closing
    const tagRegex = /<div[^>]*>|<\/div>/gi;
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
        const tag = match[0];
        if (tag.startsWith('</')) {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`Unmatched closing div at line ${i + 1}: ${tag}`);
            }
        } else if (tag.endsWith('/>')) {
            // Self-closing div, do nothing
        } else {
            // Opening div
            const classMatch = tag.match(/className=["']([^"']+)["']/);
            const className = classMatch ? classMatch[1] : 'unnamed';
            stack.push({ line: i + 1, className, tag });
        }
    }
}

console.log("\nUnclosed divs at end of file:");
stack.forEach(s => {
    console.log(`L${s.line}: ${s.tag}`);
});

console.log(`\nFinal Stack Size: ${stack.length}`);
