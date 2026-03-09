const cds = require('@sap/cds');

async function checkConditions() {
    const db = await cds.connect.to('db');
    const { Requests, Steps, RequestData, StepDefinitions } = db.entities;

    // Find the latest Request containing a Condition step
    const conditionSteps = await SELECT.from(Steps)
        .where('status =', 'COMPLETED')
        .orderBy('createdAt desc')
        .limit(10);

    let foundRequest = false;

    for (const step of conditionSteps) {
        const def = await SELECT.one.from(StepDefinitions).where({ ID: step.stepDefinition_ID });
        if (def && def.actionType === 'CONDITION') {
            foundRequest = true;
            console.log("\n--- Found Condition Step ---");
            console.log("Step ID:", step.ID);
            console.log("Request ID:", step.request_ID);
            console.log("Condition Expr:", def.conditionExpr);

            // Fetch combined data
            const allSteps = await SELECT.from(Steps).where({ request_ID: step.request_ID });
            const stepIds = allSteps.map(s => s.ID);

            const reqData = await SELECT.from(RequestData).where({ step_ID: { in: stepIds } });

            let combinedData = {};
            for (const d of reqData) {
                if (d.payload) {
                    try {
                        Object.assign(combinedData, JSON.parse(d.payload));
                    } catch (e) { }
                }
            }
            console.log("\n--- Combined Data (RAW) ---");
            console.log(JSON.stringify(combinedData, null, 2));

            // Wait, we need to apply outputs mapping like workflow.ts does
            const defs = await SELECT.from(StepDefinitions)
                .where({ ID: { in: [...new Set(allSteps.map(s => s.stepDefinition_ID))] } });

            for (const stepDef of defs) {
                if (stepDef.outputsContent) {
                    try {
                        const outputs = JSON.parse(stepDef.outputsContent);
                        for (const out of outputs) {
                            if (out.sourcePath && out.bindTo) {
                                if (combinedData[out.sourcePath] !== undefined) {
                                    combinedData[out.bindTo] = combinedData[out.sourcePath];
                                }
                            }
                        }
                    } catch (e) { }
                }
            }

            console.log("\n--- Combined Data (After outputsContent) ---");
            console.log(JSON.stringify(combinedData, null, 2));
            break;
        }
    }

    if (!foundRequest) {
        console.log("No completed conditions found.");
    }
}

checkConditions().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
