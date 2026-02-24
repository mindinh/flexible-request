import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Plug, TestTube2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/TextArea';
import { useIntegrationsStore, type ApiConnection, type AuthType } from './useIntegrationsStore';
import { useAuth } from '../../lib/auth-context';
import { AccessDenied } from '../../components/shared';
import axios from 'axios';

// ─── Connection Form ─────────────────────────────────────────────────

interface ConnectionFormProps {
    initial?: ApiConnection;
    onSave: (data: Omit<ApiConnection, 'ID' | 'createdAt'>) => void;
    onCancel: () => void;
}

function ConnectionForm({ initial, onSave, onCancel }: ConnectionFormProps) {
    const [name, setName] = useState(initial?.name || '');
    const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || '');
    const [authType, setAuthType] = useState<AuthType>(initial?.authType || 'none');
    const [username, setUsername] = useState(initial?.username || '');
    const [password, setPassword] = useState(initial?.password || '');
    const [token, setToken] = useState(initial?.token || '');
    const [description, setDescription] = useState(initial?.description || '');

    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const headers: Record<string, string> = {};
            if (authType === 'basic' && username && password) {
                headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
            } else if (authType === 'bearer' && token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const res = await axios.get(baseUrl, { headers, timeout: 10000 });
            setTestResult({ ok: true, message: `Success (${res.status} ${res.statusText})` });
        } catch (err: any) {
            const msg = err.response
                ? `Error ${err.response.status}: ${err.response.statusText}`
                : err.message || 'Connection failed';
            setTestResult({ ok: false, message: msg });
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, baseUrl, authType, username, password, token, description });
    };

    const isValid = name.trim() && baseUrl.trim();

    return (
        <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Connection Name *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Backend" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base URL *</Label>
                    <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="e.g. http://localhost:4004" />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</Label>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes about this connection..."
                    rows={2}
                    className="resize-none"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Authentication</Label>
                <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No Authentication</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {authType === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</Label>
                        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</Label>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                    </div>
                </div>
            )}

            {authType === 'bearer' && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Token</Label>
                    <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token..." />
                </div>
            )}

            {/* Test Result */}
            {testResult && (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${testResult.ok
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {testResult.ok ? <Check size={16} /> : <X size={16} />}
                    {testResult.message}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleTest}
                    disabled={!baseUrl.trim() || testing}
                    className="gap-2"
                >
                    {testing ? <Loader2 size={16} className="animate-spin" /> : <TestTube2 size={16} />}
                    {testing ? 'Testing...' : 'Test Connection'}
                </Button>
                <div className="flex-1" />
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" disabled={!isValid} className="bg-primary text-white hover:bg-primary/90 gap-2">
                    <Check size={16} />
                    {initial ? 'Update' : 'Save Connection'}
                </Button>
            </div>
        </form>
    );
}

// ─── Connection Card ─────────────────────────────────────────────────

function ConnectionCard({
    conn,
    onEdit,
    onDelete,
}: {
    conn: ApiConnection;
    onEdit: (c: ApiConnection) => void;
    onDelete: (id: string) => void;
}) {
    const authLabel: Record<AuthType, string> = {
        none: 'No Auth',
        basic: 'Basic Auth',
        bearer: 'Bearer Token',
    };

    return (
        <div className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                    <Plug size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 text-base">{conn.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded font-mono truncate max-w-[400px]">
                            {conn.baseUrl}
                        </code>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            {authLabel[conn.authType]}
                        </span>
                    </div>
                    {conn.description && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-1">{conn.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-primary"
                        onClick={() => onEdit(conn)}
                    >
                        <Pencil size={15} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() => onDelete(conn.ID)}
                    >
                        <Trash2 size={15} />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────

export function IntegrationsPage() {
    const { isAdmin } = useAuth();
    const { connections, isLoading, fetchConnections, addConnection, updateConnection, deleteConnection } = useIntegrationsStore();
    const [showForm, setShowForm] = useState(false);
    const [editingConn, setEditingConn] = useState<ApiConnection | null>(null);

    useEffect(() => {
        if (isAdmin) {
            fetchConnections();
        }
    }, [isAdmin, fetchConnections]);

    // Show Access Denied for non-admins
    if (!isAdmin) {
        return (
            <AccessDenied
                title="Admin Access Required"
                message="Only administrators can manage API integrations. Please contact your administrator if you need access."
            />
        );
    }

    const handleSave = async (data: Omit<ApiConnection, 'ID' | 'createdAt'>) => {
        if (editingConn) {
            await updateConnection(editingConn.ID, data);
        } else {
            await addConnection(data);
        }
        setShowForm(false);
        setEditingConn(null);
    };

    const handleEdit = (conn: ApiConnection) => {
        setEditingConn(conn);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this connection?')) {
            await deleteConnection(id);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingConn(null);
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                            <Plug size={22} className="text-white" />
                        </div>
                        API Integrations
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-[52px]">
                        Configure external API connections for dynamic dropdown data sources.
                    </p>
                </div>
                {!showForm && (
                    <Button
                        onClick={() => { setEditingConn(null); setShowForm(true); }}
                        className="bg-primary text-white hover:bg-primary/90 gap-2"
                    >
                        <Plus size={18} />
                        Add Connection
                    </Button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div className="mb-6">
                    <ConnectionForm
                        initial={editingConn || undefined}
                        onSave={handleSave}
                        onCancel={handleCancel}
                    />
                </div>
            )}

            {/* List */}
            {isLoading ? (
                <div className="text-center py-20">
                    <Loader2 size={32} className="mx-auto mb-4 animate-spin text-primary" />
                    <p className="text-sm text-slate-400">Loading connections...</p>
                </div>
            ) : connections.length === 0 && !showForm ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Plug size={48} className="mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-1">No Connections Yet</h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Add an API connection to use as a data source for dynamic dropdowns.
                    </p>
                    <Button
                        onClick={() => setShowForm(true)}
                        className="bg-primary text-white hover:bg-primary/90 gap-2"
                    >
                        <Plus size={18} />
                        Add Your First Connection
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {connections.map((conn) => (
                        <ConnectionCard
                            key={conn.ID}
                            conn={conn}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
