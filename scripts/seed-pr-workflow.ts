
import axios from 'axios';

const BASE_URL = 'http://localhost:4004/admin';
const AUTH = {
    username: 'alice',
    password: 'alice'
};

const client = axios.create({
    baseURL: BASE_URL,
    auth: AUTH
});

async function main() {
    try {
        console.log('🚀 Starting PR Workflow Seeding...');

        // 1. Create Request Type Draft
        console.log('Creating Request Type Draft...');
        const rtResponse = await client.post('/RequestTypes', {
            title: 'PR Approval (Fixed Assets)',
            description: 'Classical workflow for fixed asset procurement (Software, construction, major repairs)',
            isEnabled: true,
            icon: 'shopping-cart' // Just a guess, or 'sap-icon://cart'
        });
        const rtId = rtResponse.data.ID;
        console.log(`✅ Request Type created: ${rtId}`);

        // 2. Define Master Schema
        console.log('Updating Master Schema...');
        const masterSchema = [
            {
                id: 'description',
                label: 'Description / Purpose',
                type: 'textarea',
                required: true,
                placeholder: 'Describe the asset to be purchased...'
            },
            {
                id: 'totalAmount',
                label: 'Total Amount (VND)',
                type: 'number',
                required: true,
                placeholder: 'e.g. 150000000'
            },
            {
                id: 'currency',
                label: 'Currency',
                type: 'select',
                options: [
                    { label: 'VND', value: 'VND' },
                    { label: 'USD', value: 'USD' }
                ],
                value: 'VND'
            }
        ];

        // Update draft with master schema
        await client.patch(`/RequestTypes(ID='${rtId}',IsActiveEntity=false)`, {
            masterSchema: JSON.stringify(masterSchema)
        });

        // 3. Create Steps
        const steps = [
            { name: 'Create PR Request', start: true, sla: 1 },
            { name: 'HOD Appraisal', start: false, sla: 2 },
            { name: 'FC / CA Appraisal', start: false, sla: 3 },
            { name: 'EVP Appraisal', start: false, sla: 3 },
            { name: 'CFO Appraisal', start: false, sla: 3 },
            { name: 'Managing Director', start: false, sla: 5 },
        ];

        const stepIds: Record<string, string> = {};

        for (const step of steps) {
            console.log(`Creating Step: ${step.name}...`);
            const stepRes = await client.post(`/RequestTypes(ID='${rtId}',IsActiveEntity=false)/steps`, {
                stepName: step.name,
                isStartStep: step.start,
                slaDays: step.sla,
                schemaMode: 'INHERIT', // All steps inherit master schema
                syncTrigger: 'NONE'
            });
            stepIds[step.name] = stepRes.data.ID;
        }

        // 4. Create Dependencies (Edges) with Conditions
        const edges = [
            { from: 'Create PR Request', to: 'HOD Appraisal', condition: null },
            { from: 'HOD Appraisal', to: 'FC / CA Appraisal', condition: null },

            // FC -> EVP (> 200 Mil)
            {
                from: 'FC / CA Appraisal',
                to: 'EVP Appraisal',
                condition: [
                    { field: 'totalAmount', operator: 'gt', value: 200000000 }
                ]
            },

            // EVP -> CFO (> 1 Bil)
            {
                from: 'EVP Appraisal',
                to: 'CFO Appraisal',
                condition: [
                    { field: 'totalAmount', operator: 'gt', value: 1000000000 }
                ]
            },

            // CFO -> MD (> 2 Bil)
            {
                from: 'CFO Appraisal',
                to: 'Managing Director',
                condition: [
                    { field: 'totalAmount', operator: 'gt', value: 2000000000 }
                ]
            }
        ];

        for (const edge of edges) {
            const fromId = stepIds[edge.from]; // Predcessor
            const toId = stepIds[edge.to]; // Successor (The step that HAS the predecessor)

            console.log(`Linking ${edge.from} -> ${edge.to}...`);

            // Create dependency: POST to successors' /predecessors
            // URL: /StepDefinitions(ID='toId',...)/predecessors
            // Payload: { dependsOn_ID: fromId, condition: ... }

            const payload: any = { dependsOn_ID: fromId };
            if (edge.condition) {
                payload.condition = JSON.stringify(edge.condition);
            }

            await client.post(`/StepDefinitions(ID='${toId}',IsActiveEntity=false)/predecessors`, payload);
        }

        // 5. Activate Request Type
        console.log('Activating Request Type...');
        await client.post(`/RequestTypes(ID='${rtId}',IsActiveEntity=false)/AdminService.draftActivate`);

        console.log('✅ Workflow Seeded Successfully!');
        console.log('Request Type ID:', rtId);

    } catch (err: any) {
        console.error('❌ Error seeding workflow:', err.message);
        if (err.response) {
            console.error('Response:', err.response.data);
        }
    }
}

main();
