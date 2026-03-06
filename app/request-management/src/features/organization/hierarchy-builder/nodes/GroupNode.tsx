import { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Users, Building2, Briefcase, Shield, Plus, User } from 'lucide-react';
import { useHierarchyStore } from '../useHierarchyStore';

const GROUP_ICONS: Record<string, React.ElementType> = {
    GROUP: Users,
    TEAM: Users,
    DEPARTMENT: Building2,
    ROLE: Briefcase,
    DEFAULT: Shield,
};

/**
 * AddChildDialog — small inline dialog to choose child type (User or Group)
 */
function AddChildDialog({
    onAddGroup,
    onAddUser,
    onClose,
}: {
    onAddGroup: () => void;
    onAddUser: () => void;
    onClose: () => void;
}) {
    return (
        <div
            className="absolute left-1/2 -translate-x-1/2 z-10"
            style={{ top: 'calc(100% + 16px)' }}
        >
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-2 flex gap-1.5 min-w-[170px]">
                <button
                    onClick={(e) => { e.stopPropagation(); onAddGroup(); }}
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                >
                    <Users size={14} />
                    Group
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onAddUser(); }}
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                >
                    <User size={14} />
                    User
                </button>
            </div>
            {/* Overlay to close on outside click */}
            <div className="fixed inset-0 -z-10" onClick={(e) => { e.stopPropagation(); onClose(); }} />
        </div>
    );
}

/**
 * GroupNode — Displays a group / team / department in the hierarchy canvas.
 * Rectangular card with group icon, name, member count badge, and a '+' button to add children.
 */
export function GroupNode({ id, data, selected }: NodeProps) {
    const [showAddChild, setShowAddChild] = useState(false);
    const addChildNode = useHierarchyStore((s) => s.addChildNode);

    const label = (data.label as string) || 'Group';
    const memberCount = (data.memberCount as number) ?? (data.members as any[])?.length ?? 0;
    const groupTypeCode = (data.groupTypeCode as string) || 'GROUP';
    const accentColor = '#2563eb'; // blue
    const Icon = GROUP_ICONS[groupTypeCode] || GROUP_ICONS.DEFAULT;

    const handleAddGroup = useCallback(() => {
        const childId = crypto.randomUUID();
        addChildNode(id, {
            id: childId,
            type: 'groupNode',
            position: { x: 0, y: 150 }, // will be auto-laid out
            data: {
                entityType: 'GROUP',
                entityId: '',
                label: 'New Group',
                isNew: true,
                groupTypeCode: 'GROUP',
                members: [],
                memberCount: 0,
            },
        });
        setShowAddChild(false);
    }, [id, addChildNode]);

    const handleAddUser = useCallback(() => {
        const childId = crypto.randomUUID();
        addChildNode(id, {
            id: childId,
            type: 'userNode',
            position: { x: 0, y: 150 },
            data: {
                entityType: 'USER',
                entityId: '',
                label: 'New User',
                isNew: true,
            },
        });
        setShowAddChild(false);
    }, [id, addChildNode]);

    return (
        <div style={{ position: 'relative' }}>
            <div
                style={{
                    display: 'flex',
                    width: '220px',
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    border: `2px solid ${selected ? accentColor : '#e2e8f0'}`,
                    overflow: 'hidden',
                    boxShadow: selected
                        ? `0 0 0 3px ${accentColor}22, 0 4px 16px rgba(0,0,0,0.08)`
                        : '0 1px 6px rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                }}
            >
                {/* Accent bar */}
                <div style={{ width: '4px', backgroundColor: accentColor, flexShrink: 0 }} />

                {/* Content */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', flex: 1 }}>
                    <div
                        style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Icon size={16} color={accentColor} />
                    </div>

                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div
                            style={{
                                fontWeight: 600,
                                fontSize: '12px',
                                color: '#1e293b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <div
                                style={{
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    color: accentColor,
                                    backgroundColor: '#eff6ff',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                }}
                            >
                                {groupTypeCode}
                            </div>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Handles */}
                <Handle
                    type="target"
                    position={Position.Top}
                    style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#fff',
                        border: `2px solid ${accentColor}`,
                        top: '-4px',
                    }}
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: accentColor,
                        border: '2px solid #fff',
                        bottom: '-4px',
                    }}
                />
            </div>

            {/* Add Child Button — below the card */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '8px',
                }}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowAddChild(!showAddChild);
                    }}
                    style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '2px solid #e2e8f0',
                        backgroundColor: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        color: '#94a3b8',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = accentColor;
                        (e.currentTarget as HTMLButtonElement).style.color = accentColor;
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                        (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fff';
                    }}
                    title="Add child (Group or User)"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Add child dialog */}
            {showAddChild && (
                <AddChildDialog
                    onAddGroup={handleAddGroup}
                    onAddUser={handleAddUser}
                    onClose={() => setShowAddChild(false)}
                />
            )}
        </div>
    );
}
