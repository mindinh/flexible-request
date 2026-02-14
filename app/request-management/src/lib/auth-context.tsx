import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Available test users for development with UUIDs matching db/data/ShadowUsers.csv
export const DEV_USERS = [
    {
        id: 'a1b2c3d4-0001-0001-0001-000000000001',
        username: 'alice',
        name: 'Alice Admin',
        password: 'alice',
        role: 'admin'
    },
    {
        id: 'a1b2c3d4-0002-0002-0002-000000000002',
        username: 'bob',
        name: 'Bob Finance',
        password: 'bob',
        role: 'approver'
    },
    {
        id: 'a1b2c3d4-0003-0003-0003-000000000003',
        username: 'carol',
        name: 'Carol Operations',
        password: 'carol',
        role: 'approver'
    },
    {
        id: 'a1b2c3d4-0004-0004-0004-000000000004',
        username: 'charlie',
        name: 'Charlie Requester',
        password: 'charlie',
        role: 'user'
    },
    {
        id: 'a1b2c3d4-0005-0005-0005-000000000005',
        username: 'dave',
        name: 'Dave IT Support',
        password: 'dave',
        role: 'approver'
    },
] as const;

export const DEV_GROUPS = [
    { id: 'b1b2c3d4-0001-0001-0001-000000000001', name: 'Finance Team' },
    { id: 'b1b2c3d4-0002-0002-0002-000000000002', name: 'IT Support' },
    { id: 'b1b2c3d4-0003-0003-0003-000000000003', name: 'Operations Team' }
] as const;

// Group memberships matching db/data/sap.cre-GroupMembers.csv
export const DEV_GROUP_MEMBERS = [
    // Alice -> Finance Team
    { userId: 'a1b2c3d4-0001-0001-0001-000000000001', groupId: 'b1b2c3d4-0001-0001-0001-000000000001' },
    // Bob -> Finance Team
    { userId: 'a1b2c3d4-0002-0002-0002-000000000002', groupId: 'b1b2c3d4-0001-0001-0001-000000000001' },
    // Dave -> IT Support
    { userId: 'a1b2c3d4-0005-0005-0005-000000000005', groupId: 'b1b2c3d4-0002-0002-0002-000000000002' },
    // Carol -> Operations Team
    { userId: 'a1b2c3d4-0003-0003-0003-000000000003', groupId: 'b1b2c3d4-0003-0003-0003-000000000003' },
] as const;

// Production group memberships - populated from /identity/me response
let productionGroupIds: string[] = [];

export function setProductionGroupIds(groupIds: string[]) {
    productionGroupIds = groupIds;
}

export function checkIsGroupMember(userId: string, groupId: string): boolean {
    // In production mode, check against the user's actual group memberships from /identity/me
    if (!import.meta.env.DEV && productionGroupIds.length > 0) {
        return productionGroupIds.includes(groupId);
    }
    // In dev mode, use hardcoded memberships
    return DEV_GROUP_MEMBERS.some(m => m.userId === userId && m.groupId === groupId);
}

/**
 * Check if a principal type is a group-like type (not a direct USER assignment)
 * Used to determine if claiming is required before taking action.
 * 
 * Logic: If the type is anything OTHER than 'USER', it's considered a group-like
 * assignment (GROUP, TEAM, ROLE, DEPARTMENT, POSITION, or any future type).
 * This is consistent with the SupportTypes entity which can be extended dynamically.
 */
export function isGroupLikeType(type: string | null | undefined): boolean {
    if (!type) return false;
    return type.toUpperCase() !== 'USER';
}

export type DevUser = typeof DEV_USERS[number];

interface AuthContextType {
    currentUser: DevUser;
    currentUserId: string;
    isAdmin: boolean;
    setCurrentUser: (user: DevUser) => void;
    getAuthHeader: () => string;
    isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'dev-current-user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const isDevMode = import.meta.env.DEV;
    const [isLoading, setIsLoading] = useState(!isDevMode);
    const [productionUser, setProductionUser] = useState<any>(null);

    // Initialize from localStorage or default to alice (dev mode only)
    const [currentUser, setCurrentUserState] = useState<DevUser>(() => {
        if (typeof window !== 'undefined' && isDevMode) {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                // Support both UUID and old username lookup for backward compatibility
                const found = DEV_USERS.find(u => u.id === stored || u.username === stored);
                if (found) return found;
            }
        }
        return DEV_USERS[0]; // alice
    });

    // Fetch user from /identity/me in production
    useEffect(() => {
        if (!isDevMode) {
            fetch('/identity/me', {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(res => res.json())
                .then(user => {
                    setProductionUser(user);
                    // Store group memberships for checkIsGroupMember() to use
                    if (user.groupIds && Array.isArray(user.groupIds)) {
                        setProductionGroupIds(user.groupIds);
                        console.log('[AuthContext] User group memberships:', user.groupIds);
                    }
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error('Failed to fetch user identity:', err);
                    setIsLoading(false);
                });
        }
    }, [isDevMode]);

    // Persist to localStorage
    const setCurrentUser = useCallback((user: DevUser) => {
        setCurrentUserState(user);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, user.id);
        }
        // Reload to apply new auth headers
        window.location.reload();
    }, []);

    // Generate Basic Auth header
    const getAuthHeader = useCallback(() => {
        if (!isDevMode) return '';
        // Use username for Basic Auth credential
        const credentials = `${currentUser.username}:${currentUser.password}`;
        return `Basic ${btoa(credentials)}`;
    }, [currentUser, isDevMode]);

    // Expose current user globally for non-React code (like axios instances)
    useEffect(() => {
        if (isDevMode) {
            (window as any).__DEV_AUTH__ = {
                user: currentUser,
                header: getAuthHeader()
            };
        }
    }, [currentUser, getAuthHeader, isDevMode]);

    // Get the effective user (dev or production)
    const effectiveUser = isDevMode ? currentUser : productionUser;

    // Don't render until we have user data in production
    if (!isDevMode && isLoading) {
        return null; // or a loading spinner
    }

    if (!isDevMode && !productionUser) {
        return <div>Failed to load user identity. Please try refreshing the page.</div>;
    }

    const isAdmin = isDevMode
        ? currentUser.role === 'admin'
        : (productionUser?.isAdmin || false);

    const currentUserId = isDevMode
        ? currentUser.id
        : (productionUser?.ID || productionUser?.userId);

    return (
        <AuthContext.Provider value={{
            currentUser: effectiveUser,
            currentUserId,
            isAdmin,
            setCurrentUser,
            getAuthHeader,
            isDevMode
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

// Helper for non-React code to get current auth
export function getDevAuthHeader(): string {
    if (!import.meta.env.DEV) return '';
    const devAuth = (window as any).__DEV_AUTH__;
    return devAuth?.header || `Basic ${btoa('alice:alice')}`;
}

export function getCurrentDevUser(): DevUser {
    if (!import.meta.env.DEV) {
        return DEV_USERS[0];
    }
    const devAuth = (window as any).__DEV_AUTH__;
    return devAuth?.user || DEV_USERS[0];
}
