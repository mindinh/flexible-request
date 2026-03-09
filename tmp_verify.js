const cds = require('@sap/cds')

async function run() {
    console.log('--- Starting Verification ---')
    const { Requests, ShadowUsers, RequestTypes } = cds.entities('sap.cre')

    // 1. Ensure seed data is loaded for the test
    const aliceId = 'a1b2c3d4-0001-0001-0001-000000000001'
    const leaveRequestId = 'f6a7b8c9-d0e1-2345-f123-456789012345'

    // Mock user Alice
    cds.context = { user: new cds.User('alice') }

    // 2. Create request via Service
    console.log('Creating request...')
    const RequestService = await cds.connect.to('RequestService')
    const res = await RequestService.create('Requests').entries({
        title: 'Test Coordinator Fix',
        requestType_ID: leaveRequestId,
        priority: 'MEDIUM'
    })

    console.log('Created Request ID:', res.ID)

    // 3. Verify coordinator fields
    // We fetch from the database to ensure the AFTER CREATE handler persisted the changes
    const updated = await SELECT.one.from(Requests, res.ID)
        .columns('coordinatorId', 'coordinatorType', 'coordinatorValue')

    console.log('Coordinator Data:', JSON.stringify(updated, null, 2))

    if (updated.coordinatorId === aliceId && updated.coordinatorType === 'USER' && updated.coordinatorValue === 'Alice Admin') {
        console.log('SUCCESS: Coordinator initialized correctly!')
    } else {
        console.error('FAILURE: Coordinator initialization failed.')
        console.error(`Expected: ${aliceId}, got ${updated.coordinatorId}`)
        console.error(`Expected: Alice Admin, got ${updated.coordinatorValue}`)
        process.exit(1)
    }

    // 4. Test Copy Logic
    console.log('\n--- Testing Copy Logic ---')
    const copiedResp = await RequestService.send('copyRequest', { id: res.ID })
    const copiedId = copiedResp.ID
    console.log('Copied Request ID:', copiedId)

    const copied = await SELECT.one.from(Requests, copiedId)
        .columns('coordinatorId', 'coordinatorType', 'coordinatorValue')

    console.log('Copied Coordinator Data:', JSON.stringify(copied, null, 2))

    if (copied.coordinatorId === updated.coordinatorId && copied.coordinatorValue === updated.coordinatorValue) {
        console.log('SUCCESS: Coordinator info preserved in copy!')
    } else {
        console.error('FAILURE: Coordinator info lost in copy.')
        process.exit(1)
    }
}

// Run the test
cds.test(__dirname).run(run)
