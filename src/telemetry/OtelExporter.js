const { EventEmitter } = require('events');
const http = require('http');
const https = require('https');

/**
 * Exportador OpenTelemetry OTLP padronizado (HTTP/JSON e In-Memory).
 * Transmite spans serializados de acordo com a especificação OTLP v1
 * para coletores corporativos (Datadog, Dynatrace, LangSmith, Phoenix, Grafana Tempo)
 * ou os retém em buffer de memória para testes e auditoria.
 */
class OtelExporter extends EventEmitter {
    #endpoint;
    #headers;
    #buffer = [];
    #maxBufferSize;
    #isInMemoryOnly;

    /**
     * @param {Object} [options={}]
     * @param {string} [options.endpoint] - Endpoint HTTP/OTLP (ex: 'http://localhost:4318/v1/traces'). Se omitido, opera in-memory.
     * @param {Object} [options.headers={}] - Headers HTTP adicionais (ex: Authorization, API-Key).
     * @param {number} [options.maxBufferSize=1000] - Capacidade máxima do buffer em memória.
     */
    constructor(options = {}) {
        super();
        this.#endpoint = options.endpoint || null;
        this.#headers = options.headers || {};
        this.#maxBufferSize = options.maxBufferSize || 1000;
        this.#isInMemoryOnly = !this.#endpoint;
    }

    get isInMemoryOnly() {
        return this.#isInMemoryOnly;
    }

    get endpoint() {
        return this.#endpoint;
    }

    /**
     * Exporta uma lista de spans no formato OTLP.
     * @param {Array<Object>} spans - Spans no formato semântico.
     * @returns {Promise<Object>} Resultado da exportação.
     */
    async export(spans) {
        if (!Array.isArray(spans) || spans.length === 0) {
            return { exported: 0 };
        }

        const otlpPayload = this.formatOtlpPayload(spans);

        // Armazena no buffer local
        for (const span of spans) {
            this.#buffer.push(Object.freeze({ ...span, exportedAt: Date.now() }));
            if (this.#buffer.length > this.#maxBufferSize) {
                this.#buffer.shift();
            }
        }

        this.emit('exported', { spansCount: spans.length, payload: otlpPayload });

        // Se configurado com endpoint HTTP remoto, despacha o payload via HTTP/HTTPS
        if (this.#endpoint) {
            await this.#sendHttp(otlpPayload);
        }

        return {
            exported: spans.length,
            endpoint: this.#endpoint || 'in-memory',
            payload: otlpPayload
        };
    }

    /**
     * Formata um array de spans no payload OTLP JSON canônico.
     * @param {Array<Object>} spans
     * @returns {Object} Payload no padrão OpenTelemetry v1 ResourceSpans.
     */
    formatOtlpPayload(spans) {
        const serviceName = spans[0]?.serviceName || 'agentic-core';

        return {
            resourceSpans: [
                {
                    resource: {
                        attributes: [
                            { key: 'service.name', value: { stringValue: serviceName } },
                            { key: 'telemetry.sdk.name', value: { stringValue: '@areumtecnologia/agentic-core' } },
                            { key: 'telemetry.sdk.language', value: { stringValue: 'nodejs' } }
                        ]
                    },
                    scopeSpans: [
                        {
                            scope: {
                                name: 'agentic-core.genai',
                                version: '4.3.0'
                            },
                            spans: spans.map((s) => this.#formatSingleSpan(s))
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Retorna os spans armazenados no buffer local.
     * @returns {Array<Object>}
     */
    getBufferedSpans() {
        return [...this.#buffer];
    }

    /**
     * Limpa o buffer de spans em memória.
     */
    clearBuffer() {
        this.#buffer = [];
    }

    #formatSingleSpan(s) {
        const attributes = [];
        if (s.attributes) {
            for (const [k, v] of Object.entries(s.attributes)) {
                attributes.push(this.#formatAttributeValue(k, v));
            }
        }

        return {
            traceId: s.traceId || this.#generateHexId(32),
            spanId: s.spanId || this.#generateHexId(16),
            parentSpanId: s.parentSpanId || undefined,
            name: s.name,
            kind: s.kind || 1, // 1 = INTERNAL, 2 = SERVER, 3 = CLIENT
            startTimeUnixNano: String((s.startTime || Date.now()) * 1000000),
            endTimeUnixNano: String((s.endTime || Date.now()) * 1000000),
            attributes,
            status: {
                code: s.status === 'ERROR' ? 2 : 1, // 1 = OK, 2 = ERROR
                message: s.statusMessage || undefined
            }
        };
    }

    #formatAttributeValue(key, val) {
        if (typeof val === 'number') {
            return Number.isInteger(val)
                ? { key, value: { intValue: String(val) } }
                : { key, value: { doubleValue: val } };
        }
        if (typeof val === 'boolean') {
            return { key, value: { boolValue: val } };
        }
        if (Array.isArray(val)) {
            return {
                key,
                value: {
                    arrayValue: {
                        values: val.map((item) => ({ stringValue: String(item) }))
                    }
                }
            };
        }
        return { key, value: { stringValue: typeof val === 'object' ? JSON.stringify(val) : String(val) } };
    }

    #generateHexId(length) {
        let hex = '';
        while (hex.length < length) {
            hex += Math.random().toString(16).substring(2);
        }
        return hex.substring(0, length);
    }

    #sendHttp(payload) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const urlObj = new URL(this.#endpoint);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;

            const reqOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    ...this.#headers
                },
                timeout: 5000
            };

            const req = client.request(reqOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`OtelExporter HTTP ${res.statusCode}: ${body}`));
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('OtelExporter HTTP request timed out.'));
            });

            req.write(data);
            req.end();
        });
    }
}

module.exports = OtelExporter;

