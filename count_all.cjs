const fs = require('fs');
const c = fs.readFileSync('src/pages/PlanningView.tsx', 'utf8');
console.log('Braces:', (c.match(/\{/g)||[]).length, (c.match(/\}/g)||[]).length);
console.log('Parens:', (c.match(/\(/g)||[]).length, (c.match(/\)/g)||[]).length);
console.log('Brackets:', (c.match(/\[/g)||[]).length, (c.match(/\]/g)||[]).length);
console.log('Divs (open):', (c.match(/<div/g)||[]).length);
console.log('Divs (close):', (c.match(/<\/div>/g)||[]).length);
console.log('Self-closing Divs:', (c.match(/<div[^>]*\/>/g)||[]).length);
