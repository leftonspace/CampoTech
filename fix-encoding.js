const fs = require('fs');
const path = require('path');

const appPath = 'd:/projects/CampoTech/apps/web';

// Extended mojibake patterns using string literals
const replacements = [];

// Double-encoded patterns
replacements.push(['Ã¡', 'á']);
replacements.push(['Ã©', 'é']);
replacements.push(['Ã­', 'í']);
replacements.push(['Ã³', 'ó']);
replacements.push(['Ãº', 'ú']);
replacements.push(['Ã±', 'ñ']);
replacements.push(['Ã¼', 'ü']);
replacements.push(['Â¿', '¿']);
replacements.push(['Â¡', '¡']);
replacements.push(['Ã‰', 'É']);

// Triple-encoded patterns
replacements.push(['Íƒ¡', 'á']);
replacements.push(['ÍƒÂ¡', 'á']);
replacements.push(['Íƒ©', 'é']);
replacements.push(['ÍƒÂ©', 'é']);
replacements.push(['ÍƒÂ­', 'í']);
replacements.push(['Íƒ³', 'ó']);
replacements.push(['ÍƒÂ³', 'ó']);
replacements.push(['ÍƒÂº', 'ú']);
replacements.push(['ÍƒÂ±', 'ñ']);
replacements.push(['Íƒ±', 'ñ']);

// Box drawing characters
replacements.push(['Í¢•Â', '═']);
replacements.push(['Í¢•', '═']);

// Saturday encoding fix
replacements.push(['SÃÂB', 'SÁB']);
replacements.push(['SÃ¡bado', 'Sábado']);

// Emoji mojibake - folder
replacements.push([String.fromCharCode(0xF0, 0x9F, 0x93, 0x81).replace(/[\x00-\xFF]/g, c => String.fromCharCode(c.charCodeAt(0))), '📁']);

// Use string pattern approach for emojis
replacements.push(['ðŸ"', '📁']);
replacements.push(['ðŸ"' + String.fromCharCode(0x27), '🔒']);
replacements.push(['ðŸš—', '🚗']);
replacements.push(['âš ï¸', '⚠️']);
replacements.push(['ðŸŒ', '🌍']);
replacements.push(['âœ"', '✓']);
replacements.push(['â€"', '—']);
replacements.push(['â†', '←']);
replacements.push(['â€¢', '•']);
replacements.push(['âœ…', '✅']);
replacements.push(['âŒ', '❌']);

function getAllFiles(dir, ext) {
    let results = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            results = results.concat(getAllFiles(fullPath, ext));
        } else if (ext.some(e => item.endsWith(e))) {
            results.push(fullPath);
        }
    }

    return results;
}

const files = getAllFiles(appPath, ['.tsx', '.ts']);
let fixedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    for (const [pattern, replacement] of replacements) {
        content = content.split(pattern).join(replacement);
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed:', path.relative(appPath, file));
        fixedCount++;
    }
}

console.log('\nTotal files fixed:', fixedCount);
