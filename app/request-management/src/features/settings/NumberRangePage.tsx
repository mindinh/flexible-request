import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Hash, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../lib/auth-context';
import { AccessDenied } from '../../components/shared';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestType {
    ID: string;
    title: string;
}

interface NumberRange {
    ID: string;
    requestType_ID: string;
    requestType?: { ID: string; title: string };
    startNumber: number;
    currentNumber: number;
    digits: number;
    isActive: boolean;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

const API_BASE = '/admin';

async function fetchRequestTypes(): Promise<RequestType[]> {
    const res = await api.get(`${API_BASE}/RequestTypes?$select=ID,title&$top=200`);
    return res.data.value ?? [];
}

async function fetchNumberRanges(): Promise<NumberRange[]> {
    const res = await api.get(`${API_BASE}/NumberRanges?$expand=requestType($select=ID,title)&$orderby=requestType/title`);
    return res.data.value ?? [];
}

async function createNumberRange(data: Omit<NumberRange, 'ID' | 'requestType'>): Promise<NumberRange> {
    const res = await api.post(`${API_BASE}/NumberRanges`, data);
    return res.data;
}

async function updateNumberRange(id: string, data: Partial<NumberRange>): Promise<void> {
    await api.patch(`${API_BASE}/NumberRanges(${id})`, data);
}

async function deleteNumberRange(id: string): Promise<void> {
    await api.delete(`${API_BASE}/NumberRanges(${id})`);
}

// ─── NumberRange Form Dialog ──────────────────────────────────────────────────

interface FormDialogProps {
    requestTypes: RequestType[];
    initial?: NumberRange | null;
    onSave: (data: Omit<NumberRange, 'ID' | 'requestType'>) => void;
    onCancel: () => void;
    isSaving?: boolean;
    existingRangeTypeIds: Set<string>;
}

function FormDialog({ requestTypes, initial, onSave, onCancel, isSaving, existingRangeTypeIds }: FormDialogProps) {
    const [requestTypeId, setRequestTypeId] = useState(initial?.requestType_ID ?? '');
    const [startNumber, setStartNumber] = useState(initial?.startNumber ?? 1000);
    const [currentNumber, setCurrentNumber] = useState(initial?.currentNumber ?? 1000);
    const [digits, setDigits] = useState(initial?.digits ?? 6);

    const isEdit = !!initial;
    const availableTypes = requestTypes.filter(rt =>
        isEdit ? true : !existingRangeTypeIds.has(rt.ID)
    );

    const previewId = String(currentNumber).padStart(digits, '0');

    const isValid = requestTypeId && startNumber > 0 && digits >= 1 && digits <= 12;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        onSave({
            requestType_ID: requestTypeId,
            startNumber,
            currentNumber: isEdit ? currentNumber : startNumber,
            digits,
            isActive: true,
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center">
                            <Hash size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">
                                {isEdit ? 'Edit Number Range' : 'Add Number Range'}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Configure automatic numbering for a request type</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Request Type */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Request Type <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={requestTypeId}
                                onChange={e => setRequestTypeId(e.target.value)}
                                disabled={isEdit}
                                className="w-full h-10 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 appearance-none"
                            >
                                <option value="">Select a request type...</option>
                                {availableTypes.map(rt => (
                                    <option key={rt.ID} value={rt.ID}>{rt.title}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                        </div>
                        {!isEdit && availableTypes.length === 0 && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertTriangle size={12} /> All request types already have a number range configured.
                            </p>
                        )}
                    </div>

                    {/* Digits (Padding) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Digits (Padding)
                        </label>
                        <Input
                            type="number"
                            value={digits}
                            onChange={e => setDigits(parseInt(e.target.value) || 6)}
                            min={1}
                            max={12}
                            className="font-mono"
                        />
                        <p className="text-[11px] text-slate-400">Total number length with zero padding</p>
                    </div>

                    {/* Start Number */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Start Number <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="number"
                                value={startNumber}
                                onChange={e => {
                                    const val = parseInt(e.target.value) || 1;
                                    setStartNumber(val);
                                    if (!isEdit) setCurrentNumber(val);
                                }}
                                min={1}
                                className="font-mono"
                            />
                        </div>
                        {isEdit && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Current Number
                                </label>
                                <Input
                                    type="number"
                                    value={currentNumber}
                                    onChange={e => setCurrentNumber(parseInt(e.target.value) || startNumber)}
                                    min={startNumber}
                                    className="font-mono"
                                />
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Preview</p>
                        <p className="text-xl font-bold font-mono text-red-600">{previewId}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!isValid || isSaving}
                            className="bg-red-600 hover:bg-red-700 text-white gap-2"
                        >
                            {isSaving ? <Loader2 size={15} className="animate-spin" /> : null}
                            {isEdit ? 'Save Changes' : 'Add Number Range'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function NumberRangePage() {
    const { isAdmin } = useAuth();
    const queryClient = useQueryClient();

    const [showDialog, setShowDialog] = useState(false);
    const [editing, setEditing] = useState<NumberRange | null>(null);
    const [filterTypeId, setFilterTypeId] = useState<string>('');

    // Queries
    const { data: ranges = [], isLoading } = useQuery({
        queryKey: ['numberRanges'],
        queryFn: fetchNumberRanges,
    });

    const { data: requestTypes = [] } = useQuery({
        queryKey: ['requestTypesForNR'],
        queryFn: fetchRequestTypes,
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: createNumberRange,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['numberRanges'] }); setShowDialog(false); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<NumberRange> }) => updateNumberRange(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['numberRanges'] }); setShowDialog(false); setEditing(null); },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteNumberRange,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['numberRanges'] }),
    });

    if (!isAdmin) {
        return (
            <AccessDenied
                title="Admin Access Required"
                message="Only administrators can configure number ranges."
            />
        );
    }

    const existingRangeTypeIds = new Set(ranges.map(r => r.requestType_ID));
    const filtered = filterTypeId ? ranges.filter(r => r.requestType_ID === filterTypeId) : ranges;

    const handleSave = (data: Omit<NumberRange, 'ID' | 'requestType'>) => {
        if (editing) {
            updateMutation.mutate({ id: editing.ID, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this number range? Existing requests will keep their current IDs.')) {
            deleteMutation.mutate(id);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Page Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Number Range Configuration</h1>
                        <p className="text-sm text-slate-500 mt-1">Configure automatic numbering sequences for different request types</p>
                    </div>
                    <Button
                        onClick={() => { setEditing(null); setShowDialog(true); }}
                        className="bg-red-600 hover:bg-red-700 text-white gap-2 font-semibold"
                    >
                        <Plus size={16} />
                        Add Number Range
                    </Button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 p-8 overflow-auto">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Table Toolbar */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600 font-medium">Filter by Request Type:</span>
                            <div className="relative">
                                <select
                                    value={filterTypeId}
                                    onChange={e => setFilterTypeId(e.target.value)}
                                    className="text-sm pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 appearance-none font-medium text-slate-700"
                                >
                                    <option value="">All Request Types</option>
                                    {requestTypes.map(rt => (
                                        <option key={rt.ID} value={rt.ID}>{rt.title}</option>
                                    ))}
                                </select>
                                <ChevronDown size={13} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <span className="text-sm text-slate-400">
                            Number of Request Type IDs: <span className="font-semibold text-slate-700">{filtered.length}</span>
                        </span>
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="py-20 text-center">
                            <Loader2 size={28} className="mx-auto mb-3 animate-spin text-red-500" />
                            <p className="text-sm text-slate-400">Loading number ranges...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-20 text-center">
                            <Hash size={40} className="mx-auto mb-3 text-slate-200" />
                            <h3 className="text-base font-semibold text-slate-500 mb-1">No Number Ranges Configured</h3>
                            <p className="text-sm text-slate-400 mb-5">Add a number range to generate readable IDs for requests.</p>
                            <Button
                                onClick={() => { setEditing(null); setShowDialog(true); }}
                                className="bg-red-600 hover:bg-red-700 text-white gap-2"
                            >
                                <Plus size={15} />
                                Add Number Range
                            </Button>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="w-10 px-6 py-3">
                                        <input type="checkbox" className="rounded border-slate-300" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Request Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Start Number
                                    </th>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Current Number
                                    </th>
                                    <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Digits
                                    </th>
                                    <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(range => (
                                    <tr key={range.ID} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <input type="checkbox" className="rounded border-slate-300" />
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-slate-800">
                                                {range.requestType?.title ?? range.requestType_ID}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {range.startNumber}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-red-600 text-base">
                                                {range.currentNumber}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-mono">
                                            {range.digits}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-3 text-xs font-semibold border-slate-200 hover:border-red-300 hover:text-red-600"
                                                    onClick={() => { setEditing(range); setShowDialog(true); }}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                    onClick={() => handleDelete(range.ID)}
                                                    disabled={deleteMutation.isPending}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={15} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Dialog */}
            {showDialog && (
                <FormDialog
                    requestTypes={requestTypes}
                    initial={editing}
                    onSave={handleSave}
                    onCancel={() => { setShowDialog(false); setEditing(null); }}
                    isSaving={isSaving}
                    existingRangeTypeIds={existingRangeTypeIds}
                />
            )}
        </div>
    );
}
