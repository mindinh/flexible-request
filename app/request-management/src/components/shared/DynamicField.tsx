
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Input, TextArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, DatePicker } from '../../components/ui';
import { Checkbox } from '../../components/ui/Checkbox';
import { Label } from '../../components/ui/label';
import { useIntegrationsStore } from '../../features/integrations/useIntegrationsStore';
import axios from 'axios';

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
        source?: {
            apiConfigId: string;
            path: string;
            valueField: string;
            displayField: string;
            filter?: string;
            expand?: string;
            top?: number;
            skip?: number;
        };
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

/**
 * Hook: fetch dynamic options from an API connection when valueHelp.type is Dynamic.
 */
function useDynamicOptions(field: SchemaField) {
    const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const source = field.valueHelp?.source;
    const isDynamic = field.valueHelp?.type === 'Dynamic' && source?.apiConfigId && source?.path;
    const getConnection = useIntegrationsStore((s) => s.getConnection);
    const fetchConnections = useIntegrationsStore((s) => s.fetchConnections);

    // Ensure connections are loaded from backend
    useEffect(() => { fetchConnections(); }, [fetchConnections]);

    useEffect(() => {
        if (!isDynamic || !source) return;

        const conn = getConnection(source.apiConfigId);
        if (!conn) {
            setError('API connection not found');
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        const fetchOptions = async () => {
            try {
                // Build headers from connection auth
                const headers: Record<string, string> = {};
                if (conn.authType === 'basic' && conn.username && conn.password) {
                    headers['Authorization'] = 'Basic ' + btoa(`${conn.username}:${conn.password}`);
                } else if (conn.authType === 'bearer' && conn.token) {
                    headers['Authorization'] = `Bearer ${conn.token}`;
                }

                // Build OData query params
                const params: Record<string, string | number> = {};
                if (source.filter) params['$filter'] = source.filter;
                if (source.expand) params['$expand'] = source.expand;
                if (source.top) params['$top'] = source.top;
                if (source.skip) params['$skip'] = source.skip;

                const url = `${conn.baseUrl.replace(/\/$/, '')}${source.path}`;
                const res = await axios.get(url, {
                    headers,
                    params,
                    // CAP OData parser requires %20 for spaces, not + (default axios encoding)
                    paramsSerializer: (p) => {
                        return Object.entries(p)
                            .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
                            .join('&');
                    },
                    timeout: 15000,
                });

                if (cancelled) return;

                // Process response — OData returns .value array, plain APIs may return array directly
                const data = Array.isArray(res.data) ? res.data : res.data?.value ?? [];
                const valueField = source.valueField || 'ID';
                const displayField = source.displayField || 'name';

                const mapped = data.map((item: any) => ({
                    value: String(item[valueField] ?? ''),
                    label: String(item[displayField] ?? ''),
                })).filter((opt: { value: string; label: string }) => opt.value && opt.label);

                setOptions(mapped);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || 'Failed to fetch options');
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchOptions();
        return () => { cancelled = true; };
    }, [
        isDynamic,
        source?.apiConfigId,
        source?.path,
        source?.valueField,
        source?.displayField,
        source?.filter,
        source?.expand,
        source?.top,
        source?.skip,
        getConnection,
    ]);

    return { options, isLoading, error, isDynamic };
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

    // Fetch dynamic options when needed
    const { options: dynamicOptions, isLoading: dynamicLoading, isDynamic } = useDynamicOptions(field);

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
            // Merge static + dynamic options
            const staticOptions = getFieldOptions(field);
            const allOptions = isDynamic ? [...staticOptions, ...dynamicOptions] : staticOptions;
            const effectiveValue = value || field.defaultValue || '';
            return (
                <Select
                    value={effectiveValue || undefined}
                    onValueChange={(val) => onChange(val)}
                    disabled={isDisabled || dynamicLoading}
                >
                    <SelectTrigger>
                        <SelectValue placeholder={
                            dynamicLoading
                                ? 'Loading options...'
                                : field.placeholder || `Select ${field.label}...`
                        } />
                    </SelectTrigger>
                    <SelectContent>
                        {allOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                        {allOptions.length === 0 && !dynamicLoading && (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">
                                No options available
                            </div>
                        )}
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
