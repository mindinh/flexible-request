/**
 * Sync Types Script
 * 
 * This script syncs the curated types from srv/types.ts to all frontend apps.
 * Run with: npm run sync:types
 * 
 * How it works:
 * 1. Reads srv/types.ts (the single source of truth)
 * 2. Copies it to each frontend app's src/types/schema.ts
 * 3. Logs any errors or warnings
 */

const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(__dirname, '..', 'srv', 'types.ts');
const FRONTEND_APPS = [
    path.join(__dirname, '..', 'app', 'request-management', 'src', 'types')
];

function syncTypes() {
    console.log('🔄 Syncing types from srv/types.ts to frontend apps...\n');

    // Check if source file exists
    if (!fs.existsSync(SOURCE_FILE)) {
        console.warn('⚠️  Warning: srv/types.ts does not exist.');
        console.log('   Please create srv/types.ts with your shared types.');
        console.log('   See .agent/guidelines/type-sharing-guideline.md for details.\n');
        return;
    }

    const sourceContent = fs.readFileSync(SOURCE_FILE, 'utf8');

    // Add header comment to indicate this is a generated file
    const header = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * 
 * This file is synced from srv/types.ts
 * To update, modify srv/types.ts and run: npm run sync:types
 * 
 * Source: srv/types.ts
 * Generated: ${new Date().toISOString()}
 */

`;

    const targetContent = header + sourceContent;

    let synced = 0;
    let errors = 0;

    for (const appTypesDir of FRONTEND_APPS) {
        const targetFile = path.join(appTypesDir, 'schema.ts');

        try {
            // Ensure directory exists
            if (!fs.existsSync(appTypesDir)) {
                fs.mkdirSync(appTypesDir, { recursive: true });
            }

            // Write the file
            fs.writeFileSync(targetFile, targetContent, 'utf8');
            console.log(`✅ Synced: ${path.relative(process.cwd(), targetFile)}`);
            synced++;
        } catch (err) {
            console.error(`❌ Error syncing to ${targetFile}:`, err.message);
            errors++;
        }
    }

    console.log(`\n📊 Summary: ${synced} synced, ${errors} errors`);

    if (errors > 0) {
        process.exit(1);
    }
}

syncTypes();
