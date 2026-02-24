import { NavLink } from 'react-router-dom';
import {
    FileText,
    Inbox,
    Settings,
    Users,
    BookOpen,
    Plug,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { path: '/requests', label: 'My Requests', icon: <FileText style={{ width: '20px', height: '20px' }} /> },
    { path: '/inbox', label: 'Inbox', icon: <Inbox style={{ width: '20px', height: '20px' }} /> },
    { path: '/studio', label: 'Request Type Studio', icon: <Settings style={{ width: '20px', height: '20px' }} /> },
    { path: '/organization', label: 'Organization', icon: <Users style={{ width: '20px', height: '20px' }} /> },
    { path: '/integrations', label: 'Integrations', icon: <Plug style={{ width: '20px', height: '20px' }} /> },
    { path: '/wiki', label: 'Wiki', icon: <BookOpen style={{ width: '20px', height: '20px' }} /> },
];

interface SidebarProps {
    collapsed?: boolean;
    onToggle?: () => void;
}

export const Sidebar = ({ collapsed = false, onToggle }: SidebarProps) => {
    return (
        <aside
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: '#111827',
                color: 'white',
                transition: 'width 0.3s ease',
                width: collapsed ? '64px' : '256px',
            }}
        >
            {/* Logo */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                height: '64px',
                padding: '0 16px',
                borderBottom: '1px solid #1f2937'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: '#b10e10',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <span style={{ fontWeight: 'bold', color: 'white', fontSize: '14px' }}>R</span>
                    </div>
                    {!collapsed && (
                        <span style={{ fontWeight: 600, fontSize: '18px' }}>Request Mgmt</span>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '16px 8px' }}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            marginBottom: '4px',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease',
                            backgroundColor: isActive ? '#b10e10' : 'transparent',
                            color: isActive ? 'white' : '#d1d5db',
                        })}
                    >
                        {item.icon}
                        {!collapsed && <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Collapse Toggle */}
            <div style={{ padding: '8px', borderTop: '1px solid #1f2937' }}>
                <button
                    onClick={onToggle}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}
                >
                    {collapsed ? (
                        <ChevronRight style={{ width: '20px', height: '20px' }} />
                    ) : (
                        <>
                            <ChevronLeft style={{ width: '20px', height: '20px' }} />
                            <span style={{ fontSize: '14px' }}>Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};
