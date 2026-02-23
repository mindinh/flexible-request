
import { format } from 'date-fns';
import { Input, TextArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DatePicker } from '../../components/ui';
import { Checkbox } from '../../components/ui/Checkbox';
import { Label } from '../../components/ui/label';

export interface SchemaField {
    id: string;
    label: string;
    type?: string;
    controlType: string;
    dataType?: string;
    required?: boolean;
    placeholder?: string;
    colSpan?: number;
    disabled?: boolean;
    readOnly?: boolean;
    defaultValue?: string;
    options?: Array<{ value: string; label: string }>;
    valueHelp?: {
        type?: 'Static' | 'Reference' | 'Dynamic';
        items?: Array<{ key: string; label: string }>;
    };
}

interface DynamicFieldProps {
    field: SchemaField;
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
}

/**
 * Resolve dropdown/radio/checkbox options from either
 * `field.options` ({value, label}) or `field.valueHelp.items` ({key, label}).
 */
function getFieldOptions(field: SchemaField): Array<{ value: string; label: string }> {
    if (field.options && field.options.length > 0) {
        return field.options;
    }
    if (field.valueHelp?.items && field.valueHelp.items.length > 0) {
        return field.valueHelp.items.map(item => ({ value: item.label, label: item.label }));
    }
    return [];
}

export function DynamicField({
    field,
    value,
    onChange,
    disabled
}: DynamicFieldProps) {
    const isDisabled = disabled || field.disabled || field.readOnly;
    // Studio stores the kind as `type`, but some paths set `controlType` instead.
    // Normalise so the switch always works.
    const controlType = field.controlType || field.type || 'text';

    switch (controlType) {
        case 'text':
        case 'email':
        case 'phone':
            return (
                <Input
                    type={field.controlType === 'email' ? 'email' : 'text'}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    required={false}
                    disabled={isDisabled}
                />
            );
        case 'number':
            return (
                <Input
                    type="number"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
                    placeholder={field.placeholder || '0'}
                    required={false}
                    disabled={isDisabled}
                />
            );
        case 'date':
            // Parses "YYYY-MM-DD" as Local Noon to avoid midnight timezone shifts
            const dateValue = value ? new Date(`${value}T12:00:00`) : undefined;
            return (
                <DatePicker
                    value={dateValue}
                    onChange={(date) => {
                        if (!date) return onChange('');
                        // Format back to YYYY-MM-DD
                        onChange(format(date, 'yyyy-MM-dd'));
                    }}
                    placeholder={field.placeholder || `Select ${field.label.toLowerCase()}...`}
                    disabled={isDisabled}
                    required={false}
                />
            );
        case 'textarea':
            return (
                <TextArea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    required={false}
                    rows={4}
                    className="resize-none"
                    disabled={isDisabled}
                />
            );
        case 'select':
        case 'dropdown': {
            const options = getFieldOptions(field);
            const effectiveValue = value || field.defaultValue || '';
            return (
                <Select
                    value={effectiveValue}
                    onValueChange={(val) => onChange(val)}
                    disabled={isDisabled}
                >
                    <SelectTrigger>
                        <SelectValue placeholder={field.placeholder || `Select ${field.label}...`} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }
        case 'checkbox':
            return (
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={field.id}
                        checked={!!value}
                        onCheckedChange={(checked) => onChange(checked)}
                        disabled={isDisabled}
                    />
                    <Label
                        htmlFor={field.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        {field.placeholder || 'Enable'}
                    </Label>
                </div>
            );
        case 'file':
            return (
                <Input
                    type="file"
                    onChange={(e) => onChange(e.target.files?.[0]?.name || '')}
                    className="cursor-pointer file:text-primary file:font-semibold file:bg-primary/10 file:rounded-md file:border-0 file:px-2 file:mr-4 hover:file:bg-primary/20"
                    disabled={isDisabled}
                />
            );
        default:
            return (
                <Input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    disabled={isDisabled}
                />
            );
    }
}
