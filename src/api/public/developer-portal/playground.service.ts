/**
 * API Playground Service
 * =======================
 *
 * Service for the interactive API playground.
 * Allows developers to test API requests in sandbox mode.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import {
  PlaygroundRequest,
  PlaygroundResponse,
  PlaygroundSession,
  PlaygroundHistoryItem,
} from './portal.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlaygroundConfig {
  sandboxBaseUrl: string;
  liveBaseUrl: string;
  maxHistoryItems: number;
  requestTimeout: number;
}

export const DEFAULT_PLAYGROUND_CONFIG: PlaygroundConfig = {
  sandboxBaseUrl: 'https://sandbox.api.campotech.com',
  liveBaseUrl: 'https://api.campotech.com',
  maxHistoryItems: 100,
  requestTimeout: 30000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYGROUND SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class PlaygroundService {
  private config: PlaygroundConfig;

  constructor(
    private pool: Pool,
    config?: Partial<PlaygroundConfig>
  ) {
    this.config = { ...DEFAULT_PLAYGROUND_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create or get a playground session
   */
  async getOrCreateSession(
    userId: string,
    environment: 'sandbox' | 'live' = 'sandbox'
  ): Promise<PlaygroundSession> {
    // Check for existing session
    const existingResult = await this.pool.query(
      `SELECT * FROM playground_sessions
       WHERE user_id = $1 AND environment = $2
       AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, environment]
    );

    if (existingResult.rows.length > 0) {
      const session = existingResult.rows[0];
      const historyResult = await this.pool.query(
        `SELECT * FROM playground_history
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [session.id, this.config.maxHistoryItems]
      );

      return {
        id: session.id,
        user_id: session.user_id,
        environment: session.environment,
        api_key: session.api_key,
        requests: historyResult.rows.map(this.mapHistoryRow),
        created_at: session.created_at,
      };
    }

    // Create new session
    const sessionId = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO playground_sessions (id, user_id, environment, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [sessionId, userId, environment]
    );

    return {
      id: sessionId,
      user_id: userId,
      environment,
      requests: [],
      created_at: new Date(),
    };
  }

  /**
   * Set API key for a session
   */
  async setSessionApiKey(sessionId: string, apiKey: string): Promise<void> {
    await this.pool.query(
      `UPDATE playground_sessions SET api_key = $1 WHERE id = $2`,
      [apiKey, sessionId]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REQUEST EXECUTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Execute an API request
   */
  async executeRequest(
    sessionId: string,
    request: PlaygroundRequest
  ): Promise<PlaygroundResponse> {
    // Get session to determine environment and API key
    const sessionResult = await this.pool.query(
      `SELECT * FROM playground_sessions WHERE id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];
    const baseUrl = session.environment === 'live'
      ? this.config.liveBaseUrl
      : this.config.sandboxBaseUrl;

    // Build URL
    let url = `${baseUrl}${request.path}`;
    if (Object.keys(request.queryParams).length > 0) {
      const params = new URLSearchParams(request.queryParams);
      url += `?${params.toString()}`;
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CampoTech-Playground/1.0',
      ...request.headers,
    };

    // Add API key if available
    if (session.api_key) {
      headers['X-API-Key'] = session.api_key;
    }

    // Execute request
    const startTime = Date.now();
    let response: PlaygroundResponse;

    try {
      const fetchResponse = await fetch(url, {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: AbortSignal.timeout(this.config.requestTimeout),
      });

      const duration = Date.now() - startTime;
      const responseHeaders: Record<string, string> = {};
      fetchResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let body: any;
      const contentType = fetchResponse.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await fetchResponse.json();
      } else {
        body = await fetchResponse.text();
      }

      response = {
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: responseHeaders,
        body,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      response = {
        status: 0,
        statusText: error.name === 'AbortError' ? 'Request Timeout' : 'Network Error',
        headers: {},
        body: { error: error.message },
        duration,
      };
    }

    // Save to history
    const historyId = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO playground_history (id, session_id, request, response, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [historyId, sessionId, JSON.stringify(request), JSON.stringify(response)]
    );

    // Trim history if needed
    await this.pool.query(
      `DELETE FROM playground_history
       WHERE session_id = $1
       AND id NOT IN (
         SELECT id FROM playground_history
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
      [sessionId, this.config.maxHistoryItems]
    );

    return response;
  }

  /**
   * Get request history for a session
   */
  async getHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<PlaygroundHistoryItem[]> {
    const result = await this.pool.query(
      `SELECT * FROM playground_history
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, limit]
    );

    return result.rows.map(this.mapHistoryRow);
  }

  /**
   * Clear request history
   */
  async clearHistory(sessionId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM playground_history WHERE session_id = $1`,
      [sessionId]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CODE GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate code snippets for a request
   */
  generateCodeSnippets(request: PlaygroundRequest, apiKey?: string): Record<string, string> {
    const snippets: Record<string, string> = {};

    // cURL
    snippets.curl = this.generateCurl(request, apiKey);

    // JavaScript (fetch)
    snippets.javascript = this.generateJavaScript(request, apiKey);

    // Python (requests)
    snippets.python = this.generatePython(request, apiKey);

    // Node.js (axios)
    snippets.nodejs = this.generateNodeJs(request, apiKey);

    return snippets;
  }

  private generateCurl(request: PlaygroundRequest, apiKey?: string): string {
    let url = request.path;
    if (Object.keys(request.queryParams).length > 0) {
      const params = new URLSearchParams(request.queryParams);
      url += `?${params.toString()}`;
    }

    const lines = [`curl -X ${request.method} "${this.config.sandboxBaseUrl}${url}"`];

    if (apiKey) {
      lines.push(`  -H "X-API-Key: ${apiKey}"`);
    }
    lines.push(`  -H "Content-Type: application/json"`);

    for (const [key, value] of Object.entries(request.headers)) {
      if (key.toLowerCase() !== 'content-type') {
        lines.push(`  -H "${key}: ${value}"`);
      }
    }

    if (request.body) {
      lines.push(`  -d '${JSON.stringify(request.body, null, 2)}'`);
    }

    return lines.join(' \\\n');
  }

  private generateJavaScript(request: PlaygroundRequest, apiKey?: string): string {
    let url = request.path;
    if (Object.keys(request.queryParams).length > 0) {
      const params = new URLSearchParams(request.queryParams);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...request.headers,
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const options: any = {
      method: request.method,
      headers,
    };

    if (request.body) {
      options.body = 'JSON.stringify(body)';
    }

    return `const response = await fetch('${this.config.sandboxBaseUrl}${url}', {
  method: '${request.method}',
  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')}${request.body ? `,
  body: JSON.stringify(${JSON.stringify(request.body, null, 2).replace(/\n/g, '\n  ')})` : ''}
});

const data = await response.json();
console.log(data);`;
  }

  private generatePython(request: PlaygroundRequest, apiKey?: string): string {
    let url = request.path;
    if (Object.keys(request.queryParams).length > 0) {
      const params = new URLSearchParams(request.queryParams);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...request.headers,
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const headersStr = JSON.stringify(headers, null, 4).replace(/"/g, "'");

    let code = `import requests

url = "${this.config.sandboxBaseUrl}${url}"
headers = ${headersStr}`;

    if (request.body) {
      const bodyStr = JSON.stringify(request.body, null, 4).replace(/"/g, "'");
      code += `
data = ${bodyStr}

response = requests.${request.method.toLowerCase()}(url, headers=headers, json=data)`;
    } else {
      code += `

response = requests.${request.method.toLowerCase()}(url, headers=headers)`;
    }

    code += `
print(response.json())`;

    return code;
  }

  private generateNodeJs(request: PlaygroundRequest, apiKey?: string): string {
    let url = request.path;
    if (Object.keys(request.queryParams).length > 0) {
      const params = new URLSearchParams(request.queryParams);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...request.headers,
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    return `const axios = require('axios');

const response = await axios({
  method: '${request.method.toLowerCase()}',
  url: '${this.config.sandboxBaseUrl}${url}',
  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')}${request.body ? `,
  data: ${JSON.stringify(request.body, null, 4).replace(/\n/g, '\n  ')}` : ''}
});

console.log(response.data);`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private mapHistoryRow(row: any): PlaygroundHistoryItem {
    return {
      id: row.id,
      request: row.request,
      response: row.response,
      timestamp: row.created_at,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createPlaygroundService(
  pool: Pool,
  config?: Partial<PlaygroundConfig>
): PlaygroundService {
  return new PlaygroundService(pool, config);
}
