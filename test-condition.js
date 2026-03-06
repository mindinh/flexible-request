const axios = require('axios');

async function testCondition() {
    console.log("Creating new Request Type for Condition Test...");
    const adminApi = axios.create({ baseURL: 'http://localhost:4004/admin', auth: { username: 'alice', password: 'alice' } });
    const reqApi = axios.create({ baseURL: 'http://localhost:4004/browse', auth: { username: 'alice', password: 'alice' } });

    try {
        // 1. Create a Request Type
        const reqTypeRes = await adminApi.post('/RequestTypes', {
            title: 'Condition Test Workflow',
            description: 'Testing the routing logic of Condition Nodes',
            icon: 'git-branch',
            dataSchemaContent: JSON.stringify([
                { id: 'amount', name: 'Amount', type: 'number', required: true }
            ]),
            formSchemasContent: JSON.stringify([
                {
                    id: 'start-form',
                    name: 'Start Form',
                    items: [{ id: 'f1', type: 'number', label: 'Amount', required: true, dataBinding: 'amount' }],
                    footerActions: [{ id: 'submit', label: 'Submit', variant: 'primary' }]
                }
            ])
        });
        const typeId = reqTypeRes.data.ID;
        console.log("Created Request Type:", typeId);

        // 2. Create Steps (Start -> Condition -> End_A / End_B)
        const startStep = await adminApi.post('/StepDefinitions', {
            requestType_ID: typeId,
            stepName: 'Start',
            stepType: 'start',
            isStartStep: true,
            formId: 'start-form'
        });

        const conditionStep = await adminApi.post('/StepDefinitions', {
            requestType_ID: typeId,
            stepName: 'Check Amount',
            stepType: 'condition',
            conditionLogic: JSON.stringify({
                matchType: 'AND',
                rules: [{ fieldId: 'amount', operator: 'GREATER_THAN', value: '1000' }]
            })
        });

        const endYesStep = await adminApi.post('/StepDefinitions', {
            requestType_ID: typeId,
            stepName: 'High Amount Route',
            stepType: 'end'
        });

        const endNoStep = await adminApi.post('/StepDefinitions', {
            requestType_ID: typeId,
            stepName: 'Low Amount Route',
            stepType: 'end'
        });

        // 3. Connect Steps
        console.log("Connecting Steps...");
        // Start -> Condition
        await adminApi.post('/StepDependencies', { step_ID: conditionStep.data.ID, dependsOn_ID: startStep.data.ID, action: 'submit' });
        // Condition Yes -> End Yes
        await adminApi.post('/StepDependencies', { step_ID: endYesStep.data.ID, dependsOn_ID: conditionStep.data.ID, action: 'true' });
        // Condition No -> End No
        await adminApi.post('/StepDependencies', { step_ID: endNoStep.data.ID, dependsOn_ID: conditionStep.data.ID, action: 'false' });

        // 4. Create Request 1 (Low Amount)
        console.log("\nTesting Low Amount (< 1000, should go to False Edge)");
        const req1 = await reqApi.post('/Requests', {
            title: 'Low Eq',
            requestType_ID: typeId,
            priority: 'LOW'
        });
        const r1id = req1.data.ID;
        console.log("Request created:", r1id);

        const r1Steps = (await reqApi.get(`/Steps?$filter=request_ID eq ${r1id}`)).data.value;
        const start1 = r1Steps.find(s => s.status === 'STARTED');

        await reqApi.patch(`/RequestData(step_ID=${start1.ID})`, { payload: JSON.stringify({ amount: 500 }) });
        await reqApi.post(`/Requests(${r1id})/submit`, {});

        // Check History
        const r1History = (await reqApi.get(`/StepHistory?$filter=step/request_ID eq ${r1id}&$orderby=timestamp asc&$expand=step($expand=stepDefinition)`)).data.value;
        console.log("Step History for Request 1 (Low):");
        r1History.forEach(h => {
            console.log(`- ${h.step?.stepDefinition?.stepName} | ${h.action} | ${h.comment}`);
        });

        const r1Final = await reqApi.get(`/Requests(${r1id})`);
        console.log("Request 1 Final Status:", r1Final.data.status);


        // 5. Create Request 2 (High Amount)
        console.log("\nTesting High Amount (> 1000, should go to True Edge)");
        const req2 = await reqApi.post('/Requests', {
            title: 'High Eq',
            requestType_ID: typeId,
            priority: 'HIGH'
        });
        const r2id = req2.data.ID;
        console.log("Request created:", r2id);

        const r2Steps = (await reqApi.get(`/Steps?$filter=request_ID eq ${r2id}`)).data.value;
        const start2 = r2Steps.find(s => s.status === 'STARTED');

        await reqApi.patch(`/RequestData(step_ID=${start2.ID})`, { payload: JSON.stringify({ amount: 5000 }) });
        await reqApi.post(`/Requests(${r2id})/submit`, {});

        // Check History
        const r2History = (await reqApi.get(`/StepHistory?$filter=step/request_ID eq ${r2id}&$orderby=timestamp asc&$expand=step($expand=stepDefinition)`)).data.value;
        console.log("Step History for Request 2 (High):");
        r2History.forEach(h => {
            console.log(`- ${h.step?.stepDefinition?.stepName} | ${h.action} | ${h.comment}`);
        });

        const r2Final = await reqApi.get(`/Requests(${r2id})`);
        console.log("Request 2 Final Status:", r2Final.data.status);

    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}

testCondition().catch(console.error);
