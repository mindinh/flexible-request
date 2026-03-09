import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Search, User } from 'lucide-react';
import { Button } from '../components/ui';
import { Input } from '../components/ui/Input';
import { DevUserSwitcher } from '../components/dev/DevUserSwitcher';
import { NotificationPopover } from '../features/notifications/NotificationPopover';

export const AppShell = () => {
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Auto-collapse sidebar when navigating to the Inbox page
    useEffect(() => {
        if (location.pathname === '/inbox') {
            setSidebarCollapsed(true);
        }
    }, [location.pathname]);

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* Skip Link - visible only when focused */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
            >
                Skip to main content
            </a>

            {/* Sidebar - Navigation Landmark */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header - Banner Landmark */}
                <header
                    className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6"
                    role="banner"
                >
                    {/* Search */}
                    <div className="flex items-center gap-3 flex-1 max-w-md">
                        <div className="relative flex-1">
                            <label htmlFor="global-search" className="sr-only">
                                Search the application
                            </label>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                            <Input
                                id="global-search"
                                type="search"
                                placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-gray-200 rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3" role="group" aria-label="User actions">
                        {/* Dev User Switcher (only visible in development) */}
                        <DevUserSwitcher />

                        <NotificationPopover />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="flex items-center gap-2"
                            aria-label="Open user menu"
                            aria-haspopup="menu"
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center" aria-hidden="true">
                                <User className="w-4 h-4 text-gray-600" />
                            </div>
                        </Button>
                    </div>
                </header>

                {/* Page Content - Main Landmark */}
                <main
                    id="main-content"
                    className="flex-1 flex flex-col overflow-auto p-6"
                    role="main"
                    tabIndex={-1}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

