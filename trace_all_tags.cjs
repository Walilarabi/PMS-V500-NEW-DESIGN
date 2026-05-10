const fs = require('fs');
const content = fs.readFileSync('src/pages/PlanningView.tsx', 'utf8');

// Regex for all tags: <Tag ...> or </Tag>
const tagRegex = /<([a-zA-Z0-9\.]+)(\s|>|\/)|<\/([a-zA-Z0-9\.]+)>|(\{|\})/g;
let stack = [];
let results = [];

let match;
while ((match = tagRegex.exec(content)) !== null) {
    if (match[1]) { // Opening tag
        const tagName = match[1];
        // Check if self-closing
        const restOfTag = content.substring(match.index, content.indexOf('>', match.index) + 1);
        if (restOfTag.endsWith('/>')) {
            // Self-closing
        } else {
            stack.push({ tag: tagName, index: match.index });
        }
    } else if (match[3]) { // Closing tag
        const tagName = match[3];
        if (stack.length > 0) {
            const last = stack.pop();
            if (last.tag !== tagName) {
                results.push(`Mismatch: opened <${last.tag}> but closed </${tagName}> at index ${match.index}`);
            }
        } else {
            results.push(`Unmatched closing tag: </${tagName}> at index ${match.index}`);
        }
    } else if (match[4] === '{') {
        stack.push({ tag: '{', index: match.index });
    } else if (match[4] === '}') {
        if (stack.length > 0) {
            stack.pop();
        } else {
            results.push(`Unmatched closing brace: } at index ${match.index}`);
        }
    }
}

if (results.length > 0) {
    console.log("Errors found:");
    results.forEach(r => console.log(r));
}

if (stack.length > 0) {
    console.log("\nUnclosed items at end of file:");
    stack.forEach(s => {
        // Find line number
        const line = content.substring(0, s.index).split('\n').length;
        console.log(`L${line}: <${s.tag}>`);
    });
} else if (results.length === 0) {
    console.log("All tags and braces are balanced!");
}
