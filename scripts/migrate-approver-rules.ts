/**
 * Migration Script: ApproverRules to Principal Model
 * 
 * Migrates legacy approverType/approverValue fields to the new
 * principalType/principalId/principalValue model.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-approver-rules.ts [--dry-run]
 * 
 * Options:
 *   --dry-run     Preview changes without modifying database
 */

import cds from '@sap/cds';

interface LegacyRule {
    ID: string;
    approverType: string;
    approverValue: string;
    principalType?: string;
    principalId?: string;
    principalValue?: string;
}

interface MigrationResult {
    total: number;
    migrated: number;
    skipped: number;
    errors: string[];
}

async function migrate(dryRun: boolean = false): Promise<MigrationResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ApproverRules Migration to Principal Model`);
    console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes)' : 'LIVE'}`);
    console.log(`${'='.repeat(60)}\n`);

    const db = await cds.connect.to('db');
    const { ApproverRules } = db.entities('sap.cre');

    const result: MigrationResult = {
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: []
    };

    // Get all rules that have legacy fields but no new principal fields
    const rules = await cds.run(
        SELECT.from(ApproverRules).columns(
            'ID', 'approverType', 'approverValue',
            'principalType', 'principalId', 'principalValue'
        )
    ) as LegacyRule[];

    result.total = rules.length;
    console.log(`Found ${rules.length} ApproverRules to process\n`);

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

        try {
            // Map legacy type to new principal type
            const principalType = mapApproverType(rule.approverType);
            const principalValue = rule.approverValue;

            // For USER type, try to find existing ShadowUser
            let principalId: string | null = null;
            if (principalType === 'USER') {
                const { ShadowUsers } = db.entities('sap.cre');
                const user = await cds.run(
                    SELECT.one.from(ShadowUsers)
                        .where({ userId: principalValue })
                        .columns('ID')
                );
                principalId = user?.ID ?? null;
            }

            console.log(`  MIGRATE: Rule ${rule.ID.slice(0, 8)}...`);
            console.log(`           ${rule.approverType} -> ${principalType}`);
            console.log(`           Value: ${principalValue}${principalId ? ` (ID: ${principalId.slice(0, 8)}...)` : ''}`);

            if (!dryRun) {
                await cds.run(
                    UPDATE(ApproverRules).where({ ID: rule.ID }).set({
                        principalType,
                        principalId,
                        principalValue
                    })
                );
            }

            result.migrated++;

        } catch (error) {
            const errMsg = `Rule ${rule.ID}: ${(error as Error).message}`;
            console.log(`  ERROR: ${errMsg}`);
            result.errors.push(errMsg);
        }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Migration Summary:`);
    console.log(`  Total:    ${result.total}`);
    console.log(`  Migrated: ${result.migrated}`);
    console.log(`  Skipped:  ${result.skipped}`);
    console.log(`  Errors:   ${result.errors.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return result;
}

/**
 * Map legacy approverType enum to new principalType string
 */
function mapApproverType(legacyType: string): string {
    const mapping: Record<string, string> = {
        'USER': 'USER',
        'ROLE': 'ROLE',
        'GROUP': 'GROUP',
        'TEAM': 'TEAM',
        'POSITION': 'POSITION',
        'DEPARTMENT': 'DEPARTMENT'
    };
    return mapping[legacyType] ?? 'USER';
}

// Import CQL helpers
const { SELECT, UPDATE } = cds.ql;

// Main execution
const isDryRun = process.argv.includes('--dry-run');
migrate(isDryRun)
    .then(result => {
        if (result.errors.length > 0) {
            process.exit(1);
        }
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
