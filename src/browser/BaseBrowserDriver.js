/**
 * Interface abstrata para drivers de navegação web (Browser Use).
 * Define o contrato padrão para automação de páginas (Playwright, Puppeteer ou Mock).
 */
class BaseBrowserDriver {
    constructor() {
        if (new.target === BaseBrowserDriver) {
            throw new TypeError('BaseBrowserDriver é uma classe abstrata e não pode ser instanciada diretamente.');
        }
    }

    /**
     * Navega para a URL especificada.
     * @param {string} url
     * @param {Object} [options={}]
     * @returns {Promise<Object>} Metadados da página (url, title, status).
     */
    async navigate(url, options = {}) {
        throw new Error('Método navigate() não implementado.');
    }

    /**
     * Clica em um elemento da página identificado pelo seletor CSS ou texto.
     * @param {string} selector
     * @param {Object} [options={}]
     * @returns {Promise<boolean>}
     */
    async click(selector, options = {}) {
        throw new Error('Método click() não implementado.');
    }

    /**
     * Digita texto em um elemento de entrada identificado pelo seletor.
     * @param {string} selector
     * @param {string} text
     * @param {Object} [options={}]
     * @returns {Promise<boolean>}
     */
    async type(selector, text, options = {}) {
        throw new Error('Método type() não implementado.');
    }

    /**
     * Extrai o conteúdo textual ou atributos de elementos identificados pelo seletor.
     * @param {string} [selector='body']
     * @param {Object} [options={}]
     * @returns {Promise<string|Array<string>>}
     */
    async extractText(selector = 'body', options = {}) {
        throw new Error('Método extractText() não implementado.');
    }

    /**
     * Captura uma captura de tela (screenshot) da página ou elemento.
     * @param {Object} [options={}]
     * @returns {Promise<Object>} { buffer, base64, mimeType }
     */
    async screenshot(options = {}) {
        throw new Error('Método screenshot() não implementado.');
    }

    /**
     * Executa um script JS arbitrário no contexto da página.
     * @param {string} script
     * @returns {Promise<*>}
     */
    async evaluate(script) {
        throw new Error('Método evaluate() não implementado.');
    }

    /**
     * Retorna a URL atual da página ativa.
     * @returns {string}
     */
    getCurrentUrl() {
        throw new Error('Método getCurrentUrl() não implementado.');
    }

    /**
     * Retorna o título da página ativa.
     * @returns {string}
     */
    getTitle() {
        throw new Error('Método getTitle() não implementado.');
    }

    /**
     * Fecha o navegador e libera recursos alocados.
     * @returns {Promise<void>}
     */
    async close() {
        throw new Error('Método close() não implementado.');
    }
}

module.exports = BaseBrowserDriver;

