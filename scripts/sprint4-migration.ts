/**
 * Data Migration Script: Sprint 4 Full Migration
 * 
 * Performs complete data migration for Authorization & Roles:
 * 1. Migrate existing users (createdBy) to ShadowUsers
 * 2. Migrate ApproverRules to new principal model
 * 
 * Usage:
 *   npx ts-node scripts/sprint4-migration.ts [--dry-run]
 * 
 * Options:
 *   --dry-run     Preview changes without modifying database
 */

import cds from '@sap/cds';

interface MigrationResult {
    step: string;
    total: number;
    migrated: number;
    skipped: number;
    errors: string[];
}

async function runMigration(dryRun: boolean = false): Promise<MigrationResult[]> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Sprint 4 Data Migration`);
    console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes)' : 'LIVE'}`);
    console.log(`${'='.repeat(70)}\n`);

    const db = await cds.connect.to('db');
    const results: MigrationResult[] = [];

    // Step 1: Migrate Users
    const userResult = await migrateUsers(db, dryRun);
    results.push(userResult);

    // Step 2: Migrate ApproverRules
    const rulesResult = await migrateApproverRules(db, dryRun);
    results.push(rulesResult);

    // Step 3: Set requesters on existing requests
    const requestersResult = await migrateRequesters(db, dryRun);
    results.push(requestersResult);

    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Migration Summary:`);
    for (const r of results) {
        console.log(`  ${r.step}: ${r.migrated}/${r.total} migrated, ${r.skipped} skipped, ${r.errors.length} errors`);
    }
    console.log(`${'='.repeat(70)}\n`);

    return results;
}

/**
 * Step 1: Create ShadowUsers from unique createdBy values
 */
async function migrateUsers(db: cds.Service, dryRun: boolean): Promise<MigrationResult> {
    console.log('Step 1: Migrating Users to ShadowUsers...');

    const result: MigrationResult = {
        step: 'Users → ShadowUsers',
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: []
    };

    const { Requests, ShadowUsers } = db.entities('sap.cre');

    // Get unique createdBy values
    const requests = await cds.run(
        SELECT.from(Requests).columns('createdBy').distinct()
    );
    const uniqueUsers = [...new Set(requests.map((r: { createdBy?: string }) => r.createdBy).filter(Boolean))];
    result.total = uniqueUsers.length;

    for (const userId of uniqueUsers) {
        // Check if already exists
        const existing = await cds.run(
            SELECT.one.from(ShadowUsers).where({ userId })
        );

        if (existing) {
            console.log(`  SKIP: ${userId} (already exists)`);
            result.skipped++;
            continue;
        }

        console.log(`  MIGRATE: ${userId}`);

        if (!dryRun) {
            await cds.run(
                INSERT.into(ShadowUsers).entries({
                    userId,
                    displayName: userId,
                    isActive: true
                })
            );
        }

        result.migrated++;
    }

    return result;
}

/**
 * Step 2: Migrate ApproverRules to principal model
 */
async function migrateApproverRules(db: cds.Service, dryRun: boolean): Promise<MigrationResult> {
    console.log('\nStep 2: Migrating ApproverRules to Principal Model...');

    const result: MigrationResult = {
        step: 'ApproverRules → Principal Model',
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: []
    };

    const { ApproverRules } = db.entities('sap.cre');

    const rules = await cds.run(
        SELECT.from(ApproverRules).columns(
            'ID', 'approverType', 'approverValue',
            'principalType', 'principalId', 'principalValue'
        )
    );

    result.total = rules.length;

    for (const rule of rules) {
        // Skip if already migrated
        if (rule.principalType && (rule.principalId || rule.principalValue)) {
            console.log(`  SKIP: Rule ${rule.ID.slice(0, 8)}... (already migrated)`);
            result.skipped++;
            continue;
        }

        // Skip if no legacy data
        if (!rule.approverType || !rule.approverValue) {
            console.log(`  SKIP: Rule ${rule.ID.slice(0, 8)}... (no legacy data)`);
            result.skipped++;
            continue;
        }

        console.log(`  MIGRATE: Rule ${rule.ID.slice(0, 8)}... (${rule.approverType})`);

        if (!dryRun) {
            await cds.run(
                UPDATE(ApproverRules).where({ ID: rule.ID }).set({
                    principalType: rule.approverType,
                    principalValue: rule.approverValue
                })
            );
        }

        result.migrated++;
    }

    return result;
}

/**
 * Step 3: Set requester_ID on existing requests
 */
async function migrateRequesters(db: cds.Service, dryRun: boolean): Promise<MigrationResult> {
    console.log('\nStep 3: Setting requester_ID on Requests...');

    const result: MigrationResult = {
        step: 'Requests → requester_ID',
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: []
    };

    const { Requests, ShadowUsers } = db.entities('sap.cre');

    const requests = await cds.run(
        SELECT.from(Requests).columns('ID', 'createdBy', 'requester_ID')
    );

    result.total = requests.length;

    for (const request of requests) {
        if (request.requester_ID) {
            result.skipped++;
            continue;
        }

        // Find ShadowUser for createdBy
        const user = await cds.run(
            SELECT.one.from(ShadowUsers)
                .where({ userId: request.createdBy })
                .columns('ID')
        );

        if (!user) {
            result.skipped++;
            continue;
        }

        console.log(`  MIGRATE: Request ${request.ID.slice(0, 8)}...`);

        if (!dryRun) {
            await cds.run(
                UPDATE(Requests).where({ ID: request.ID }).set({
                    requester_ID: user.ID
                })
            );
        }

        result.migrated++;
    }

    return result;
}

// Import helpers
const { SELECT, INSERT, UPDATE } = cds.ql;

// Main execution
const isDryRun = process.argv.includes('--dry-run');
runMigration(isDryRun)
    .then(results => {
        const hasErrors = results.some(r => r.errors.length > 0);
        process.exit(hasErrors ? 1 : 0);
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
