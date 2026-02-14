import { motion } from 'framer-motion';

interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface TabNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
    return (
        <div className="flex gap-1">
            {tabs.map((tab) => (
                <motion.button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`studio-tab ${activeTab === tab.id ? 'studio-tab--active' : ''}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {tab.icon && <span className="mr-2">{tab.icon}</span>}
                    {tab.label}
                </motion.button>
            ))}
        </div>
    );
}
