const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

// Create dist directories if they don't exist
const cjsDir = path.join(distDir, 'cjs');
const esmDir = path.join(distDir, 'esm');

if (!fs.existsSync(cjsDir)) {
  fs.mkdirSync(cjsDir, { recursive: true });
}
if (!fs.existsSync(esmDir)) {
  fs.mkdirSync(esmDir, { recursive: true });
}

// Write package.json files
fs.writeFileSync(
  path.join(cjsDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n'
);

fs.writeFileSync(
  path.join(esmDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n'
);

console.log('✓ Generated dist/cjs/package.json');
console.log('✓ Generated dist/esm/package.json');

