const BaseBrowserDriver = require('./BaseBrowserDriver');

/**
 * Driver hermético de simulação de navegador (MockBrowserDriver) para testes,
 * ambientes CI/CD e servidores sem dependências de binários pesados de Chromium.
 */
class MockBrowserDriver extends BaseBrowserDriver {
    #currentUrl = 'about:blank';
    #currentTitle = 'New Tab';
    #mockPages = new Map(); // url -> { title, html, elements: { selector: { text, value, clicked } } }
    #currentElements = new Map();
    #history = [];
    #isOpen = true;

    constructor(options = {}) {
        super();
        if (options.initialPages) {
            for (const [url, page] of Object.entries(options.initialPages)) {
                this.setMockPage(url, page);
            }
        }
    }

    /**
     * Registra ou atualiza uma página simulada no driver.
     * @param {string} url - URL canônica.
     * @param {Object} page - { title, html, elements }
     */
    setMockPage(url, page = {}) {
        const normalized = this.#normalizeUrl(url);
        this.#mockPages.set(normalized, {
            title: page.title || 'Página Web',
            html: page.html || `<html><head><title>${page.title || 'Página'}</title></head><body>${page.text || ''}</body></html>`,
            elements: page.elements || {}
        });
    }

    #normalizeUrl(rawUrl) {
        try {
            const u = new URL(rawUrl);
            return u.href.replace(/\/$/, '');
        } catch {
            return String(rawUrl).replace(/\/$/, '');
        }
    }

    async navigate(url, options = {}) {
        this.#checkOpen();
        this.#currentUrl = url;
        this.#history.push(url);

        const normalized = this.#normalizeUrl(url);
        const page = this.#mockPages.get(normalized);
        if (page) {
            this.#currentTitle = page.title;
            this.#currentElements.clear();
            for (const [sel, el] of Object.entries(page.elements || {})) {
                this.#currentElements.set(sel, { ...el });
            }
            return {
                url,
                title: this.#currentTitle,
                status: 200,
                html: page.html
            };
        }

        // Página padrão sintética quando a URL não foi previamente registrada
        this.#currentTitle = `Exibição de ${new URL(url).hostname}`;
        this.#currentElements.clear();
        this.#currentElements.set('body', { text: `Conteúdo da página de ${url}` });
        this.#currentElements.set('h1', { text: `Bem-vindo a ${url}` });

        return {
            url,
            title: this.#currentTitle,
            status: 200,
            html: `<html><head><title>${this.#currentTitle}</title></head><body><h1>Bem-vindo a ${url}</h1></body></html>`
        };
    }

    async click(selector, options = {}) {
        this.#checkOpen();
        const el = this.#currentElements.get(selector) || { text: '', clicked: false };
        el.clicked = true;
        this.#currentElements.set(selector, el);
        return true;
    }

    async type(selector, text, options = {}) {
        this.#checkOpen();
        const el = this.#currentElements.get(selector) || {};
        el.value = (el.value || '') + text;
        this.#currentElements.set(selector, el);
        return true;
    }

    async extractText(selector = 'body', options = {}) {
        this.#checkOpen();
        if (this.#currentElements.has(selector)) {
            const el = this.#currentElements.get(selector);
            return el.text !== undefined ? el.text : el.value || '';
        }

        // Se for body, extrai todo o texto simulado dos elementos conhecidos
        if (selector === 'body') {
            const texts = [];
            for (const el of this.#currentElements.values()) {
                if (el.text) texts.push(el.text);
            }
            if (texts.length > 0) return texts.join('\n');
            const page = this.#mockPages.get(this.#currentUrl);
            return page ? page.html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim() : `Conteúdo de ${this.#currentUrl}`;
        }

        return '';
    }

    async screenshot(options = {}) {
        this.#checkOpen();
        // PNG sintético mínimo de 1x1 pixel em Buffer
        const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const buffer = Buffer.from(minimalPngBase64, 'base64');
        return {
            buffer,
            base64: minimalPngBase64,
            mimeType: 'image/png',
            url: this.#currentUrl,
            width: options.width || 1280,
            height: options.height || 800
        };
    }

    async evaluate(script) {
        this.#checkOpen();
        if (typeof script === 'function') {
            return script();
        }
        // Simulação segura
        if (script.includes('document.title')) return this.#currentTitle;
        if (script.includes('window.location.href')) return this.#currentUrl;
        return null;
    }

    getCurrentUrl() {
        return this.#currentUrl;
    }

    getTitle() {
        return this.#currentTitle;
    }

    getHistory() {
        return [...this.#history];
    }

    getElement(selector) {
        return this.#currentElements.get(selector);
    }

    async close() {
        this.#isOpen = false;
        this.#currentElements.clear();
    }

    #checkOpen() {
        if (!this.#isOpen) {
            throw new Error('MockBrowserDriver está fechado.');
        }
    }
}

module.exports = MockBrowserDriver;
