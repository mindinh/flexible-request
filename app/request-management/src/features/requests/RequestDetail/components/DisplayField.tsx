import { CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '../../../../components/ui';
import type { SchemaField } from '../../../../lib/schemaParser';
import type { FieldValue } from '../../../../types';

interface DisplayFieldProps {
    field: SchemaField;
    value: FieldValue;
}

/**
 * Read-only field display component for viewing request data
 * Renders different UI based on field controlType
 */
export function DisplayField({ field, value }: DisplayFieldProps) {
    const displayValue = value ?? '';
    const isEmpty = displayValue === '' || displayValue === null || displayValue === undefined;

    if (isEmpty) {
        return <p className="text-slate-400 italic text-sm">Not provided</p>;
    }

    switch (field.controlType) {
        case 'textarea':
            return (
                <p className="text-slate-900 whitespace-pre-wrap text-sm leading-relaxed">
                    {String(displayValue)}
                </p>
            );
        case 'email':
            return (
                <a href={`mailto:${displayValue}`} className="text-blue-600 hover:underline text-sm">
                    {String(displayValue)}
                </a>
            );
        case 'phone':
            return (
                <a href={`tel:${displayValue}`} className="text-blue-600 hover:underline text-sm">
                    {String(displayValue)}
                </a>
            );
        case 'date':
            return (
                <p className="text-slate-900 text-sm">
                    {new Date(displayValue).toLocaleDateString()}
                </p>
            );
        case 'checkbox':
            return (
                <div className="flex items-center gap-2">
                    {displayValue ? (
                        <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-slate-700">Yes</span>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-500">No</span>
                        </>
                    )}
                </div>
            );
        case 'number':
            return <p className="text-slate-900 font-medium text-sm">{displayValue}</p>;
        case 'select':
            return (
                <Badge variant="secondary" className="font-normal">
                    {String(displayValue)}
                </Badge>
            );
        case 'file':
            return (
                <p className="text-slate-900 text-sm flex items-center gap-2">
                    📎 {String(displayValue)}
                </p>
            );
        default:
            return <p className="text-slate-900 text-sm">{String(displayValue)}</p>;
    }
}
