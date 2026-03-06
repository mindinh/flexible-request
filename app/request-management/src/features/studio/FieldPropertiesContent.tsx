import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';
import { useEffect } from 'react';
import {
    Copy, Trash2, Settings2, Plus, GripVertical,
    Type, Hash, List, CheckSquare, CircleDot, Mail, SlidersHorizontal,
    DollarSign, Tag, Image, Clock, Paperclip, TextCursorInput
} from 'lucide-react';
import type { UiCanvasItem, UiSection, UiFormField, UiTableField, FieldConstraints, ValueHelpConfig, ValueHelpItem } from './types';
import { useIntegrationsStore } from '../integrations/useIntegrationsStore';

// Type guards
function isUiSection(item: UiCanvasItem): item is UiSection {
    return item.type === 'section' && 'fields' in item;
}

function isUiTableField(item: UiCanvasItem | UiTableField): item is UiTableField {
    return item.type === 'table' && 'columns' in item;
}

function isUiFormField(item: UiCanvasItem | UiFormField): item is UiFormField {
    return item.type !== 'section' && item.type !== 'table';
}



/** Update payload type for field properties */
type FieldUpdatePayload = Partial<UiFormField> & {
    constraints?: Partial<FieldConstraints>;
    valueHelp?: Partial<ValueHelpConfig>;
};

// ─── Section Divider ───
function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-2">
            {children}
        </span>
    );
}



// ─── Control Type Selector ───
const CONTROL_TYPES = [
    { value: 'text', label: 'Input Field', icon: TextCursorInput },
    { value: 'textarea', label: 'Text Area', icon: Type },
    { value: 'number', label: 'Number', icon: Hash },
    { value: 'currency', label: 'Currency', icon: DollarSign },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'slider', label: 'Slider', icon: SlidersHorizontal },
    { value: 'label', label: 'Label', icon: Tag },
    { value: 'select', label: 'Dropdown', icon: List },
    { value: 'radio', label: 'Radio', icon: CircleDot },
    { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
    { value: 'date', label: 'Date & Time', icon: Clock },
    { value: 'file', label: 'Attachment', icon: Paperclip },
    { value: 'image', label: 'Image', icon: Image },
];

function ControlTypeSelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    return (
        <div className="space-y-1.5">
            <SectionLabel>Control Type</SectionLabel>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select control type..." />
                </SelectTrigger>
                <SelectContent>
                    {CONTROL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                                <type.icon size={14} className="text-slate-400" />
                                <span>{type.label}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

// ─── Option Manager (for Static options) ───
function OptionManager({
    items,
    onChange,
}: {
    items: ValueHelpItem[];
    onChange: (items: ValueHelpItem[]) => void;
}) {
    const addOption = () => {
        const newItem: ValueHelpItem = {
            key: `opt_${Date.now()}`,
            label: `Option ${items.length + 1}`,
        };
        onChange([...items, newItem]);
    };

    const updateOption = (index: number, label: string) => {
        const updated = items.map((item, i) => (i === index ? { ...item, label } : item));
        onChange(updated);
    };

    const deleteOption = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={item.key} className="flex items-center gap-1.5 group">
                    <GripVertical size={14} className="text-slate-300 flex-shrink-0 cursor-grab" />
                    <Input
                        value={item.label}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1 h-8 text-sm"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => deleteOption(index)}
                    >
                        <Trash2 size={14} />
                    </Button>
                </div>
            ))}
            <Button
                onClick={addOption}
                className="w-full h-9 bg-primary text-white hover:bg-primary/90"
            >
                <Plus size={14} className="mr-1.5" />
                Add Option
            </Button>
        </div>
    );
}

// ─── API Configuration Pane (for Dynamic data source) ───
function ApiConfigPane({
    source,
    onChange,
}: {
    source?: ValueHelpConfig['source'];
    onChange: (source: ValueHelpConfig['source']) => void;
}) {
    const { connections, fetchConnections } = useIntegrationsStore();

    useEffect(() => { fetchConnections(); }, [fetchConnections]);

    const update = (patch: Partial<NonNullable<ValueHelpConfig['source']>>) => {
        onChange({
            apiConfigId: source?.apiConfigId || '',
            path: source?.path || '',
            valueField: source?.valueField || '',
            displayField: source?.displayField || '',
            ...source,
            ...patch,
        });
    };

    return (
        <div className="space-y-3">
            <SectionLabel>API Connection</SectionLabel>
            {connections.length === 0 ? (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                    <p className="text-xs text-amber-600">
                        No API connections configured.{' '}
                        <a href="/integrations" className="underline font-medium hover:text-amber-800">
                            Add one in Integrations
                        </a>
                    </p>
                </div>
            ) : (
                <Select
                    value={source?.apiConfigId || undefined}
                    onValueChange={(val) => update({ apiConfigId: val })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a connection..." />
                    </SelectTrigger>
                    <SelectContent>
                        {connections.map((conn) => (
                            <SelectItem key={conn.ID} value={conn.ID}>
                                {conn.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            <SectionLabel>Endpoint Path</SectionLabel>
            <Input
                value={source?.path || ''}
                onChange={(e) => update({ path: e.target.value })}
                placeholder="/admin/ShadowGroups"
                className="font-mono text-xs"
            />

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <SectionLabel>Value Field</SectionLabel>
                    <Input
                        value={source?.valueField || ''}
                        onChange={(e) => update({ valueField: e.target.value })}
                        placeholder="ID"
                        className="font-mono text-xs"
                    />
                </div>
                <div className="space-y-1">
                    <SectionLabel>Display Field</SectionLabel>
                    <Input
                        value={source?.displayField || ''}
                        onChange={(e) => update({ displayField: e.target.value })}
                        placeholder="name"
                        className="font-mono text-xs"
                    />
                </div>
            </div>

            {/* OData Query Parameters */}
            <SectionLabel>OData Parameters</SectionLabel>
            <Input
                value={source?.filter || ''}
                onChange={(e) => update({ filter: e.target.value })}
                placeholder="$filter — e.g. type eq 'Department'"
                className="font-mono text-xs"
            />
            <Input
                value={source?.expand || ''}
                onChange={(e) => update({ expand: e.target.value })}
                placeholder="$expand — e.g. type"
                className="font-mono text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
                <Input
                    type="number"
                    value={source?.top ?? ''}
                    onChange={(e) => update({ top: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="$top"
                    className="font-mono text-xs"
                />
                <Input
                    type="number"
                    value={source?.skip ?? ''}
                    onChange={(e) => update({ skip: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="$skip"
                    className="font-mono text-xs"
                />
            </div>
        </div>
    );
}

interface FieldPropertiesContentProps {
    schema: UiCanvasItem[];
    selectedFieldId: string;
    onUpdate: (id: string, updates: FieldUpdatePayload) => void;
    onDuplicate?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export function FieldPropertiesContent({ schema, selectedFieldId, onUpdate, onDuplicate, onDelete }: FieldPropertiesContentProps) {
    // Find the selected item
    let selectedItem: UiCanvasItem | UiFormField | null = null;
    for (const item of schema) {
        if (item.id === selectedFieldId) {
            selectedItem = item;
            break;
        }
        if (isUiSection(item)) {
            const field = item.fields.find(f => f.id === selectedFieldId);
            if (field) {
                selectedItem = field;
                break;
            }
        }
        if (isUiTableField(item)) {
            const column = item.columns.find(c => c.id === selectedFieldId);
            if (column) {
                selectedItem = column;
                break;
            }
        }
    }

    if (!selectedItem) {
        return (
            <div className="p-6 text-center text-slate-400">
                <Settings2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Field not found</p>
            </div>
        );
    }

    const isField = isUiFormField(selectedItem);
    const isTable = isUiTableField(selectedItem);
    const isSelectType = ['select', 'radio', 'checkbox'].includes(selectedItem.type);

    // Cast to UiFormField for type-safe property access when isField is true
    const fieldItem = isField ? selectedItem as UiFormField : null;

    // Data source mode for select-type fields
    const dataSourceType = fieldItem?.valueHelp?.type || 'Static';
    const staticItems = fieldItem?.valueHelp?.items || [];

    return (
        <div className="flex flex-col px-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <h4 className="font-semibold text-slate-800 text-sm">Field Properties</h4>
                </div>
            </div>

            <div className="space-y-4">
                {/* ── Table Actions (only for tables) ── */}
                {isTable && (
                    <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <h5 className="text-xs font-semibold text-slate-700">Table Actions</h5>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-normal">Enable Download Template</Label>
                            <Button
                                variant={(selectedItem as UiTableField).headerActions?.downloadTemplate ? "default" : "outline"}
                                size="sm"
                                className={`h-6 text-xs ${(selectedItem as UiTableField).headerActions?.downloadTemplate ? 'bg-primary text-primary-foreground' : 'text-slate-500'}`}
                                onClick={() => {
                                    const tableItem = selectedItem as UiTableField;
                                    const currentActions = tableItem.headerActions || {};
                                    onUpdate(tableItem.id, {
                                        headerActions: {
                                            ...currentActions,
                                            downloadTemplate: !currentActions.downloadTemplate
                                        }
                                    } as any);
                                }}
                            >
                                {(selectedItem as UiTableField).headerActions?.downloadTemplate ? 'On' : 'Off'}
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-normal">Enable Upload Excel</Label>
                            <Button
                                variant={(selectedItem as UiTableField).headerActions?.uploadExcel ? "default" : "outline"}
                                size="sm"
                                className={`h-6 text-xs ${(selectedItem as UiTableField).headerActions?.uploadExcel ? 'bg-primary text-primary-foreground' : 'text-slate-500'}`}
                                onClick={() => {
                                    const tableItem = selectedItem as UiTableField;
                                    const currentActions = tableItem.headerActions || {};
                                    onUpdate(tableItem.id, {
                                        headerActions: {
                                            ...currentActions,
                                            uploadExcel: !currentActions.uploadExcel
                                        }
                                    } as any);
                                }}
                            >
                                {(selectedItem as UiTableField).headerActions?.uploadExcel ? 'On' : 'Off'}
                            </Button>
                        </div>
                    </div>
                )}



                {/* ── FIELD LABEL ── */}
                <div className="space-y-1.5">
                    <SectionLabel>Field Label</SectionLabel>
                    <Input
                        value={selectedItem.label}
                        onChange={(e) => onUpdate(selectedItem!.id, { label: e.target.value })}
                    />
                </div>

                {/* ── CONTROL TYPE (only for form fields) ── */}
                {isField && (
                    <ControlTypeSelector
                        value={fieldItem!.type}
                        onChange={(val) => onUpdate(selectedItem!.id, { type: val })}
                    />
                )}

                {/* ── PLACEHOLDER ── */}
                {isField && (
                    <div className="space-y-1.5">
                        <SectionLabel>Placeholder</SectionLabel>
                        <Input
                            value={fieldItem?.placeholder || ''}
                            onChange={(e) => onUpdate(selectedItem!.id, { placeholder: e.target.value })}
                            placeholder="Enter placeholder text..."
                        />
                    </div>
                )}

                {/* ── DATA SOURCE (select-type only) ── */}
                {isField && isSelectType && (
                    <>
                        <div className="space-y-1.5">
                            <SectionLabel>Data Source</SectionLabel>
                            <div className="flex p-0.5 bg-slate-100 rounded-lg">
                                {(['Static', 'API'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => {
                                            const type = mode === 'API' ? 'Dynamic' : 'Static';
                                            onUpdate(selectedItem!.id, {
                                                valueHelp: { ...(fieldItem?.valueHelp || {}), type: type as any }
                                            });
                                        }}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${(mode === 'Static' && dataSourceType === 'Static') ||
                                            (mode === 'API' && dataSourceType !== 'Static')
                                            ? 'bg-white shadow-sm text-slate-800'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── OPTION MANAGER (static only) ── */}
                        {dataSourceType === 'Static' && (
                            <div className="space-y-1.5">
                                <SectionLabel>Option Manager</SectionLabel>
                                <OptionManager
                                    items={staticItems}
                                    onChange={(newItems) => {
                                        onUpdate(selectedItem!.id, {
                                            valueHelp: {
                                                ...(fieldItem?.valueHelp || {}),
                                                type: 'Static',
                                                items: newItems,
                                            }
                                        });
                                    }}
                                />
                            </div>
                        )}

                        {/* ── API Configuration ── */}
                        {dataSourceType !== 'Static' && (
                            <ApiConfigPane
                                source={fieldItem?.valueHelp?.source}
                                onChange={(source) => {
                                    onUpdate(selectedItem!.id, {
                                        valueHelp: {
                                            ...(fieldItem?.valueHelp || {}),
                                            type: 'Dynamic',
                                            source,
                                        }
                                    });
                                }}
                            />
                        )}
                    </>
                )}

                {/* ── FIELD STATE ── */}
                {isField && (
                    <div className="space-y-1.5">
                        <SectionLabel>Field State</SectionLabel>
                        <Select
                            value={
                                fieldItem?.readOnly
                                    ? 'readonly'
                                    : fieldItem?.required
                                        ? 'mandatory'
                                        : 'optional'
                            }
                            onValueChange={(val) => {
                                if (val === 'mandatory') {
                                    onUpdate(selectedItem!.id, { required: true, readOnly: false });
                                } else if (val === 'optional') {
                                    onUpdate(selectedItem!.id, { required: false, readOnly: false });
                                } else {
                                    onUpdate(selectedItem!.id, { required: false, readOnly: true });
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="optional">Optional</SelectItem>
                                <SelectItem value="mandatory">Mandatory</SelectItem>
                                <SelectItem value="readonly">Read-Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* ── DEFAULT VALUE ── */}
                {isField && (
                    <div className="space-y-1.5">
                        <SectionLabel>Default Value</SectionLabel>
                        {isSelectType && dataSourceType === 'Static' && staticItems.length > 0 ? (
                            <Select
                                value={fieldItem?.defaultValue || undefined}
                                onValueChange={(val) => onUpdate(selectedItem!.id, { defaultValue: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select default..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {staticItems.filter(item => item.label || item.key).map(item => (
                                        <SelectItem key={item.key} value={item.label || item.key}>
                                            {item.label || item.key}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={fieldItem?.defaultValue || ''}
                                onChange={(e) => onUpdate(selectedItem!.id, { defaultValue: e.target.value })}
                                placeholder="Enter default value"
                            />
                        )}
                    </div>
                )}

                {/* ── VALIDATION TYPE ── */}
                {isField && (
                    <div className="space-y-1.5">
                        <SectionLabel>Validation Type</SectionLabel>
                        <Select
                            value={fieldItem?.validationType || 'none'}
                            onValueChange={(val) => onUpdate(selectedItem!.id, { validationType: val as any })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="url">URL</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="custom">Custom Regex</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* ── MIN / MAX LENGTH ── */}
                {isField && (
                    <div className="space-y-1.5">
                        <SectionLabel>Min Length - Max Length</SectionLabel>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={fieldItem?.constraints?.minLength ?? ''}
                                onChange={(e) => onUpdate(selectedItem!.id, {
                                    constraints: { ...(fieldItem?.constraints || {}), minLength: e.target.value ? parseInt(e.target.value) : undefined }
                                })}
                                placeholder="Min"
                                className="flex-1"
                            />
                            <span className="text-xs text-slate-400">To</span>
                            <Input
                                type="number"
                                value={fieldItem?.constraints?.maxLength ?? ''}
                                onChange={(e) => onUpdate(selectedItem!.id, {
                                    constraints: { ...(fieldItem?.constraints || {}), maxLength: e.target.value ? parseInt(e.target.value) : undefined }
                                })}
                                placeholder="Max"
                                className="flex-1"
                            />
                        </div>
                    </div>
                )}

                {/* ── WIDTH ── */}
                {isField && (
                    <div className="space-y-1.5">
                        <SectionLabel>Width</SectionLabel>
                        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                            {[
                                { value: 3, label: '25%' },
                                { value: 6, label: '50%' },
                                { value: 9, label: '75%' },
                                { value: 12, label: '100%' },
                            ].map((option) => {
                                // Backward compat: legacy 1 → 6 (50%), legacy 2 → 12 (100%)
                                const raw = (fieldItem?.colSpan as number) || 6;
                                const currentColSpan = raw === 1 ? 6 : raw === 2 ? 12 : raw;
                                const isActive = currentColSpan === option.value;
                                return (
                                    <Button
                                        key={option.value}
                                        onClick={() => onUpdate(selectedItem!.id, { colSpan: option.value as any })}
                                        variant={isActive ? "outline" : "ghost"}
                                        className={`flex-1 h-8 text-xs ${isActive ? 'bg-white border-slate-200 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-transparent'}`}
                                    >
                                        {option.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── HELP TEXT ── */}
                {isField && (
                    <div className="space-y-1.5">
                        <SectionLabel>Help Text</SectionLabel>
                        <Textarea
                            value={fieldItem?.helpText || ''}
                            onChange={(e) => onUpdate(selectedItem!.id, { helpText: e.target.value })}
                            placeholder="Enter help text for this field..."
                            rows={3}
                            className="resize-none"
                        />
                    </div>
                )}
            </div>

            {/* ── Apply + Action Buttons ── */}
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                <Button
                    className="w-full bg-primary text-white hover:bg-primary/90 font-medium"
                >
                    Apply Changes
                </Button>
                <div className="flex gap-2">
                    <Button
                        onClick={() => onDuplicate?.(selectedItem!.id)}
                        variant="outline"
                        className="flex-1 text-slate-600"
                    >
                        <Copy size={14} className="mr-1" />
                        Duplicate
                    </Button>
                    <Button
                        onClick={() => onDelete?.(selectedItem!.id)}
                        variant="outline-destructive"
                        className="flex-1"
                    >
                        <Trash2 size={14} className="mr-1" />
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}
