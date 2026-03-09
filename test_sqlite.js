const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite');

db.serialize(() => {
    db.each(`SELECT payload, step_ID FROM sap_cre_RequestData ORDER BY rowid DESC LIMIT 10`, (err, row) => {
        if (err) {
            console.error(err.message);
        }
        console.log(row.step_ID, row.payload);
    });

    db.each(`SELECT ID, stepDefinition_ID, request_ID, status FROM sap_cre_Steps ORDER BY createdAt DESC LIMIT 10`, (err, row) => {
        console.log("Step:", row);
    });

    db.each(`SELECT ID, conditionExpr FROM sap_cre_StepDefinitions WHERE actionType = 'CONDITION' ORDER BY ID DESC LIMIT 5`, (err, row) => {
        console.log("StepDef:", row);
    });
});

db.close();
