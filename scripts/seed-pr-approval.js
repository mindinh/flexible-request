const axios = require('axios');

const API_BASE = 'http://localhost:4004/admin';
const AUTH = { username: 'alice', password: 'alice' };

// NESTED SCHEMA STRUCTURE (Based on SchemaTab.tsx nesting requirements)
const PR_SCHEMA = [
    {
        id: "section_info",
        type: "section",
        label: "General Information", // For SchemaTab
        title: "General Information", // For DynamicRequestForm
        fields: [
            {
                id: "title",
                type: "text",
                label: "PR Title",
                required: true,
                controlType: "text" // For DynamicRequestForm
            },
            {
                id: "description",
                type: "textarea",
                label: "Business Justification",
                controlType: "textarea"
            }
        ]
    },
    {
        id: "section_financial",
        type: "section",
        label: "Financial Details",
        title: "Financial Details",
        fields: [
            {
                id: "totalValue",
                type: "number",
                label: "Total Value (VND)",
                required: true,
                controlType: "number"
            },
            {
                id: "costCenter",
                type: "text",
                label: "Cost Center",
                controlType: "text"
            }
        ]
    }
];

const PAYLOAD = {
    title: "PR Approval for Fixed Asset (v2)",
    description: "Pattern 1: Classical Workflow (PR Approval) - Fixed Schema Structure",
    isEnabled: true,
    steps: [
        {
            stepName: "Create PR Request",
            isStartStep: true,
            schemaContent: JSON.stringify(PR_SCHEMA),
            approverRules: [
                { priority: 10, approverType: "ROLE", approverValue: "HOD", isFinal: false },
                { priority: 20, approverType: "ROLE", approverValue: "FC", conditionExpr: JSON.stringify({ field: "totalValue", operator: "lte", value: 200000000 }), isFinal: true },
                { priority: 30, approverType: "ROLE", approverValue: "FC", conditionExpr: JSON.stringify({ field: "totalValue", operator: "gt", value: 200000000 }), isFinal: false },
                { priority: 40, approverType: "ROLE", approverValue: "EVP", conditionExpr: JSON.stringify({ field: "totalValue", operator: "lte", value: 1000000000 }), isFinal: true },
                { priority: 50, approverType: "ROLE", approverValue: "EVP", conditionExpr: JSON.stringify({ field: "totalValue", operator: "gt", value: 1000000000 }), isFinal: false },
                { priority: 60, approverType: "ROLE", approverValue: "CFO", conditionExpr: JSON.stringify({ field: "totalValue", operator: "lte", value: 2000000000 }), isFinal: true },
                { priority: 70, approverType: "ROLE", approverValue: "CFO", conditionExpr: JSON.stringify({ field: "totalValue", operator: "gt", value: 2000000000 }), isFinal: false },
                { priority: 80, approverType: "ROLE", approverValue: "MD", conditionExpr: JSON.stringify({ field: "totalValue", operator: "gt", value: 2000000000 }), isFinal: true }
            ]
        }
    ]
};

async function seed() {
    try {
        console.log("🚀 Creating Draft (v2)...");
        // Create RequestType (Draft) with deep insert of Steps and ApproverRules
        const res = await axios.post(`${API_BASE}/RequestTypes`, PAYLOAD, { auth: AUTH });
        const draft = res.data;
        console.log(`✅ Draft Created: ${draft.ID}`);

        console.log("⚙️ Activating...");
        try {
            // Activate the draft
            // Standard CAP bound action path: /Entity(key)/Namespace.Action
            const activationUrl = `${API_BASE}/RequestTypes(ID='${draft.ID}',IsActiveEntity=false)/AdminService.draftActivate`;
            await axios.post(activationUrl, {}, { auth: AUTH });
            console.log("✅ Activated successfully!");
        } catch (activateErr) {
            console.error("⚠️ Activation failed (you might need to activate manually in UI):");
            if (activateErr.response) {
                console.error(`${activateErr.response.status} ${activateErr.response.statusText}`);
                console.error(JSON.stringify(activateErr.response.data, null, 2));
            } else {
                console.error(activateErr.message);
            }
        }

    } catch (err) {
        console.error("❌ Seeding Failed:", err.message);
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
            console.error(JSON.stringify(err.response.data, null, 2));
        }
    }
}

seed();
