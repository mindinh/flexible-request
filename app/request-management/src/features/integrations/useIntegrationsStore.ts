import { create } from 'zustand';
import { api } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────

export type AuthType = 'none' | 'basic' | 'bearer';

export interface ApiConnection {
    ID: string;
    name: string;
    baseUrl: string;
    authType: AuthType;
    /** Basic Auth username */
    username?: string;
    /** Basic Auth password */
    password?: string;
    /** Bearer token */
    token?: string;
    /** Optional description */
    description?: string;
    /** Timestamp of creation */
    createdAt?: string;
}

// ─── Store ───────────────────────────────────────────────────────────

interface IntegrationsState {
    connections: ApiConnection[];
    isLoading: boolean;
    error: string | null;

    fetchConnections: () => Promise<void>;
    addConnection: (conn: Omit<ApiConnection, 'ID' | 'createdAt'>) => Promise<void>;
    updateConnection: (id: string, updates: Partial<Omit<ApiConnection, 'ID' | 'createdAt'>>) => Promise<void>;
    deleteConnection: (id: string) => Promise<void>;
    getConnection: (id: string) => ApiConnection | undefined;
}

const ADMIN_BASE = '/admin/ApiConnections';
const BROWSE_BASE = '/browse/ApiConnections';

export const useIntegrationsStore = create<IntegrationsState>()(
    (set, get) => ({
        connections: [],
        isLoading: false,
        error: null,

        fetchConnections: async () => {
            // Avoid duplicate fetches if already loading
            if (get().isLoading) return;

            set({ isLoading: true, error: null });
            try {
                // Use browse endpoint (read-only, accessible to all users)
                const res = await api.get(BROWSE_BASE);

                const data = res.data?.value ?? res.data ?? [];
                set({ connections: data, isLoading: false });
            } catch (err: any) {
                set({ error: err.message || 'Failed to fetch connections', isLoading: false });
            }
        },

        addConnection: async (conn) => {
            set({ error: null });
            try {
                await api.post(ADMIN_BASE, conn);
                // Refresh list after creation
                await get().fetchConnections();
            } catch (err: any) {
                set({ error: err.message || 'Failed to add connection' });
                throw err;
            }
        },

        updateConnection: async (id, updates) => {
            set({ error: null });
            try {
                await api.patch(`${ADMIN_BASE}(${id})`, updates);
                await get().fetchConnections();
            } catch (err: any) {
                set({ error: err.message || 'Failed to update connection' });
                throw err;
            }
        },

        deleteConnection: async (id) => {
            set({ error: null });
            try {
                await api.delete(`${ADMIN_BASE}(${id})`);
                // Optimistic removal
                set((state) => ({
                    connections: state.connections.filter((c) => c.ID !== id),
                }));
            } catch (err: any) {
                set({ error: err.message || 'Failed to delete connection' });
                throw err;
            }
        },

        getConnection: (id) => {
            return get().connections.find((c) => c.ID === id);
        },
    })
);
