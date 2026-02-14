import React from 'react';
import { format } from 'date-fns';
import { Input, TextArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DatePicker } from '../../components/ui';
import { Checkbox } from '../../components/ui/Checkbox';
import { Label } from '../../components/ui/label';

export interface SchemaField {
    id: string;
    label: string;
    controlType: string;
    dataType?: string;
    required?: boolean;
    placeholder?: string;
    colSpan?: number;
    disabled?: boolean;
    readOnly?: boolean;
}

interface DynamicFieldProps {
    field: SchemaField;
    value: any;
    onChange: (value: any) => void;
}

export function DynamicField({
    field,
    value,
    onChange
}: DynamicFieldProps) {
    const isDisabled = field.disabled || field.readOnly;

    switch (field.controlType) {
        case 'text':
        case 'email':
        case 'phone':
            return (
                <Input
                    type={field.controlType === 'email' ? 'email' : 'text'}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    required={field.required}
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
                    required={field.required}
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
                />
            );
        case 'textarea':
            return (
                <TextArea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                    required={field.required}
                    rows={4}
                    className="resize-none"
                    disabled={isDisabled}
                />
            );
        case 'select':
            return (
                <Select
                    value={value || ''}
                    onValueChange={(val) => onChange(val)}
                    disabled={isDisabled}
                >
                    <SelectTrigger>
                        <SelectValue placeholder={`Select ${field.label}...`} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="option1">Option 1</SelectItem>
                        <SelectItem value="option2">Option 2</SelectItem>
                        <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                </Select>
            );
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
