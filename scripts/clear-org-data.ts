/**
 * Clear all Organization Hierarchy data for clean testing.
 * Deletes: OrgHierarchies, GroupMembers, ShadowGroups
 *
 * Usage: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/clear-org-data.ts
 */
import axios from 'axios';

const BASE = 'http://localhost:4004/admin';

async function clearAll() {
    console.log('🗑️  Clearing Organization Hierarchy data...\n');

    // 1. Delete OrgHierarchies
    const hierRes = await axios.get(`${BASE}/OrgHierarchies`);
    const hierarchies = hierRes.data.value;
    console.log(`  Found ${hierarchies.length} OrgHierarchy records`);
    for (const h of hierarchies) {
        await axios.delete(`${BASE}/OrgHierarchies(ID='${h.ID}')`);
    }
    console.log('  ✅ OrgHierarchies cleared');

    // 2. Delete GroupMembers
    const membRes = await axios.get(`${BASE}/GroupMembers`);
    const members = membRes.data.value;
    console.log(`  Found ${members.length} GroupMember records`);
    for (const m of members) {
        await axios.delete(`${BASE}/GroupMembers(ID='${m.ID}')`);
    }
    console.log('  ✅ GroupMembers cleared');

    // 3. Delete ShadowGroups
    const grpRes = await axios.get(`${BASE}/ShadowGroups`);
    const groups = grpRes.data.value;
    console.log(`  Found ${groups.length} ShadowGroup records`);
    for (const g of groups) {
        await axios.delete(`${BASE}/ShadowGroups(ID='${g.ID}')`);
    }
    console.log('  ✅ ShadowGroups cleared');

    console.log('\n🎉 All org data cleared. You can now create a fresh hierarchy.');
}

clearAll().catch((err) => {
    console.error('❌ Failed:', err.response?.data || err.message);
    process.exit(1);
});
