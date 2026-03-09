const axios = require('axios');
const cds = require('@sap/cds');

async function run() {
    const auth = 'Basic ' + Buffer.from('alice:alice').toString('base64');
    const baseUrl = 'http://localhost:4005/browse';

    console.log('--- Step 1: Fetching CSRF Token ---');
    const getResp = await axios.get(`${baseUrl}/RequestTypes`, {
        headers: { 'Authorization': auth, 'x-csrf-token': 'Fetch' },
        params: { '$top': 0 }
    });
    const csrfToken = getResp.headers['x-csrf-token'];
    console.log('CSRF Token:', csrfToken);

    console.log('\n--- Step 2: Creating Request ---');
    const leaveRequestId = 'f6a7b8c9-d0e1-2345-f123-456789012345';
    const createResp = await axios.post(`${baseUrl}/Requests`, {
        title: 'API Test Coordinator Fix',
        requestType_ID: leaveRequestId,
        priority: 'MEDIUM'
    }, {
        headers: {
            'Authorization': auth,
            'x-csrf-token': csrfToken,
            'Content-Type': 'application/json'
        }
    });

    const newRequestId = createResp.data.ID;
    console.log('Created Request ID:', newRequestId);

    // 3. Verify coordinator fields
    // Adding a small delay to ensure all async handlers have finished
    console.log('Waiting for handlers...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const db = await cds.connect.to('db');
    const updated = await db.run(SELECT.one.from('sap.cre.Requests', newRequestId)
        .columns('coordinatorId', 'coordinatorType', 'coordinatorValue'));

    console.log('Coordinator Data:', JSON.stringify(updated, null, 2));

    const aliceId = 'a1b2c3d4-0001-0001-0001-000000000001';
    if (updated.coordinatorId === aliceId && updated.coordinatorType === 'USER' && updated.coordinatorValue === 'Alice Admin') {
        console.log('✅ SUCCESS: Coordinator initialized correctly!');
    } else {
        console.error('❌ FAILURE: Coordinator initialization failed.');
    }

    console.log('\n--- Step 4: Testing Copy (Simulated Frontend Logic) ---');
    // Fetch source as the frontend would
    const sourceResp = await axios.get(`${baseUrl}/Requests(${newRequestId})`, {
        headers: { 'Authorization': auth }
    });
    const source = sourceResp.data;

    const copyPayload = {
        title: `Copy of ${source.title}`,
        description: source.description,
        priority: source.priority,
        requestType_ID: leaveRequestId,
        refRequest_ID: newRequestId,
        coordinatorId: source.coordinatorId,
        coordinatorType: source.coordinatorType,
        coordinatorValue: source.coordinatorValue,
    };

    const copyResp = await axios.post(`${baseUrl}/Requests`, copyPayload, {
        headers: {
            'Authorization': auth,
            'x-csrf-token': csrfToken,
            'Content-Type': 'application/json'
        }
    });

    const copiedId = copyResp.data.ID;
    console.log('Copied Request ID:', copiedId);

    // Wait for copy handlers
    await new Promise(resolve => setTimeout(resolve, 500));

    const copied = await db.run(SELECT.one.from('sap.cre.Requests', copiedId)
        .columns('coordinatorId', 'coordinatorType', 'coordinatorValue'));

    console.log('Copied Coordinator Data:', JSON.stringify(copied, null, 2));

    if (copied.coordinatorId === source.coordinatorId && copied.coordinatorValue === source.coordinatorValue) {
        console.log('✅ SUCCESS: Coordinator info preserved in copy!');
    } else {
        console.error('❌ FAILURE: Coordinator info lost in copy.');
    }
}

run().catch(err => {
    console.error('Test failed with error:', err.response?.data || err.message);
    process.exit(1);
});
