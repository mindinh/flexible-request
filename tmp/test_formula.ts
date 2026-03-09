import { FormulaEvaluator } from '../srv/lib/formula-evaluator';

const evaluator = new FormulaEvaluator();

const testData = {
    Start: {
        Amount: 100,
        Tax: 10
    },
    Price: 50,
    Qty: 2,
    Nested: {
        Value: 5
    }
};

const tests = [
    { expr: "{{Start.Amount}} + {{Start.Tax}}", expected: 110 },
    { expr: "{{Price}} * {{Qty}}", expected: 100 },
    { expr: "({{Price}} * 0.9) - 5", expected: 40 },
    { expr: "{{Nested.Value}} ** 2", expected: 25 },
    { expr: "100 / 4", expected: 25 },
    { expr: "{{Missing.Field}} + 10", expected: 10 }, // Missing should be 0
    { expr: "invalid + 10", expected: 10 }, // Sanitized to 10
];

console.log("Running FormulaEvaluator tests...");
let passed = 0;

for (const test of tests) {
    const result = evaluator.evaluate(test.expr, testData);
    if (result === test.expected) {
        console.log(`✅ PASS: "${test.expr}" => ${result}`);
        passed++;
    } else {
        console.log(`❌ FAIL: "${test.expr}" => expected ${test.expected}, got ${result}`);
    }
}

console.log(`\nResult: ${passed}/${tests.length} tests passed.`);
process.exit(passed === tests.length ? 0 : 1);
