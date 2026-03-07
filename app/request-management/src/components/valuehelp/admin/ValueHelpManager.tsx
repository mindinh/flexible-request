/**
 * ValueHelpManager — Admin CRUD component for managing ValueHelpList entries.
 *
 * Usage:
 *   import { ValueHelpManager } from '@/components/valuehelp';
 *   <ValueHelpManager objectType="INV" serviceUrl="/odata/v4/admin" />
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X, AlertCircle, Check, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────
interface ReturnMappingEntry {
    sourceColumn: string;
    targetField: string;
}

interface ValueHelpListEntry {
    ID?: string;
    valueHelpID: string;
    description?: string;
    objectType: string;
    sourceType: 'static' | 'reference' | 'external';
    referenceTable?: string;
    keyColumn?: string;
    textColumn?: string;
    filterColumn?: string;
    externalEndpoint?: string;
    staticEntries?: string;
    returnMapping?: string;
    searchConfig?: string;
    dependsOn?: string;
    displayFormat?: 'keyOnly' | 'textOnly' | 'keyAndText';
    sortBy?: string;
}

interface ValueHelpFormData extends Omit<ValueHelpListEntry, 'ID'> {
    externalEndpoint?: string;
}

/** HTTP client interface — consumers pass their `axios` (or custom) instance */
export interface HttpClient {
    get: (url: string) => Promise<{ data: any }>;
    post: (url: string, data: any) => Promise<{ data: any }>;
    put: (url: string, data: any) => Promise<{ data: any }>;
    delete: (url: string) => Promise<{ data: any }>;
}

export interface ValueHelpManagerProps {
    /** Document object type (e.g. 'INV') */
    objectType: string;
    /** OData admin service base URL (default: /odata/v4/admin) */
    serviceUrl?: string;
    /** HTTP client instance (e.g. axios). Falls back to window.fetch if not provided. */
    httpClient?: HttpClient;
}

// ─── Minimal fetch wrapper ────────────────────────────────────────────
const defaultHttpClient: HttpClient = {
    get: async (url: string) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`GET ${r.status}`);
        return { data: await r.json() };
    },
    post: async (url: string, data: any) => {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw Object.assign(new Error(`POST ${r.status}`), { response: { data: e } }); }
        return { data: await r.json() };
    },
    put: async (url: string, data: any) => {
        const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw Object.assign(new Error(`PUT ${r.status}`), { response: { data: e } }); }
        return { data: await r.json() };
    },
    delete: async (url: string) => {
        const r = await fetch(url, { method: 'DELETE' });
        if (!r.ok) throw new Error(`DELETE ${r.status}`);
        return { data: null };
    },
};

// ─── Return Mapping Row ────────────────────────────────────────────────
const MappingRow: React.FC<{
    mapping: ReturnMappingEntry;
    index: number;
    onUpdate: (idx: number, field: string, value: string) => void;
    onRemove: (idx: number) => void;
}> = ({ mapping, index, onUpdate, onRemove }) => (
    <div className="flex items-center gap-2">
        <Input
            value={mapping.sourceColumn || ''}
            onChange={(e) => onUpdate(index, 'sourceColumn', e.target.value)}
            placeholder="Source column"
            className="flex-1 h-7 text-xs"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <Input
            value={mapping.targetField || ''}
            onChange={(e) => onUpdate(index, 'targetField', e.target.value)}
            placeholder="Target field"
            className="flex-1 h-7 text-xs"
        />
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(index)}
        >
            <X className="size-3.5" />
        </Button>
    </div>
);

// ─── Value Help Edit Form ──────────────────────────────────────────────
const ValueHelpForm: React.FC<{
    entry: Partial<ValueHelpListEntry> | 'new';
    objectType: string;
    onSave: (data: ValueHelpFormData) => void;
    onCancel: () => void;
    saving: boolean;
}> = ({ entry, objectType, onSave, onCancel, saving }) => {
    const initial: ValueHelpFormData = {
        valueHelpID: '',
        description: '',
        objectType: objectType || '',
        sourceType: 'static',
        referenceTable: '',
        keyColumn: '',
        textColumn: '',
        filterColumn: '',
        externalEndpoint: '',
        staticEntries: '[]',
        returnMapping: '[]',
        searchConfig: '{}',
        dependsOn: '',
        displayFormat: 'keyAndText',
        sortBy: 'key',
        ...(entry !== 'new' ? entry : {}),
    };
    const [form, setForm] = useState<ValueHelpFormData>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

    // Return mapping as array
    const mappings: ReturnMappingEntry[] = (() => {
        try { return JSON.parse(form.returnMapping || '[]'); }
        catch { return []; }
    })();

    const updateMapping = (idx: number, field: string, value: string) => {
        const arr = [...mappings];
        arr[idx] = { ...arr[idx], [field]: value };
        update('returnMapping', JSON.stringify(arr));
    };

    const addMapping = () => {
        const arr = [...mappings, { sourceColumn: '', targetField: '' }];
        update('returnMapping', JSON.stringify(arr));
    };

    const removeMapping = (idx: number) => {
        const arr = mappings.filter((_: any, i: number) => i !== idx);
        update('returnMapping', JSON.stringify(arr));
    };

    // Validate before save
    const handleSave = () => {
        const errs: Record<string, string> = {};
        if (!form.valueHelpID?.trim()) errs.valueHelpID = 'Required';
        if (!form.objectType?.trim()) errs.objectType = 'Required';

        if (form.sourceType === 'static') {
            try { JSON.parse(form.staticEntries || '[]'); }
            catch { errs.staticEntries = 'Invalid JSON'; }
        }
        if (form.sourceType === 'reference') {
            if (!form.referenceTable?.trim()) errs.referenceTable = 'Required for reference type';
            if (!form.keyColumn?.trim()) errs.keyColumn = 'Required for reference type';
        }

        try { JSON.parse(form.returnMapping || '[]'); }
        catch { errs.returnMapping = 'Invalid JSON'; }

        try { JSON.parse(form.searchConfig || '{}'); }
        catch { errs.searchConfig = 'Invalid JSON'; }

        setErrors(errs);
        if (Object.keys(errs).length > 0) return;

        onSave(form);
    };

    const isExistingEntry = entry !== 'new' && entry?.ID;

    return (
        <div className="space-y-5 p-1">
            {/* ID & Description */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Value Help ID *</label>
                    <Input
                        value={form.valueHelpID || ''}
                        onChange={(e) => update('valueHelpID', e.target.value)}
                        placeholder="e.g. companyCodes"
                        disabled={!!isExistingEntry}
                    />
                    {errors.valueHelpID && <p className="text-xs text-destructive mt-0.5">{errors.valueHelpID}</p>}
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                    <Input
                        value={form.description || ''}
                        onChange={(e) => update('description', e.target.value)}
                        placeholder="Short description..."
                    />
                </div>
            </div>

            {/* Source Type */}
            <div>
                <label className="text-xs text-muted-foreground mb-1 block">Source Type</label>
                <div className="flex bg-muted p-1 rounded-lg w-fit">
                    {(['static', 'reference', 'external'] as const).map(type => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => update('sourceType', type)}
                            className={cn(
                                'px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize',
                                form.sourceType === type
                                    ? 'bg-card text-primary shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conditional fields by source type */}
            {form.sourceType === 'static' && (
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Static Entries (JSON)</label>
                    <textarea
                        value={form.staticEntries || ''}
                        onChange={(e) => update('staticEntries', e.target.value)}
                        placeholder='[{"key": "1000", "text": "Company DE"}]'
                        rows={5}
                        className={cn(
                            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                            "font-mono text-xs",
                            errors.staticEntries && "border-destructive"
                        )}
                    />
                    {errors.staticEntries && <p className="text-xs text-destructive mt-0.5">{errors.staticEntries}</p>}
                </div>
            )}

            {form.sourceType === 'reference' && (
                <div className="grid grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Reference Table *</label>
                        <Input
                            value={form.referenceTable || ''}
                            onChange={(e) => update('referenceTable', e.target.value)}
                            placeholder="e.g. Suppliers"
                        />
                        {errors.referenceTable && <p className="text-xs text-destructive mt-0.5">{errors.referenceTable}</p>}
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Key Column *</label>
                        <Input
                            value={form.keyColumn || ''}
                            onChange={(e) => update('keyColumn', e.target.value)}
                            placeholder="e.g. supplier"
                        />
                        {errors.keyColumn && <p className="text-xs text-destructive mt-0.5">{errors.keyColumn}</p>}
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Text Column</label>
                        <Input
                            value={form.textColumn || ''}
                            onChange={(e) => update('textColumn', e.target.value)}
                            placeholder="e.g. supplierName"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Filter Column</label>
                        <Input
                            value={form.filterColumn || ''}
                            onChange={(e) => update('filterColumn', e.target.value)}
                            placeholder="e.g. objectType"
                        />
                    </div>
                </div>
            )}

            {form.sourceType === 'external' && (
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">External Endpoint / Destination</label>
                    <Input
                        value={form.externalEndpoint || ''}
                        onChange={(e) => update('externalEndpoint', e.target.value)}
                        placeholder="e.g. https://s4hana.example.com/sap/opu/odata/..."
                    />
                </div>
            )}

            {/* Return Mapping */}
            <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Return Mapping</label>
                <div className="space-y-2 bg-muted p-3 rounded-lg border border-border">
                    {mappings.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No mappings defined. Selected value will only set the bound field.</p>
                    )}
                    {mappings.map((m, i) => (
                        <MappingRow key={i} mapping={m} index={i} onUpdate={updateMapping} onRemove={removeMapping} />
                    ))}
                    <button
                        type="button"
                        onClick={addMapping}
                        className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 font-medium mt-1"
                    >
                        <Plus className="size-3.5" /> Add Mapping
                    </button>
                </div>
                {errors.returnMapping && <p className="text-xs text-destructive mt-0.5">{errors.returnMapping}</p>}
            </div>

            {/* Search Config */}
            <div>
                <label className="text-xs text-muted-foreground mb-1 block">Search Config (JSON)</label>
                <textarea
                    value={form.searchConfig || ''}
                    onChange={(e) => update('searchConfig', e.target.value)}
                    placeholder='{"title": "Search Suppliers", "searchFields": [...], "resultColumns": [...], "returnField": "supplier"}'
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-xs"
                />
                {errors.searchConfig && <p className="text-xs text-destructive mt-0.5">{errors.searchConfig}</p>}
            </div>

            {/* Display Options Row */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Depends On</label>
                    <Input
                        value={form.dependsOn || ''}
                        onChange={(e) => update('dependsOn', e.target.value)}
                        placeholder="Parent field name"
                    />
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Display Format</label>
                    <Select value={form.displayFormat} onValueChange={(v) => update('displayFormat', v)}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="keyAndText">Key & Text</SelectItem>
                            <SelectItem value="keyOnly">Key Only</SelectItem>
                            <SelectItem value="textOnly">Text Only</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Sort By</label>
                    <Select value={form.sortBy} onValueChange={(v) => update('sortBy', v)}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="key">Key</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Action Buttons */}
            <hr className="border-border" />
            <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? 'Saving...' : (isExistingEntry ? 'Update' : 'Create')}
                </Button>
            </div>
        </div>
    );
};

// ─── Value Help List Card ──────────────────────────────────────────────
const ValueHelpCard: React.FC<{
    entry: ValueHelpListEntry;
    onEdit: (entry: ValueHelpListEntry) => void;
    onDelete: (entry: ValueHelpListEntry) => void;
    isActive?: boolean;
}> = ({ entry, onEdit, onDelete, isActive }) => {
    const sourceBadgeVariant: Record<string, string> = {
        static: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30',
        reference: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info)]/30',
        external: 'bg-[var(--status-sent-bg,#f3e8ff)] text-[var(--status-sent-text,#7800a4)] border-[var(--status-sent-text,#7800a4)]/30',
    };

    let mappingCount = 0;
    try { mappingCount = JSON.parse(entry.returnMapping || '[]').length; } catch { /* ignore */ }

    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-4 hover:shadow-md transition-shadow group cursor-pointer",
                isActive
                    ? 'border-primary/50 shadow-md ring-1 ring-primary/20'
                    : 'border-border'
            )}
            onClick={() => onEdit(entry)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-foreground text-sm truncate">{entry.valueHelpID}</p>
                        <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                            sourceBadgeVariant[entry.sourceType] || 'bg-muted text-muted-foreground'
                        )}>
                            {entry.sourceType}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.description || 'No description'}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/70">
                        {entry.displayFormat && <span>Display: {entry.displayFormat}</span>}
                        {entry.dependsOn && <span>Depends: {entry.dependsOn}</span>}
                        {mappingCount > 0 && <span>{mappingCount} mapping{mappingCount > 1 ? 's' : ''}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-primary"
                        onClick={() => onEdit(entry)}
                    >
                        <Pencil className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                    >
                        <Trash2 className="size-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Value Help Manager ───────────────────────────────────────────
export default function ValueHelpManager({ objectType, serviceUrl = '/odata/v4/admin', httpClient }: ValueHelpManagerProps) {
    const api = httpClient || defaultHttpClient;
    const [entries, setEntries] = useState<ValueHelpListEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<ValueHelpListEntry | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchEntries = useCallback(async () => {
        if (!objectType) return;
        setLoading(true);
        try {
            const res = await api.get(`${serviceUrl}/ValueHelpList?$filter=objectType eq '${objectType}'&$orderby=valueHelpID`);
            setEntries(res.data?.value || []);
        } catch (err: any) {
            console.error('Failed to fetch value help entries', err);
            setFeedback({ type: 'error', message: 'Failed to load value help definitions' });
        } finally {
            setLoading(false);
        }
    }, [objectType, serviceUrl, api]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    // Auto-dismiss feedback
    useEffect(() => {
        if (feedback) {
            const t = setTimeout(() => setFeedback(null), 4000);
            return () => clearTimeout(t);
        }
    }, [feedback]);

    const handleSave = async (formData: ValueHelpFormData) => {
        setSaving(true);
        try {
            const payload: Record<string, any> = {
                valueHelpID: formData.valueHelpID,
                description: formData.description || '',
                objectType: formData.objectType || objectType,
                sourceType: formData.sourceType,
                referenceTable: formData.referenceTable || '',
                keyColumn: formData.keyColumn || '',
                textColumn: formData.textColumn || '',
                filterColumn: formData.filterColumn || '',
                staticEntries: formData.staticEntries || '[]',
                returnMapping: formData.returnMapping || '[]',
                searchConfig: formData.searchConfig || '{}',
                dependsOn: formData.dependsOn || '',
                displayFormat: formData.displayFormat || 'keyAndText',
                sortBy: formData.sortBy || 'key',
            };

            if (editing && editing !== 'new' && editing.ID) {
                await api.put(`${serviceUrl}/ValueHelpList(${editing.ID})`, payload);
                setFeedback({ type: 'success', message: `Updated "${payload.valueHelpID}"` });
            } else {
                await api.post(`${serviceUrl}/ValueHelpList`, payload);
                setFeedback({ type: 'success', message: `Created "${payload.valueHelpID}"` });
            }

            setEditing(null);
            fetchEntries();
        } catch (err: any) {
            console.error('Save failed', err);
            const msg = err.response?.data?.error?.message || err.message || 'Save failed';
            setFeedback({ type: 'error', message: msg });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (entry: ValueHelpListEntry) => {
        if (!confirm(`Delete value help "${entry.valueHelpID}"? This cannot be undone.`)) return;
        try {
            await api.delete(`${serviceUrl}/ValueHelpList(${entry.ID})`);
            setFeedback({ type: 'success', message: `Deleted "${entry.valueHelpID}"` });
            if (editing && editing !== 'new' && editing.ID === entry.ID) setEditing(null);
            fetchEntries();
        } catch (err: any) {
            setFeedback({ type: 'error', message: 'Delete failed: ' + (err.message || 'Unknown error') });
        }
    };

    if (!objectType) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <AlertCircle className="size-4 mr-2" /> Save the schema first to manage Value Help definitions.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Feedback Banner */}
            {feedback && (
                <div className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm border',
                    feedback.type === 'success'
                        ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30'
                        : 'bg-destructive/10 text-destructive border-destructive/30'
                )}>
                    {feedback.type === 'success' ? <Check className="size-4" /> : <AlertCircle className="size-4" />}
                    {feedback.message}
                </div>
            )}

            {/* Header with Add button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-foreground">Value Help Definitions</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {entries.length} definition{entries.length !== 1 ? 's' : ''} for <span className="font-medium text-foreground">{objectType}</span>
                    </p>
                </div>
                <Button type="button" size="sm" onClick={() => setEditing('new')}>
                    <Plus className="size-4" /> New Definition
                </Button>
            </div>

            {/* Two-column layout: List + Detail Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start', width: '100%' }}>
                {/* Left: Definition List */}
                <div className="space-y-2">
                    {loading ? (
                        <div className="text-center text-muted-foreground py-8 text-sm">Loading...</div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <p className="text-sm mb-1">No value help definitions yet</p>
                            <p className="text-xs">Click &quot;New Definition&quot; to create dropdown, search, or multi-select value helpers</p>
                        </div>
                    ) : (
                        entries.map(entry => (
                            <ValueHelpCard
                                key={entry.ID}
                                entry={entry}
                                onEdit={setEditing}
                                onDelete={handleDelete}
                                isActive={editing !== null && editing !== 'new' && editing.ID === entry.ID}
                            />
                        ))
                    )}
                </div>

                {/* Right: Detail / Edit Panel */}
                <div className="border rounded-xl bg-card shadow-sm sticky top-4 max-h-[80vh] overflow-y-auto"
                    style={{ borderColor: editing ? 'var(--primary, #dc2626)' : 'var(--border)' }}>
                    {editing ? (
                        <>
                            <div className="flex items-center justify-between px-4 py-3 border-b bg-card rounded-t-xl sticky top-0 z-10">
                                <h4 className="text-xs font-bold text-primary uppercase tracking-wide">
                                    {editing === 'new' ? '✨ New Value Help' : `✏️ Edit: ${editing.valueHelpID}`}
                                </h4>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={() => setEditing(null)}
                                >
                                    <X className="size-3.5" />
                                </Button>
                            </div>
                            <div className="p-4">
                                <ValueHelpForm
                                    key={editing === 'new' ? '__new__' : editing.ID || editing.valueHelpID}
                                    entry={editing === 'new' ? { objectType } : editing}
                                    objectType={objectType}
                                    onSave={handleSave}
                                    onCancel={() => setEditing(null)}
                                    saving={saving}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-muted-foreground">
                            <Pencil className="size-8 mb-3 opacity-30" />
                            <p className="text-sm font-medium">No definition selected</p>
                            <p className="text-xs mt-1">Click on a definition to view and edit its details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
