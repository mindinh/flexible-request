import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    FileText,
    Inbox,
    Settings,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    ListOrdered,
    Hash,
    Building2,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
}

/** Top-level sidebar items */
const navItems: NavItem[] = [
    { path: '/requests', label: 'My Request', icon: <FileText style={{ width: '20px', height: '20px' }} /> },
    { path: '/inbox', label: 'Inbox', icon: <Inbox style={{ width: '20px', height: '20px' }} /> },
];

/** Sub-items inside Request Configuration */
const configSubItems: NavItem[] = [
    { path: '/organization', label: 'Organization Structure', icon: <Building2 style={{ width: '18px', height: '18px' }} /> },
    { path: '/studio', label: 'Request Type List', icon: <ListOrdered style={{ width: '18px', height: '18px' }} /> },
    { path: '/settings', label: 'Request Number Range', icon: <Hash style={{ width: '18px', height: '18px' }} /> }
];

/** Paths that belong to the Request Configuration group */
const configPaths = configSubItems.map(i => i.path);

interface SidebarProps {
    collapsed?: boolean;
    onToggle?: () => void;
    onCollapse?: () => void;
}

export const Sidebar = ({ collapsed = false, onToggle, onCollapse }: SidebarProps) => {
    const { isAdmin } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [configOpen, setConfigOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    /** Is any config sub-route currently active? */
    const isConfigActive = configPaths.some(p => location.pathname.startsWith(p));

    /** Close the config panel when clicking outside */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setConfigOpen(false);
            }
        };
        if (configOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [configOpen]);

    /** Handle clicking a sub-item: navigate, close overlay, collapse main sidebar */
    const handleConfigNavClick = (path: string) => {
        navigate(path);
        setConfigOpen(false);
        onCollapse?.();
    };

    return (
        <div style={{ display: 'flex', flexShrink: 0, height: '100%' }} ref={panelRef}>
            {/* ─── Main Sidebar ─── */}
            <aside
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    backgroundColor: '#111827',
                    color: 'white',
                    transition: 'width 0.3s ease',
                    width: collapsed ? '64px' : '256px',
                    zIndex: 20,
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
                    {/* Standard nav items (My Request, Inbox) */}
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setConfigOpen(false)}
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

                    {/* Request Configuration (admin only) */}
                    {isAdmin && (
                        <button
                            onClick={() => {
                                const opening = !configOpen;
                                setConfigOpen(opening);
                                // Navigate to the default config sub-page when opening
                                if (opening) {
                                    navigate('/studio');
                                }
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                marginBottom: '4px',
                                textDecoration: 'none',
                                transition: 'all 0.15s ease',
                                backgroundColor: isConfigActive || configOpen ? '#b10e10' : 'transparent',
                                color: isConfigActive || configOpen ? 'white' : '#d1d5db',
                                border: 'none',
                                width: '100%',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '14px',
                                fontWeight: 500,
                                fontFamily: 'inherit',
                            }}
                        >
                            <Settings style={{ width: '20px', height: '20px' }} />
                            {!collapsed && <span>Request Configuration</span>}
                        </button>
                    )}

                    {/* Wiki */}
                    <NavLink
                        to="/wiki"
                        onClick={() => setConfigOpen(false)}
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
                        <BookOpen style={{ width: '20px', height: '20px' }} />
                        {!collapsed && <span style={{ fontSize: '14px', fontWeight: 500 }}>Wiki</span>}
                    </NavLink>
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

            {/* ─── Request Configuration Panel (inline) ─── */}
            {configOpen && (
                <div
                    style={{
                        width: '280px',
                        height: '100%',
                        backgroundColor: '#ffffff',
                        borderRight: '1px solid #e5e7eb',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0,
                    }}
                >
                    {/* Header */}
                    <div style={{
                        height: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 20px',
                        borderBottom: '1px solid #e5e7eb',
                    }}>
                        <span style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: '#6b7280',
                        }}>
                            Request Configuration
                        </span>
                    </div>

                    {/* Sub-items */}
                    <nav style={{ flex: 1, padding: '12px 8px' }}>
                        {configSubItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => handleConfigNavClick(item.path)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        marginBottom: '4px',
                                        border: 'none',
                                        width: '100%',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontFamily: 'inherit',
                                        transition: 'all 0.15s ease',
                                        backgroundColor: isActive ? '#f3f4f6' : 'transparent',
                                        color: isActive ? '#b10e10' : '#374151',
                                        fontWeight: isActive ? 600 : 400,
                                        fontSize: '14px',
                                    }}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Collapse toggle at the bottom */}
                    <div style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                        <button
                            onClick={() => setConfigOpen(false)}
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
                                fontSize: '14px',
                            }}
                        >
                            <ChevronLeft style={{ width: '20px', height: '20px' }} />
                            <span>Close</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
