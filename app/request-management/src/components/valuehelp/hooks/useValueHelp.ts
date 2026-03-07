/**
 * useValueHelp.ts
 * Custom hook to fetch value help entries + returnMapping from RequestService.
 *
 * Uses a shared module-level cache so that multiple component instances
 * requesting the same ValueHelp trigger only ONE OData call.
 * In-flight deduplication ensures concurrent mounts await the same Promise.
 */
import { useState, useEffect, useCallback } from 'react';
import type { ValueHelpEntry, ReturnMapping, UseValueHelpOptions, UseValueHelpReturn } from '../types';

interface CacheEntry {
    entries: ValueHelpEntry[];
    returnMapping: ReturnMapping[];
}

// ── Shared module-level cache ──────────────────────────────────────────
const sharedCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function buildCacheKey(objectType: string, valueHelpID: string, dependsOnValue: string): string {
    return `${objectType}|${valueHelpID}|${dependsOnValue || ''}`;
}

async function fetchValueHelp(
    objectType: string,
    valueHelpID: string,
    dependsOnValue: string,
    baseUrl: string,
): Promise<CacheEntry> {
    const params = new URLSearchParams();
    params.set('objectType', `'${objectType}'`);
    params.set('valueHelpID', `'${valueHelpID}'`);
    params.set('filter', `'${dependsOnValue || ''}'`);
    params.set('dependsOnValue', `'${dependsOnValue || ''}'`);

    const url = `${baseUrl}/getValueHelp(${params.toString().replace(/\&/g, ',')})`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const parsed = typeof json.value === 'string' ? JSON.parse(json.value) : json.value;

    const resultEntries: ValueHelpEntry[] = parsed.entries || [];
    const resultMapping: ReturnMapping[] = parsed.returnMapping || [];

    return { entries: resultEntries, returnMapping: resultMapping };
}

export function useValueHelp({
    objectType,
    valueHelpID,
    dependsOnValue = '',
    baseUrl = '/browse',
}: UseValueHelpOptions): UseValueHelpReturn {
    const [entries, setEntries] = useState<ValueHelpEntry[]>([]);
    const [returnMapping, setReturnMapping] = useState<ReturnMapping[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!objectType || !valueHelpID) return;

        const cacheKey = buildCacheKey(objectType, valueHelpID, dependsOnValue);

        const cached = sharedCache.get(cacheKey);
        if (cached) {
            setEntries(cached.entries);
            setReturnMapping(cached.returnMapping);
            setError(null);
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                let promise = inflight.get(cacheKey);
                if (!promise) {
                    promise = fetchValueHelp(objectType, valueHelpID, dependsOnValue, baseUrl);
                    inflight.set(cacheKey, promise);
                }

                const result = await promise;

                sharedCache.set(cacheKey, result);
                inflight.delete(cacheKey);

                if (!cancelled) {
                    setEntries(result.entries);
                    setReturnMapping(result.returnMapping);
                }
            } catch (err: any) {
                inflight.delete(cacheKey);
                if (!cancelled) {
                    console.error('[useValueHelp] Fetch failed:', err);
                    setError(err.message);
                    setEntries([]);
                    setReturnMapping([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => { cancelled = true; };
    }, [objectType, valueHelpID, dependsOnValue, baseUrl]);

    const handleSelection = useCallback((selectedKey: string): Record<string, any> => {
        const entry = entries.find(e => e.key === selectedKey);
        if (!entry || !returnMapping.length) return {};

        const updates: Record<string, any> = {};
        returnMapping.forEach(mapping => {
            if (entry[mapping.sourceColumn] !== undefined) {
                updates[mapping.targetField] = entry[mapping.sourceColumn];
            }
        });
        return updates;
    }, [entries, returnMapping]);

    return { entries, returnMapping, loading, error, handleSelection };
}
