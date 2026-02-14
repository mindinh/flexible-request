/**
 * Sync Docs Script with Auto-Discovery
 * 
 * 1. Copies documentation from docs/{folder} to public/docs/{folder}
 * 2. Scans public/docs recursively
 * 3. Generates docs-manifest.json for the Wiki sidebar
 * 
 * Run: node scripts/sync-docs.mjs
 */

import { cpSync, rmSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const docsRoot = join(projectRoot, '../../docs');
const targetRoot = join(projectRoot, 'public/docs');
const manifestPath = join(targetRoot, 'docs-manifest.json');

console.log('[sync-docs] Syncing documentation...');

// Remove existing docs
if (existsSync(targetRoot)) {
    rmSync(targetRoot, { recursive: true, force: true });
    console.log('[sync-docs] Removed existing public/docs folder');
}

// Ensure target parent exists
mkdirSync(targetRoot, { recursive: true });

// Define folders to sync
const foldersToSync = ['product', 'business', 'technical', 'project'];

foldersToSync.forEach(folder => {
    const source = join(docsRoot, folder);
    const target = join(targetRoot, folder);
    if (existsSync(source)) {
        console.log(`  Syncing ${folder}...`);
        cpSync(source, target, { recursive: true });
    }
});

console.log('[sync-docs] ✅ Documentation synced successfully!');

// --- Auto-Discovery: Generate Manifest ---

/**
 * Extract title from markdown file (first # heading or filename)
 */
function extractTitle(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const match = content.match(/^#\s+(.+)$/m);
        if (match) {
            return match[1].trim();
        }
    } catch (e) {
        // Ignore read errors
    }
    // Fallback to filename
    return basename(filePath, '.md')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Extract order from frontmatter or return default
 */
function extractOrder(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const match = content.match(/^---[\s\S]*?order:\s*(\d+)[\s\S]*?---/m);
        if (match) {
            return parseInt(match[1], 10);
        }
    } catch (e) {
        // Ignore
    }
    return 999; // Default order
}

/**
 * Scan directory recursively and build doc tree
 */
function scanDocs(dir, basePath = '/docs') {
    const items = [];
    if (!existsSync(dir)) return items;

    const entries = readdirSync(dir, { withFileTypes: true });

    // Sort: directories first, then by order/name
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = `${basePath}/${entry.name}`;

        // Skip manifest file
        if (entry.name === 'docs-manifest.json') continue;

        // Skip hidden files and non-md files
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
            continue;
        }

        if (entry.isDirectory()) {
            // It's a folder - scan recursively
            const children = scanDocs(fullPath, relativePath);
            if (children.length > 0) {
                // Try to find an index/readme for this folder
                const indexFile = [
                    join(fullPath, 'README.md'),
                    join(fullPath, 'index.md'),
                ].find(f => existsSync(f));

                const title = indexFile ? extractTitle(indexFile) : null;
                const slug = relative(targetRoot, fullPath).replace(/\\/g, '/');

                // Clean folder name: remove number prefix for display
                const cleanName = entry.name.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                items.push({
                    slug,
                    title: title || cleanName,
                    path: indexFile ? relativePath + '/' + basename(indexFile) : null,
                    children: children.filter(c => !c.slug.endsWith('/README') && !c.slug.endsWith('/index')),
                    order: extractOrder(indexFile || fullPath),
                });
            }
        } else if (entry.name.endsWith('.md')) {
            // It's a markdown file
            const slug = relative(targetRoot, fullPath)
                .replace(/\\/g, '/')
                .replace(/\.md$/, '');

            // Skip READMEs if they are handled by parent folder or processed explicitly
            if (entry.name === 'README.md') continue;

            items.push({
                slug,
                title: extractTitle(fullPath),
                path: relativePath,
                order: extractOrder(fullPath),
            });
        }
    }

    // Sort by numeric prefix, then alphabetically
    items.sort((a, b) => {
        // Custom order for top-level folders
        const topLevelOrder = { 'product': 1, 'business': 2, 'technical': 3, 'project': 4 };
        const nameA = a.slug.split('/')[0];
        const nameB = b.slug.split('/')[0];

        // If sorting top-level folders (simple slugs like "product" or "business")
        if (!a.slug.includes('/') && !b.slug.includes('/')) {
            if (topLevelOrder[nameA] && topLevelOrder[nameB]) {
                return topLevelOrder[nameA] - topLevelOrder[nameB];
            }
        }

        // Extract number prefix from slug (e.g., "01-intro" -> 1)
        const getNum = (slug) => {
            // Try matching full slug segment logic or just filename
            const parts = slug.split('/');
            const lastPart = parts[parts.length - 1];
            const match = lastPart.match(/^(\d+)-/);
            return match ? parseInt(match[1], 10) : 999;
        };

        const numA = getNum(a.slug);
        const numB = getNum(b.slug);

        if (numA !== numB) return numA - numB;
        return a.title.localeCompare(b.title);
    });

    return items;
}

// Generate manifest
console.log('[sync-docs] Generating docs manifest...');
const manifest = scanDocs(targetRoot);

// Ensure Product README is Home
const readmePath = join(targetRoot, 'product/README.md');
if (existsSync(readmePath)) {
    manifest.unshift({
        slug: 'home',
        title: 'Overview',
        path: '/docs/product/README.md',
        order: 0,
    });
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`[sync-docs] ✅ Generated manifest with ${manifest.length} items (root level)`);
console.log('[sync-docs] Done!');
