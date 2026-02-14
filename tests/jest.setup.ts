/**
 * Jest Setup File - Bootstrap CDS before tests
 * 
 * This file runs before all tests to properly initialize the CDS framework.
 */
import cds from '@sap/cds';
import path from 'path';

// Set the project root (using forward slashes for cross-platform compatibility)
const projectRoot = path.resolve(__dirname, '..').replace(/\\/g, '/');

// Export for test files
export const PROJECT_ROOT = projectRoot;

// Bootstrap CDS environment
export async function bootstrapCDS(): Promise<cds.Service> {
    // Set root directory
    cds.root = projectRoot;
    process.env.CDS_ROOT = projectRoot;

    // Load model from specific files (avoiding glob pattern issues)
    const dbSchemaPath = path.join(projectRoot, 'db/schema').replace(/\\/g, '/');
    const srvPath = projectRoot + '/srv';

    // Load the main index.cds which imports everything
    await cds.load(projectRoot + '/db/schema.cds');

    // Deploy to in-memory database
    await cds.deploy('*').to('sqlite::memory:');

    // Connect to database and return
    return cds.connect.to('db');
}
