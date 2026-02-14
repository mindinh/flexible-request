import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { SupportTypesTab } from './SupportTypesTab';
import { UsersTab } from './UsersTab';
import { GroupsTab } from './GroupsTab';
import { SamlMappingsTab } from './SamlMappingsTab';
import { useAuth } from '../../lib/auth-context';
import { AccessDenied } from '../../components/shared';
import '../../styles/studio.css';

/**
 * OrganizationPage - Main page for managing the Shadow Directory.
 * 
 * This page is part of the Studio module and allows administrators to:
 * - Configure principal types (enable/disable USER, GROUP, TEAM, etc.)
 * - View JIT-provisioned users
 * - Manage groups (Teams, Departments, Roles)
 */
export function OrganizationPage() {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState('types');

    // Show Access Denied for non-admins
    if (!isAdmin) {
        return (
            <AccessDenied
                title="Admin Access Required"
                message="Only administrators can access Organization Management. Please contact your administrator if you need access."
            />
        );
    }

    return (
        <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-slate-900">
                                    Organization Management
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Configure principal types and manage the Shadow Directory
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-6 bg-white border border-slate-200 p-1 rounded-xl">
                        <TabsTrigger
                            value="types"
                            className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-lg px-4 py-2"
                        >
                            Principal Types
                        </TabsTrigger>
                        <TabsTrigger
                            value="users"
                            className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-lg px-4 py-2"
                        >
                            Users
                        </TabsTrigger>
                        <TabsTrigger
                            value="groups"
                            className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-lg px-4 py-2"
                        >
                            Groups
                        </TabsTrigger>
                        <TabsTrigger
                            value="saml"
                            className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-lg px-4 py-2"
                        >
                            SAML Mappings
                        </TabsTrigger>
                    </TabsList>

                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <TabsContent value="types" className="mt-0">
                            <SupportTypesTab />
                        </TabsContent>

                        <TabsContent value="users" className="mt-0">
                            <UsersTab />
                        </TabsContent>

                        <TabsContent value="groups" className="mt-0">
                            <GroupsTab />
                        </TabsContent>

                        <TabsContent value="saml" className="mt-0">
                            <SamlMappingsTab />
                        </TabsContent>
                    </motion.div>
                </Tabs>
            </main>
        </div>
    );
}
