import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ResolvedApproversMap } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PrincipalToResolve {
    id: string;
    type: string; // 'USER' | 'GROUP' | 'TEAM' | 'ROLE' | etc.
}

/**
 * Batch-fetches display names for unresolved UUIDs produced by the
 * client-side approver resolver.
 *
 * Returns an augmented `Map<string, string>` that merges the fetched
 * names into the caller-supplied `knownUsers` map.
 */
export function usePrincipalNames(
    resolvedApprovers: ResolvedApproversMap,
    knownUsers: Map<string, string>
): Map<string, string> {
    // 1. Collect UUIDs that need resolution
    const unknownPrincipals: PrincipalToResolve[] = useMemo(() => {
        const seen = new Set<string>();
        const result: PrincipalToResolve[] = [];

        for (const approvers of Object.values(resolvedApprovers)) {
            for (const a of approvers) {
                const id = a.approverValue;
                if (!id || seen.has(id)) continue;
                seen.add(id);

                // Skip if we already have a good name
                if (knownUsers.has(id)) continue;

                // Skip if the display name is already resolved (non-UUID)
                if (a.approverDisplayName && a.approverDisplayName !== id && !UUID_RE.test(a.approverDisplayName)) {
                    continue;
                }

                // Only fetch actual UUIDs (avoid fetching role-code strings)
                if (!UUID_RE.test(id)) continue;

                result.push({
                    id,
                    type: (a.approverType || 'USER').toUpperCase()
                });
            }
        }
        return result;
    }, [resolvedApprovers, knownUsers]);

    // 2. Separate into user IDs and group IDs
    const userIds = useMemo(
        () => unknownPrincipals.filter(p => p.type === 'USER').map(p => p.id),
        [unknownPrincipals]
    );
    const groupIds = useMemo(
        () => unknownPrincipals.filter(p => p.type !== 'USER').map(p => p.id),
        [unknownPrincipals]
    );

    // 3. Stable query keys (sorted to avoid re-fetches on order changes)
    const userKey = useMemo(() => [...userIds].sort().join(','), [userIds]);
    const groupKey = useMemo(() => [...groupIds].sort().join(','), [groupIds]);

    // 4. Fetch users
    const { data: fetchedUsers } = useQuery({
        queryKey: ['principalNames', 'users', userKey],
        queryFn: async () => {
            if (userIds.length === 0) return {};
            const filter = userIds.map(id => `ID eq ${id}`).join(' or ');
            const res = await fetch(`/browse/ShadowUsers?$filter=${encodeURIComponent(filter)}&$select=ID,displayName,email`);
            const json = await res.json();
            const map: Record<string, string> = {};
            for (const u of json.value || []) {
                map[u.ID] = u.displayName || u.email || u.ID;
            }
            return map;
        },
        enabled: userIds.length > 0,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // 5. Fetch groups
    const { data: fetchedGroups } = useQuery({
        queryKey: ['principalNames', 'groups', groupKey],
        queryFn: async () => {
            if (groupIds.length === 0) return {};
            const filter = groupIds.map(id => `ID eq ${id}`).join(' or ');
            const res = await fetch(`/browse/ShadowGroups?$filter=${encodeURIComponent(filter)}&$select=ID,name`);
            const json = await res.json();
            const map: Record<string, string> = {};
            for (const g of json.value || []) {
                map[g.ID] = g.name || g.ID;
            }
            return map;
        },
        enabled: groupIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });

    // 6. Merge everything into a single augmented map
    return useMemo(() => {
        const merged = new Map(knownUsers);

        if (fetchedUsers) {
            for (const [id, name] of Object.entries(fetchedUsers)) {
                merged.set(id, name);
            }
        }
        if (fetchedGroups) {
            for (const [id, name] of Object.entries(fetchedGroups)) {
                merged.set(id, name);
            }
        }

        return merged;
    }, [knownUsers, fetchedUsers, fetchedGroups]);
}
