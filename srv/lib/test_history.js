const cds = require('@sap/cds');

async function testConditions() {
    const db = await cds.connect.to('db');
    const { StepHistory, Steps, StepDefinitions } = db.entities('sap.cre');

    // Find recent condition evaluations
    const history = await SELECT.from(StepHistory)
        .where({ action: 'CONDITION_EVAL' })
        .orderBy('timestamp desc')
        .limit(10);

    for (const h of history) {
        console.log(`Step ${h.step_ID} evaluated to ${h.comment} at ${h.timestamp}`);
        const step = await SELECT.one.from(Steps).where({ ID: h.step_ID });
        const def = await SELECT.one.from(StepDefinitions).where({ ID: step.stepDefinition_ID });
        console.log(`Definition Logic: ${def.conditionExpr}`);
    }
}
testConditions().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
