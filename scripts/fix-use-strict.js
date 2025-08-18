#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const directories = [
  'src',
  'src/core',
  'src/middleware',
  'src/router',
  'src/utils'
];

let filesFixed = 0;

directories.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  
  if (!fs.existsSync(fullPath)) {
    return;
  }
  
  const files = fs.readdirSync(fullPath).filter(file => file.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(fullPath, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if 'use strict' is already present at the beginning
    if (!content.startsWith("'use strict';") && !content.startsWith('"use strict";')) {
      // Add 'use strict' at the beginning
      if (content.startsWith('/**')) {
        // File starts with JSDoc comment - add before it
        content = "'use strict';\n\n" + content;
      } else if (content.startsWith('#!/usr/bin/env node')) {
        // Shebang present - add after it
        const lines = content.split('\n');
        lines.splice(1, 0, '', "'use strict';");
        content = lines.join('\n');
      } else {
        // Add at the very beginning
        content = "'use strict';\n\n" + content;
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${path.relative(process.cwd(), filePath)}`);
      filesFixed++;
    }
  });
});

console.log(`\n✅ Added 'use strict' to ${filesFixed} files`);