/**
 * Fix Customers Data File
 * ========================
 * 
 * Converts the customers.ts data file from:
 *   latitude: -34.xxxx, longitude: -58.xxxx
 * 
 * To:
 *   coordinates: { lat: -34.xxxx, lng: -58.xxxx }
 * 
 * Run with: node scripts/fix-customers-data.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'simulation/data/customers.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf-8');

// Replace latitude/longitude pairs with coordinates object
// Pattern: latitude: <number>,\n            longitude: <number>,
content = content.replace(
    /latitude:\s*(-?\d+\.?\d*),\s*\n\s*longitude:\s*(-?\d+\.?\d*),/g,
    'coordinates: { lat: $1, lng: $2 },'
);

// Also fix inline format (for the compact lines at the end)
// Pattern: latitude: <number>, longitude: <number>
content = content.replace(
    /latitude:\s*(-?\d+\.?\d*),\s*longitude:\s*(-?\d+\.?\d*)/g,
    'coordinates: { lat: $1, lng: $2 }'
);

// Write back
fs.writeFileSync(filePath, content, 'utf-8');

console.log('✅ Fixed customers.ts coordinates format');
