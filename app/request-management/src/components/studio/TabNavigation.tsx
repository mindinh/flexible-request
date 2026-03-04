import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    closeable?: boolean;
}

interface TabNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    onTabClose?: (tabId: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange, onTabClose }: TabNavigationProps) {
    return (
        <div className="flex gap-1">
            {tabs.map((tab) => (
                <motion.button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`studio-tab ${activeTab === tab.id ? 'studio-tab--active' : ''} group relative`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {tab.icon && <span className="mr-2">{tab.icon}</span>}
                    {tab.label}
                    {tab.closeable && onTabClose && (
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
