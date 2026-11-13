const MockBrowserDriver = require('./MockBrowserDriver');

// Padrões estritos de bloqueio anti-SSRF para navegação
const BLOCKED_HOST_PATTERNS = [
    /^localhost$/i,
    /^127(?:\.[0-9]+){3}$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^169\.254\.[0-9]+\.[0-9]+$/, // Link-local e AWS/GCP/Azure Metadata
    /^10(?:\.[0-9]+){3}$/,         // RFC 1918 privado (a menos que explicitamente permitido)
    /^172\.(?:1[6-9]|2[0-9]|3[0-1])(?:\.[0-9]+){2}$/,
    /^192\.168(?:\.[0-9]+){2}$/
];

const FORBIDDEN_PROTOCOLS = ['file:', 'javascript:', 'chrome:', 'data:', 'vbscript:', 'about:'];

/**
 * Ferramenta nativa de automação e navegação web (Browser Use) para o Agentic Core.
 */
class BrowserActionTool {
    #driver;
    #allowPrivateNetworks;
    #emitter;

    /**
     * @param {Object} [options={}]
     * @param {BaseBrowserDriver} [options.driver] - Driver do navegador (default: MockBrowserDriver).
     * @param {boolean} [options.allowPrivateNetworks=false] - Se true, permite acesso a redes privadas internas.
     * @param {EventEmitter} [options.emitter] - Emissor de eventos do AgenticCore.
     */
    constructor(options = {}) {
        this.#driver = options.driver || new MockBrowserDriver();
        this.#allowPrivateNetworks = options.allowPrivateNetworks === true;
        this.#emitter = options.emitter || null;
    }

    get driver() {
        return this.#driver;
    }

    /**
     * Retorna a definição da ferramenta no formato ToolDefinition do framework.
     * @returns {Object}
     */
    getDefinition() {
        return {
            name: 'browser_action',
            description: 'Executa ações no navegador web (navegar para URL, clicar, digitar, extrair texto ou capturar screenshot). Protegido com blindagem anti-SSRF.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    action: {
                        type: 'STRING',
                        description: 'Ação a ser executada: "navigate", "click", "type", "extract", "screenshot", "evaluate".'
                    },
                    url: {
                        type: 'STRING',
                        description: 'URL para navegação (obrigatória para a ação "navigate").'
                    },
                    selector: {
                        type: 'STRING',
                        description: 'Seletor CSS do elemento para clicar, digitar ou extrair texto.'
                    },
                    text: {
                        type: 'STRING',
                        description: 'Texto a ser digitado no elemento (obrigatório para a ação "type").'
                    },
                    script: {
                        type: 'STRING',
                        description: 'Script JavaScript a ser avaliado na página (para a ação "evaluate").'
                    }
                },
                required: ['action']
            }
        };
    }

    /**
     * Valida se a URL é segura para navegação pública.
     * @param {string} rawUrl
     * @throws {Error} se a URL for perigosa ou SSRF
     * @returns {URL}
     */
    validateUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') {
            throw new Error('URL inválida ou não informada.');
        }

        let parsed;
        try {
            parsed = new URL(rawUrl);
        } catch (e) {
            throw new Error(`Formato de URL inválido: "${rawUrl}"`);
        }

        const protocol = parsed.protocol.toLowerCase();
        if (FORBIDDEN_PROTOCOLS.includes(protocol)) {
            throw new Error(`Protocolo "${protocol}" é estritamente proibido por motivos de segurança.`);
        }

        if (protocol !== 'http:' && protocol !== 'https:') {
            throw new Error(`Protocolo "${protocol}" não suportado. Apenas http: e https: são permitidos.`);
        }

        const hostname = parsed.hostname.toLowerCase();

        // Se redes privadas não forem permitidas, valida contra SSRF
        if (!this.#allowPrivateNetworks) {
            for (const pattern of BLOCKED_HOST_PATTERNS) {
                if (pattern.test(hostname)) {
                    throw new Error(`Acesso ao host "${hostname}" bloqueado pela política anti-SSRF do navegador.`);
                }
            }
        }

        return parsed;
    }

    /**
     * Executa a ação solicitada no navegador.
     * @param {Object} args
     * @param {AbortSignal} [signal]
     * @returns {Promise<Object>}
     */
    async execute({ action, url, selector, text, script }, signal) {
        if (signal?.aborted) {
            throw new Error('Operação de navegação abortada.');
        }

        const actionType = String(action).toLowerCase().trim();

        switch (actionType) {
            case 'navigate': {
                const validated = this.validateUrl(url);
                this.#emitter?.emit('browser:navigate', { url: validated.href, timestamp: Date.now() });
                const navResult = await this.#driver.navigate(validated.href);
                return {
                    success: true,
                    action: 'navigate',
                    url: navResult.url,
                    title: navResult.title,
                    status: navResult.status
                };
            }

            case 'click': {
                if (!selector) throw new Error('A ação "click" requer o parâmetro "selector".');
                this.#emitter?.emit('browser:action', { action: 'click', selector });
                await this.#driver.click(selector);
                return {
                    success: true,
                    action: 'click',
                    selector,
                    currentUrl: this.#driver.getCurrentUrl()
                };
            }

            case 'type': {
                if (!selector) throw new Error('A ação "type" requer o parâmetro "selector".');
                if (text === undefined) throw new Error('A ação "type" requer o parâmetro "text".');
                this.#emitter?.emit('browser:action', { action: 'type', selector, textLength: text.length });
                await this.#driver.type(selector, text);
                return {
                    success: true,
                    action: 'type',
                    selector,
                    typed: text
                };
            }

            case 'extract': {
                const targetSelector = selector || 'body';
                this.#emitter?.emit('browser:action', { action: 'extract', selector: targetSelector });
                const extracted = await this.#driver.extractText(targetSelector);
                return {
                    success: true,
                    action: 'extract',
                    selector: targetSelector,
                    text: extracted,
                    currentUrl: this.#driver.getCurrentUrl()
                };
            }

            case 'screenshot': {
                const shot = await this.#driver.screenshot();
                this.#emitter?.emit('browser:screenshot', { url: shot.url, sizeBytes: shot.buffer.length });
                return {
                    success: true,
                    action: 'screenshot',
                    url: shot.url,
                    mimeType: shot.mimeType,
                    base64: shot.base64,
                    width: shot.width,
                    height: shot.height
                };
            }

            case 'evaluate': {
                if (!script) throw new Error('A ação "evaluate" requer o parâmetro "script".');
                this.#emitter?.emit('browser:action', { action: 'evaluate' });
                const evalResult = await this.#driver.evaluate(script);
                return {
                    success: true,
                    action: 'evaluate',
                    result: evalResult
                };
            }

            default:
                throw new Error(`Ação de navegador não reconhecida: "${action}". Ações suportadas: navigate, click, type, extract, screenshot, evaluate.`);
        }
    }
}

module.exports = BrowserActionTool;

