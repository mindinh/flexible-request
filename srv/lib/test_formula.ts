import { formulaEvaluator } from './formula-evaluator';

const data = {
    "Number": 5,
    "__request_uuid": "123"
};

const res1 = formulaEvaluator.evaluate("{{UserTask1.Number}} * 2", data);
const res2 = formulaEvaluator.evaluate("{{Number}} * 2", data);

console.log("With UserTask1.Number (Undefined variable fallback):", res1);
console.log("With Number (Valid variable):", res2);
