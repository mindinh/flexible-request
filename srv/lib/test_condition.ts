

const evaluateLogic = (logicStr: string | null | undefined, combinedData: Record<string, unknown>): boolean => {
    if (!logicStr || logicStr === '{}') return true;

    try {
        const logic = JSON.parse(logicStr) as { matchType: 'AND' | 'OR', rules: { fieldId: string, operator: string, value: string }[] };
        if (!logic.rules || logic.rules.length === 0) return true;

        const evaluateRule = (rule: { fieldId: string, operator: string, value: string }): boolean => {
            const dataValue = combinedData[rule.fieldId];
            console.log("Evaluating rule:", rule);
            console.log("Data value in combinedData:", dataValue, "Type:", typeof dataValue);

            if (dataValue === undefined || dataValue === null) {
                console.log("Rule failed: dataValue is undefined or null");
                return false;
            }

            const stringData = String(dataValue).toLowerCase();
            const stringTarget = String(rule.value || '').toLowerCase();
            console.log("Comparing:", stringData, "vs", stringTarget);

            switch (rule.operator) {
                case 'EQUALS':
                    return stringData === stringTarget;
                case 'NOT_EQUALS':
                    return stringData !== stringTarget;
                case 'CONTAINS':
                    return stringData.includes(stringTarget);
                case 'GREATER_THAN':
                    return Number(dataValue) > Number(rule.value);
                case 'LESS_THAN':
                    return Number(dataValue) < Number(rule.value);
                default:
                    return false;
            }
        };

        if (logic.matchType === 'AND') {
            return logic.rules.every(evaluateRule);
        } else { // 'OR'
            return logic.rules.some(evaluateRule);
        }
    } catch (e) {
        console.error(e);
        return false;
    }
}

const logicStr = JSON.stringify({
    matchType: 'AND',
    rules: [
        { fieldId: 'text-123', operator: 'GREATER_THAN', value: '10' }
    ]
});

const data = {
    'text-123': 20
};

console.log("Result:", evaluateLogic(logicStr, data));
