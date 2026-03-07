/**
 * useSearchHelp.ts
 * Custom hook for F4 Search Help dialog — multi-criteria search.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { SearchConfig, ReturnMapping, UseSearchHelpOptions, UseSearchHelpReturn } from '../types';

const DEBOUNCE_MS = 300;

export function useSearchHelp({
    objectType,
    valueHelpID,
    baseUrl = '/browse',
}: UseSearchHelpOptions): UseSearchHelpReturn {
    const [config, setConfig] = useState<SearchConfig | null>(null);
    const [returnMapping, setReturnMapping] = useState<ReturnMapping[]>([]);
    const [results, setResults] = useState<Record<string, any>[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFilters = useRef<Record<string, string>>({});

    // Fetch searchConfig on mount
    useEffect(() => {
        if (!objectType || !valueHelpID) return;

        let cancelled = false;

        const fetchConfig = async () => {
            try {
                const url = `${baseUrl}/ValueHelpList?$filter=objectType eq '${objectType}' and valueHelpID eq '${valueHelpID}'&$select=searchConfig,returnMapping`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();

                if (!cancelled && json.value?.[0]) {
                    const entity = json.value[0];
                    const sc: SearchConfig | null = entity.searchConfig ? JSON.parse(entity.searchConfig) : null;
                    const rm: ReturnMapping[] = entity.returnMapping ? JSON.parse(entity.returnMapping) : [];
                    setConfig(sc);
                    setReturnMapping(rm);
                } else if (!cancelled) {
                    setError('No value help configuration found.');
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('[useSearchHelp] Config fetch failed:', err);
                    setError(err.message);
                }
            }
        };

        fetchConfig();
        return () => { cancelled = true; };
    }, [objectType, valueHelpID, baseUrl]);

    const executeSearch = useCallback(async (filters: Record<string, string>, skip: number = 0) => {
        if (!objectType || !valueHelpID) return;

        setLoading(true);
        setError(null);
        try {
            const columns = config?.resultColumns?.map(c => c.column) || [];

            const params = [
                `objectType='${objectType}'`,
                `valueHelpID='${valueHelpID}'`,
                `filters='${JSON.stringify(filters).replace(/'/g, "''")}'`,
                `columns='${JSON.stringify(columns).replace(/'/g, "''")}'`,
                `top=100`,
                `skip=${skip}`,
            ].join(',');

            const url = `${baseUrl}/getValueHelpSearch(${params})`;
            const res = await fetch(url);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json();
            const parsed = typeof json.value === 'string' ? JSON.parse(json.value) : json.value;

            setResults(parsed.data || []);
            setTotal(parsed.total || 0);
        } catch (err: any) {
            console.error('[useSearchHelp] Search failed:', err);
            setError(err.message);
            setResults([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [objectType, valueHelpID, baseUrl, config]);

    const search = useCallback((filters: Record<string, string>) => {
        lastFilters.current = filters;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            executeSearch(filters, 0);
        }, DEBOUNCE_MS);
    }, [executeSearch]);

    const paginate = useCallback((skip: number) => {
        executeSearch(lastFilters.current, skip);
    }, [executeSearch]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    return { config, results, total, loading, error, search, paginate, returnMapping };
}
