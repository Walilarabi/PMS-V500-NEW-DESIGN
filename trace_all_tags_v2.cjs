const fs = require('fs');
const content = fs.readFileSync('src/pages/PlanningView.tsx', 'utf8');

// Use a stack to track open tags
let stack = [];
let results = [];

// Regex to find all tags
// Captures: 1=TagName(open), 2=SelfClosingSlash, 3=TagName(close), 4=Brace
const tagRegex = /<([a-zA-Z0-9\.]+)(?:\s+[^>]*?(\/)?)?>|<\/([a-zA-Z0-9\.]+)>|(\{|\})/g;

let match;
while ((match = tagRegex.exec(content)) !== null) {
    const [fullTag, openName, selfClosing, closeName, brace] = match;
    
    if (openName) {
        if (selfClosing) {
            // Self-closing tag, ignore
        } else {
            stack.push({ type: 'tag', name: openName, index: match.index, full: fullTag });
        }
    } else if (closeName) {
        if (stack.length > 0) {
            const last = stack.pop();
            if (last.type !== 'tag') {
                results.push(`Mismatch: closed </${closeName}> but last open was ${last.type} at index ${match.index}`);
                stack.push(last); // Put it back to keep tracking
            } else if (last.name !== closeName) {
                // Special case: some tags might be implicitly self-closing in some parsers, but not in JSX.
                // However, in JSX, only tags with /> or explicit close are balanced.
                results.push(`Mismatch: opened <${last.name}> but closed </${closeName}> at index ${match.index}`);
            }
        } else {
            results.push(`Unmatched closing tag: </${closeName}> at index ${match.index}`);
        }
    } else if (brace === '{') {
        stack.push({ type: '{', index: match.index });
    } else if (brace === '}') {
        if (stack.length > 0) {
            const last = stack.pop();
            if (last.type !== '{') {
                results.push(`Mismatch: closed } but last open was <${last.name}> at index ${match.index}`);
                stack.push(last); // Put it back
            }
        } else {
            results.push(`Unmatched closing brace: } at index ${match.index}`);
        }
    }
}

if (results.length > 0) {
    console.log("Errors found:");
    results.slice(0, 10).forEach(r => console.log(r));
}

if (stack.length > 0) {
    console.log("\nUnclosed items at end of file (last 10):");
    stack.slice(-10).forEach(s => {
        const line = content.substring(0, s.index).split('\n').length;
        console.log(`L${line}: ${s.type === 'tag' ? '<' + s.name + '>' : '{'}`);
    });
} else if (results.length === 0) {
    console.log("All tags and braces are balanced!");
}
