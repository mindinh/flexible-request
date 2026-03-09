import cds from '@sap/cds';

/**
 * FormulaEvaluator
 * 
 * Shared utility for evaluating mathematical expressions with variable substitution.
 * Supports standard arithmetic: +, -, *, /, %, **, ()
 */
export class FormulaEvaluator {
    private log = cds.log('formula-evaluator');

    /**
     * Evaluates a formula expression against a data payload.
     * 
     * @param expression - The math expression string (e.g., "{{Step.Amount}} * 1.1")
     * @param data - The data object containing variable values
     * @returns The calculated number or null if evaluation fails
     */
    public evaluate(expression: string, data: Record<string, any>): number | null {
        if (!expression || expression.trim() === '') return null;

        try {
            // 1. Replace variables {{Path.To.Field}} with actual values
            const replacedExpression = expression.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
                const val = this.getNestedValue(data, path.trim());

                // If value is null/undefined/non-numeric, default to 0 for math safety?
                // Or should we throw? Let's treat null/missing as 0 for calculations.
                if (val === null || val === undefined) return '0';

                // Ensure the value is a number string
                const numVal = Number(val);
                return isNaN(numVal) ? '0' : numVal.toString();
            });

            // 2. Sanitize the expression to prevent RCE (though we only allow math operators)
            // Allow only: digits, decimal points, spaces, and math operators: + - * / % ( ) **
            const sanitizedExpression = replacedExpression.replace(/[^-0-9. +*/%()]/g, '');

            // 3. Evaluate using Function constructor (safer than eval after sanitization)
            // We use standard JS math
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            const result = new Function(`return (${sanitizedExpression})`)();

            const finalResult = Number(result);
            return isNaN(finalResult) ? null : finalResult;
        } catch (e) {
            this.log.error(`Failed to evaluate formula: "${expression}"`, e);
            return null;
        }
    }

    /**
     * Get a nested value from an object using dot notation.
     */
    private getNestedValue(obj: Record<string, any>, path: string): any {
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }

        return current;
    }
}

export const formulaEvaluator = new FormulaEvaluator();
