const axios = require('axios');

const BASE_URL = 'http://localhost:4005/browse';
const AUTH_URL = 'http://localhost:4005/auth/login';

async function verifyFormulaSync() {
    console.log('--- Starting Formula Sync Verification ---');

    try {
        // 1. Basic Auth Setup (Alice is admin in mock)
        const auth = Buffer.from('alice:alice').toString('base64');
        const config = {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        };

        // 2. Create Request Type
        console.log('Creating Request Type with Formula...');
        const rtId = 'formula-sync-test-' + Date.now();
        await axios.post(`${BASE_URL}/RequestTypes`, {
            ID: rtId,
            title: 'Formula Sync Test',
            description: 'Test for formula output synchronization',
            formSchemasContent: JSON.stringify([
                {
                    id: 'form-1',
                    name: 'Input Form',
                    items: [
                        { id: 'val-a', label: 'Value A', type: 'number' },
                        { id: 'val-b', label: 'Value B', type: 'number' }
                    ]
                },
                {
                    id: 'form-2',
                    name: 'Output Form',
                    items: [
                        { id: 'result', label: 'Result', type: 'number' }
                    ]
                }
            ])
        }, config);

        // Define Steps
        const step1Id = 's1-' + Date.now();
        const step2Id = 's2-' + Date.now();
        const step3Id = 's3-' + Date.now();

        await axios.post(`${BASE_URL}/StepDefinitions`, {
            ID: step1Id,
            requestType_ID: rtId,
            stepName: 'Input Step',
            stepType: 'action',
            actionSubType: 'userTask',
            formId: 'form-1',
            isStartStep: true,
            order: 1
        }, config);

        await axios.post(`${BASE_URL}/StepDefinitions`, {
            ID: step2Id,
            requestType_ID: rtId,
            stepName: 'Calculate',
            stepType: 'action',
            actionSubType: 'formula',
            formulas: JSON.stringify([
                { id: 'calc-1', resultName: 'sum', expression: '{{InputStep.val-a}} + {{InputStep.val-b}}' }
            ]),
            order: 2
        }, config);

        await axios.post(`${BASE_URL}/StepDefinitions`, {
            ID: step3Id,
            requestType_ID: rtId,
            stepName: 'Verify Step',
            stepType: 'action',
            actionSubType: 'userTask',
            formId: 'form-2',
            inputMapping: JSON.stringify({
                'result': { sourceStepId: step2Id, sourceFieldId: 'calc-1' }
            }),
            order: 3
        }, config);

        // Dependencies
        await axios.post(`${BASE_URL}/StepDependencies`, { step_ID: step2Id, dependsOn_ID: step1Id }, config);
        await axios.post(`${BASE_URL}/StepDependencies`, { step_ID: step3Id, dependsOn_ID: step2Id }, config);

        // 3. Create Request
        console.log('Creating Request...');
        const createRes = await axios.post(`${BASE_URL}/Requests`, {
            requestType_ID: rtId,
            title: 'Test Formula Sync',
            priority: 'MEDIUM'
        }, config);
        const requestId = createRes.data.ID;

        // 4. Submit Step 1
        console.log('Submitting Step 1...');

        // Wait for step 1 to be fully created
        let s1Instance = null;
        for (let i = 0; i < 5; i++) {
            const stepsRes = await axios.get(`${BASE_URL}/Steps?$filter=request_ID eq ${requestId}`, config);
            s1Instance = stepsRes.data.value.find(s => s.stepDefinition_ID === step1Id);
            if (s1Instance) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!s1Instance) throw new Error('Step 1 not created');

        await axios.post(`${BASE_URL}/submitStepWithData`, {
            requestId: requestId,
            stepId: s1Instance.ID,
            payload: JSON.stringify({ 'val-a': 15, 'val-b': 25 })
        }, config);

        // 5. Verification: Check Step 3's RequestData immediately
        console.log('Verifying Step 3 payload...');
        // Wait a bit for async propagation
        await new Promise(r => setTimeout(r, 1000));

        const finalStepsRes = await axios.get(`${BASE_URL}/Steps?$filter=request_ID eq ${requestId}&$expand=data`, config);
        const s3Instance = finalStepsRes.data.value.find(s => s.stepDefinition_ID === step3Id);

        if (!s3Instance) {
            throw new Error('Step 3 (Verify Step) was not created!');
        }

        const payload = JSON.parse(s3Instance.data?.payload || '{}');
        console.log('Step 3 Payload:', payload);

        if (payload.result === 40) {
            console.log('✅ SUCCESS: Formula result (15+25=40) correctly mapped to Step 3!');
        } else {
            console.log('❌ FAILURE: Expected result 40, but got:', payload.result);
            process.exit(1);
        }

    } catch (err) {
        console.error('Error during verification:', err.name, err.message);
        if (err.response) console.error('Response data:', err.response.data);
        process.exit(1);
    }
}

verifyFormulaSync();
