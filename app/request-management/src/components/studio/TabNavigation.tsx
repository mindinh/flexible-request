import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    closeable?: boolean;
    indent?: boolean;
}

interface TabNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    onTabClose?: (tabId: string) => void;
    onTabRename?: (tabId: string, newLabel: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange, onTabClose, onTabRename }: TabNavigationProps) {
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingTabId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingTabId]);

    const commitRename = () => {
        if (editingTabId && editingLabel.trim() && onTabRename) {
            onTabRename(editingTabId, editingLabel.trim());
        }
        setEditingTabId(null);
    };

    return (
        <div className="flex gap-1">
            {tabs.map((tab) => (
                <motion.button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    onDoubleClick={() => {
                        if (onTabRename && tab.closeable) {
                            setEditingTabId(tab.id);
                            setEditingLabel(tab.label);
                        }
                    }}
                    className={`studio-tab ${activeTab === tab.id ? 'studio-tab--active' : ''} group relative ${tab.indent ? 'ml-4 before:content-[""] before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-[1px] before:bg-slate-300 pointer-events-auto' : ''}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {tab.icon && <span className="mr-2">{tab.icon}</span>}
                    {editingTabId === tab.id ? (
                        <input
                            ref={inputRef}
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') setEditingTabId(null);
                                e.stopPropagation();
                            }}
                            onBlur={commitRename}
                            onClick={(e) => e.stopPropagation()}
                            className="w-24 h-5 px-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                    ) : (
                        tab.label
                    )}
                    {tab.closeable && onTabClose && editingTabId !== tab.id && (
                        <span
                            onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                            className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700"
                        >
                            <X size={10} />
                        </span>
                    )}
                </motion.button>
            ))}
        </div>
    );
}
