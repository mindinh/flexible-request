import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';
import { useState } from 'react';
import { Copy, Trash2, Type, Settings2 } from 'lucide-react';
import type { UiCanvasItem, UiSection, UiFormField, UiTableField, FieldConstraints, ValueHelpConfig } from './types';

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



// Helper: Get default dataType based on controlType
function getDefaultDataType(controlType: string): string {
    switch (controlType) {
        case 'number':
        case 'currency':
            return 'number';
        case 'date':
        case 'datetime':
            return 'date';
        case 'checkbox':
            return 'boolean';
        default:
            return 'string';
    }
}

type PropertyTab = 'general' | 'validation' | 'data' | 'advanced';

/** Update payload type for field properties */
type FieldUpdatePayload = Partial<UiFormField> & {
    constraints?: Partial<FieldConstraints>;
    valueHelp?: Partial<ValueHelpConfig>;
};

interface FieldPropertiesContentProps {
    schema: UiCanvasItem[];
    selectedFieldId: string;
    onUpdate: (id: string, updates: FieldUpdatePayload) => void;
    onDuplicate?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export function FieldPropertiesContent({ schema, selectedFieldId, onUpdate, onDuplicate, onDelete }: FieldPropertiesContentProps) {
    const [activeTab, setActiveTab] = useState<PropertyTab>('general');

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

    const tabs: { id: PropertyTab; label: string; show: boolean }[] = [
        { id: 'general', label: 'General', show: true },
        { id: 'validation', label: 'Rules', show: isField },
        { id: 'data', label: 'Options', show: isField && isSelectType },
        { id: 'advanced', label: 'More', show: isField },
    ];

    return (
        <div className="flex flex-col px-2">
            {/* Field Info Badge */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-lg border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-[var(--studio-primary)] text-white flex items-center justify-center">
                    <Type size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 truncate text-sm">{selectedItem.label}</h4>
                    <p className="text-xs text-slate-500 capitalize">{selectedItem.type} Field</p>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-slate-200 mb-4">
                {tabs.filter(t => t.show).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-2 text-xs font-medium transition-colors relative ${activeTab === tab.id
                            ? 'text-[var(--studio-primary)]'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--studio-primary)]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <>
                        {isTable && (
                            <div className="space-y-3 p-3 mb-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h5 className="text-xs font-semibold text-slate-700">Table Actions</h5>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-normal">Enable Download Template</Label>
                                    <div className="flex items-center space-x-2">
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
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <Label className="text-xs font-normal">Enable Upload Excel</Label>
                                    <div className="flex items-center space-x-2">
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
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Adds buttons to download a template and upload Excel data to populate the table.
                                </p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label variant="section">Field ID</Label>
                            <Input
                                value={fieldItem?.key || selectedItem.id}
                                disabled={true}
                                onChange={(e) => onUpdate(selectedItem!.id, { key: e.target.value })}
                                placeholder="e.g. plant_code"
                                className="font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label variant="section">Label</Label>
                            <Input
                                value={selectedItem.label}
                                onChange={(e) => onUpdate(selectedItem!.id, { label: e.target.value })}
                            />
                        </div>

                        {isField && (
                            <div className="space-y-1.5">
                                <Label variant="section">Field State</Label>
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
                                        <SelectItem value="mandatory">Mandatory</SelectItem>
                                        <SelectItem value="optional">Optional</SelectItem>
                                        <SelectItem value="readonly">Read-Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {isField && (
                            <div className="space-y-1.5">
                                <Label variant="section">Width</Label>
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

                        {isField && (
                            <div className="space-y-1.5">
                                <Label variant="section">Data Type</Label>
                                <Select
                                    disabled={true}
                                    value={fieldItem?.dataType || getDefaultDataType(selectedItem.type)}
                                    onValueChange={(val) => onUpdate(selectedItem!.id, { dataType: val as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="date">Date</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {isField && (
                            <div className="space-y-1.5">
                                <Label variant="section">Default Value</Label>
                                <Input
                                    value={fieldItem?.defaultValue || ''}
                                    onChange={(e) => onUpdate(selectedItem!.id, { defaultValue: e.target.value })}
                                    placeholder="Default value..."
                                />
                            </div>
                        )}
                    </>
                )}

                {/* VALIDATION TAB */}
                {activeTab === 'validation' && isField && (
                    <>
                        <div className="space-y-1.5">
                            <Label variant="section">Validation Type</Label>
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

                        <div className="space-y-1.5">
                            <Label variant="section">Max Length</Label>
                            <Input
                                type="number"
                                value={fieldItem?.constraints?.maxLength || ''}
                                onChange={(e) => onUpdate(selectedItem!.id, {
                                    constraints: { ...(fieldItem?.constraints || {}), maxLength: e.target.value ? parseInt(e.target.value) : undefined }
                                })}
                                placeholder="No limit"
                            />
                        </div>
                    </>
                )}

                {/* DATA SOURCE TAB */}
                {activeTab === 'data' && isField && isSelectType && (
                    <>
                        <div className="space-y-1.5">
                            <Label variant="section">Source Type</Label>
                            <Select
                                value={fieldItem?.valueHelp?.type || 'Static'}
                                onValueChange={(val) => onUpdate(selectedItem!.id, {
                                    valueHelp: { ...(fieldItem?.valueHelp || {}), type: val as 'Static' | 'Reference' | 'Dynamic' }
                                })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Static">Static List</SelectItem>
                                    <SelectItem value="Reference">Managed List</SelectItem>
                                    <SelectItem value="Dynamic">Dynamic Entity</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}

                {/* MORE TAB */}
                {activeTab === 'advanced' && isField && (
                    <>
                        <div className="space-y-1.5">
                            <Label variant="section">Placeholder</Label>
                            <Input
                                value={fieldItem?.placeholder || ''}
                                onChange={(e) => onUpdate(selectedItem!.id, { placeholder: e.target.value })}
                                placeholder="Enter placeholder text..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label variant="section">Help Text</Label>
                            <Textarea
                                value={fieldItem?.helpText || ''}
                                onChange={(e) => onUpdate(selectedItem!.id, { helpText: e.target.value })}
                                placeholder="Optional description to help users..."
                                rows={3}
                                className="resize-none"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                <Button
                    onClick={() => onDuplicate?.(selectedItem!.id)}
                    variant="outline"
                    className="w-full text-slate-600 font-medium"
                >
                    <Copy size={16} />
                    Duplicate Field
                </Button>
                <Button
                    onClick={() => onDelete?.(selectedItem!.id)}
                    variant="outline-destructive"
                    className="w-full font-medium"
                >
                    <Trash2 size={16} />
                    Delete Field
                </Button>
            </div>
        </div>
    );
}
