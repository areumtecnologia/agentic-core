const { TelemetryProvider } = require('./TelemetryProvider');
const OtelExporter = require('./OtelExporter');

/**
 * Ponte OpenTelemetry GenAI (OtelGenAIBridge - v4.3).
 * Mapeia o ciclo de vida do AgenticCore e seus spans internos para as
 * Convenções Semânticas Oficiais do consórcio OpenTelemetry para IA Generativa (GenAI SemConv).
 */
class OtelGenAIBridge extends TelemetryProvider {
    #serviceName;
    #exporter;
    #activeGenAiSpans = new Map(); // spanId -> OtelSpan

    /**
     * @param {Object} [options={}]
     * @param {string} [options.serviceName='agentic-core-agent'] - Nome do serviço no OpenTelemetry.
     * @param {OtelExporter|Object} [options.exporter] - Instância de OtelExporter ou opções de endpoint/headers.
     * @param {string} [options.endpoint] - Endpoint HTTP/OTLP opcional.
     * @param {Object} [options.headers] - Headers HTTP para o coletor.
     */
    constructor(options = {}) {
        super(options);
        this.#serviceName = options.serviceName || 'agentic-core-agent';

        if (options.exporter instanceof OtelExporter) {
            this.#exporter = options.exporter;
        } else {
            this.#exporter = new OtelExporter({
                endpoint: options.endpoint || options.exporter?.endpoint,
                headers: options.headers || options.exporter?.headers,
                maxBufferSize: options.maxBufferSize || options.exporter?.maxBufferSize
            });
        }

        // Intercepta spans finalizados pelo TelemetryProvider pai e os enriquece
        this.on('span:end', (span) => {
            this.#handleNativeSpanEnd(span);
        });
    }

    get serviceName() {
        return this.#serviceName;
    }

    get exporter() {
        return this.#exporter;
    }

    /**
     * Inicia um span retornando um objeto enriquecido com id e toString().
     * @param {string} name
     * @param {Record<string, any>} [attributes={}]
     * @param {string|null} [parentId=null]
     * @returns {Object}
     */
    startSpan(name, attributes = {}, parentId = null) {
        const id = super.startSpan(name, attributes, parentId);
        return {
            id,
            name,
            toString: () => id
        };
    }

    /**
     * Inicia explicitamente um span padronizado GenAI (ex: chat/inferência LLM).
     * @param {string} operationName - 'chat' | 'execute_tool' | 'verify' | 'graph_query'
     * @param {Object} [attributes={}] - Atributos semânticos.
     * @returns {Object} Span com id, name e toString().
     */
    startGenAiSpan(operationName, attributes = {}) {
        const id = this.startSpan(`gen_ai.${operationName}`, {
            'gen_ai.operation.name': operationName,
            ...this.#normalizeGenAiAttributes(attributes)
        });
        return {
            id,
            name: `gen_ai.${operationName}`,
            toString: () => id
        };
    }

    /**
     * Finaliza um span ativo aceitando tanto o id (string) quanto o objeto retornado por startSpan.
     * @param {string|Object} idOrSpan
     * @param {'OK'|'ERROR'} [status='OK']
     * @param {Record<string, any>} [additionalAttributes={}]
     * @param {Error|null} [error=null]
     * @returns {Object|null}
     */
    endSpan(idOrSpan, status = 'OK', additionalAttributes = {}, error = null) {
        const id = typeof idOrSpan === 'object' && idOrSpan !== null ? (idOrSpan.id || String(idOrSpan)) : idOrSpan;
        return super.endSpan(id, status, additionalAttributes, error);
    }

    /**
     * Mapeia e exporta spans finais com atributos semânticos para o OtelExporter.
     * @param {Object} nativeSpan
     */
    async #handleNativeSpanEnd(nativeSpan) {
        const attributes = { ...nativeSpan.attributes };
        const spanName = nativeSpan.name;

        // Mapeia atributos comuns para o padrão GenAI
        const genAiSpan = {
            serviceName: this.#serviceName,
            traceId: nativeSpan.traceId || nativeSpan.context?.traceId,
            spanId: nativeSpan.id,
            parentSpanId: nativeSpan.parentId,
            name: spanName,
            startTime: nativeSpan.startTime,
            endTime: nativeSpan.endTime || Date.now(),
            durationMs: nativeSpan.durationMs,
            status: nativeSpan.status || 'OK',
            statusMessage: nativeSpan.error?.message,
            attributes: this.#enrichAttributesForGenAi(spanName, attributes)
        };

        // Dispara o evento de span exportado
        this.emit('otel:span_exported', genAiSpan);

        // Exporta via OtelExporter
        try {
            await this.#exporter.export([genAiSpan]);
        } catch (err) {
            this.emit('error', err);
        }
    }

    #enrichAttributesForGenAi(spanName, attrs) {
        const enriched = { ...attrs };

        // Provedor / Sistema de IA
        if (enriched.provider) {
            enriched['gen_ai.system'] = this.#normalizeProviderSystem(enriched.provider);
        }
        if (enriched.model) {
            enriched['gen_ai.request.model'] = enriched.model;
        }

        // Tokens
        if (enriched.promptTokens !== undefined) {
            enriched['gen_ai.usage.input_tokens'] = enriched.promptTokens;
        }
        if (enriched.completionTokens !== undefined) {
            enriched['gen_ai.usage.output_tokens'] = enriched.completionTokens;
        }
        if (enriched.totalTokens !== undefined) {
            enriched['gen_ai.usage.total_tokens'] = enriched.totalTokens;
        }

        // Finish Reason
        if (enriched.finishReason) {
            enriched['gen_ai.response.finish_reasons'] = [enriched.finishReason];
        }

        // Tool calls
        if (spanName.includes('tool') || enriched.toolName) {
            enriched['gen_ai.operation.name'] = 'execute_tool';
            if (enriched.toolName) enriched['gen_ai.tool.name'] = enriched.toolName;
            if (enriched.args) enriched['gen_ai.tool.input'] = typeof enriched.args === 'object' ? JSON.stringify(enriched.args) : String(enriched.args);
            if (enriched.result !== undefined) enriched['gen_ai.tool.output'] = typeof enriched.result === 'object' ? JSON.stringify(enriched.result) : String(enriched.result);
        } else if (spanName.includes('verification')) {
            enriched['gen_ai.operation.name'] = 'verify';
        } else if (spanName.includes('graph')) {
            enriched['gen_ai.operation.name'] = 'graph_query';
        } else if (!enriched['gen_ai.operation.name']) {
            enriched['gen_ai.operation.name'] = 'chat';
        }

        return enriched;
    }

    #normalizeGenAiAttributes(attrs) {
        const norm = {};
        for (const [k, v] of Object.entries(attrs)) {
            if (k.startsWith('gen_ai.')) {
                norm[k] = v;
            } else if (k === 'provider') {
                norm['gen_ai.system'] = this.#normalizeProviderSystem(v);
            } else if (k === 'model') {
                norm['gen_ai.request.model'] = v;
            } else if (k === 'promptTokens') {
                norm['gen_ai.usage.input_tokens'] = v;
            } else if (k === 'completionTokens') {
                norm['gen_ai.usage.output_tokens'] = v;
            } else if (k === 'totalTokens') {
                norm['gen_ai.usage.total_tokens'] = v;
            } else {
                norm[k] = v;
            }
        }
        return norm;
    }

    #normalizeProviderSystem(providerName) {
        const p = String(providerName).toLowerCase();
        if (p.includes('gemini') || p.includes('google')) return 'gemini';
        if (p.includes('openai')) return 'openai';
        if (p.includes('anthropic') || p.includes('claude')) return 'anthropic';
        if (p.includes('ollama')) return 'ollama';
        if (p.includes('nvidia') || p.includes('nim')) return 'nvidia';
        return p;
    }
}

module.exports = OtelGenAIBridge;
