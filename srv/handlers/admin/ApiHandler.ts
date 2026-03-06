import cds from '@sap/cds';
import axios from 'axios';

/**
 * Handles external API call testing from the backend.
 */
export class ApiHandler {
    private srv: cds.ApplicationService;

    constructor(srv: cds.ApplicationService) {
        this.srv = srv;
    }

    register() {
        this.srv.on('testApiCall', this.handleTestApiCall.bind(this));
    }

    private async handleTestApiCall(req: cds.Request) {
        const { method, url, headers, body, authType, authUser, authPass, authToken } = req.data;
        console.log(`[ApiHandler] Testing API Call: ${method} ${url}`);

        try {
            let parsedHeaders = {};
            try {
                if (headers && headers !== '{}') {
                    parsedHeaders = JSON.parse(headers);
                }
            } catch (e) {
                console.warn('[ApiHandler] Failed to parse headers:', headers);
            }

            const config: any = {
                method: method || 'GET',
                url: url,
                headers: parsedHeaders,
                validateStatus: () => true, // Don't throw on non-2xx statuses
                timeout: 30000, // 30s timeout
            };

            // Add Auth headers
            if (authType === 'basic' && authUser && authPass) {
                const auth = Buffer.from(`${authUser}:${authPass}`).toString('base64');
                config.headers['Authorization'] = `Basic ${auth}`;
                console.log('[ApiHandler] Added Basic Auth');
            } else if (authType === 'bearer' && authToken) {
                config.headers['Authorization'] = `Bearer ${authToken}`;
                console.log('[ApiHandler] Added Bearer Auth');
            }

            // Add Body
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && body) {
                config.data = body;
                if (!config.headers['Content-Type']) {
                    config.headers['Content-Type'] = 'application/json';
                }
            }

            const response = await axios(config);
            console.log(`[ApiHandler] API Response: ${response.status}`);

            return JSON.stringify({
                status: response.status,
                body: response.data
            });

        } catch (error: any) {
            console.error('[ApiHandler] Proxy Error:', error.message);
            return JSON.stringify({
                status: error.response?.status || 500,
                body: error.response?.data || error.message || 'Unknown error occurred in backend proxy'
            });
        }
    }
}
