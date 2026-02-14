import axios from 'axios';
import { globalEvents, EVENT_TYPES } from './events';
import { getDevAuthHeader } from './auth-context';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/', // Relative URL to use proxy
    headers: {
        'Content-Type': 'application/json',
    }
});

// CSRF token storage
let csrfToken: string | null = null;

/**
 * Fetch CSRF token from server
 */
async function fetchCsrfToken(): Promise<string> {
    console.log('🔐 [CSRF] Fetching new token from server...');

    try {
        // Use GET request to fetch CSRF token (CAP doesn't support HEAD)
        const response = await axios.get('/browse/RequestTypes', {
            headers: { 'x-csrf-token': 'Fetch' },
            params: { '$top': 0 }  // Fetch 0 records to minimize payload
        });

        const token = response.headers['x-csrf-token'];

        if (token) {
            console.log('✅ [CSRF] Token fetched successfully:', token.substring(0, 20) + '...');
        } else {
            console.warn('⚠️ [CSRF] No token in response. Headers:', Object.keys(response.headers));
        }

        return token || '';
    } catch (error) {
        console.error('❌ [CSRF] Failed to fetch token:', error);
        throw error;
    }
}

// Add request interceptor for auth and CSRF token
api.interceptors.request.use(async (config) => {
    // Inject auth header in dev mode
    if (import.meta.env.DEV) {
        config.headers['Authorization'] = getDevAuthHeader();
    }

    // For write operations (POST, PUT, PATCH, DELETE), ensure CSRF token is present
    const isWriteOperation = ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '');

    if (isWriteOperation) {
        console.log(`🔒 Write operation: ${config.method?.toUpperCase()} ${config.url}`);

        // Fetch token if we don't have one yet
        if (!csrfToken) {
            console.log('📡 Fetching fresh CSRF token...');
            try {
                csrfToken = await fetchCsrfToken();
                console.log('✅ Got CSRF token:', csrfToken ? 'YES' : 'NO');
            } catch (error) {
                console.warn('⚠️ Failed to fetch CSRF token:', error);
            }
        } else {
            console.log('✅ Using cached CSRF token');
        }

        // Add CSRF token to request headers
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
            console.log('✅ Added CSRF token to request');
        } else {
            console.warn('⚠️ NO CSRF TOKEN! Request will likely fail with 403!');
        }
    }

    return config;
});

// Add interceptor for response errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const message = error.response?.data?.error?.message || error.message || 'An unknown error occurred';
        console.error('API Error:', message);

        // If we get a 403 error on a write operation, it might be due to expired CSRF token
        // Try to fetch a new token and retry the request once
        if (error.response?.status === 403 && error.config && !error.config._retry) {
            error.config._retry = true;
            console.log('🔄 Retrying with fresh CSRF token...');

            try {
                // Fetch fresh CSRF token
                csrfToken = await fetchCsrfToken();

                // Update the failed request with the new token
                error.config.headers['X-CSRF-Token'] = csrfToken;

                // Retry the request
                return api.request(error.config);
            } catch (retryError) {
                console.error('Failed to retry request with fresh CSRF token:', retryError);
            }
        }

        // Emit global event for Toast
        globalEvents.emit(EVENT_TYPES.API_ERROR, message);

        return Promise.reject(error);
    }
);
