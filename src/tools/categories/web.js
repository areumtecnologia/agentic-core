/**
 * Web Tools Category
 * Tools for web operations: search, fetch, and URL validation with anti-SSRF protections.
 */

class WebTools {
  constructor(options = {}) {
    this.tools = new Map();
    this.allowPrivateIPs = !!options.allowPrivateIPs;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 15000;
    this.compactMode = Boolean(options.compactMode);
    this.initializeTools();
  }

  _validateUrlSecurity(urlString) {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch (e) {
      throw new Error(`Invalid URL format: "${urlString}".`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Security Violation: Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are allowed.`);
    }

    if (this.allowPrivateIPs) {
      return parsed;
    }

    const host = parsed.hostname.toLowerCase();
    
    // Lista de proteção anti-SSRF (localhost, redes privadas RFC 1918, link-local, metadados)
    const isPrivate = (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host)
    );

    if (isPrivate) {
      throw new Error(`Security Violation: Access to private network / local address "${host}" is blocked (anti-SSRF).`);
    }

    return parsed;
  }

  initializeTools() {
    // Web Search Tool
    this.tools.set('web_search', {
      name: 'web_search',
      category: 'web',
      description: 'Pesquisa informações reais e atualizadas na internet (Google/DuckDuckGo). Retorna os principais títulos, resumos e links encontrados na web. Use sempre que precisar buscar dados sobre empresas, notícias, termos técnicos, fatos recentes ou quando não souber a resposta.',
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo ou frase de busca na internet'
          },
          maxResults: {
            type: 'number',
            description: 'Número máximo de resultados a retornar (padrão: 5)'
          }
        },
        required: ['query']
      },
      execute: async (args) => {
        const rawQuery = typeof args === 'string' ? args : (args?.query || args?.search || args?.termo || '');
        const defaultLimit = this.compactMode ? 2 : 5;
        const maxResults = typeof args === 'object' && args?.maxResults ? Number(args.maxResults) : defaultLimit;
        const cleanQuery = String(rawQuery || '').trim();

        if (!cleanQuery) {
          return {
            success: false,
            error: 'Nenhum termo de busca fornecido.'
          };
        }

        try {
          // ── Método Principal: DuckDuckGo HTML Search (Resultados Reais da Web) ──
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

          const response = await fetch(searchUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            }
          });
          clearTimeout(timer);

          if (response.ok) {
            const html = await response.text();
            const results = [];

            // Regex robusto para capturar títulos, URLs e snippets do DuckDuckGo HTML
            const titleSnippetRegex = /<h2[^>]*>[\s\S]*?<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
            let match;

            const maxSnippetLen = this.compactMode ? 140 : 300;

            while ((match = titleSnippetRegex.exec(html)) !== null && results.length < maxResults) {
              const rawUrl = match[1];
              let finalUrl = rawUrl;
              try {
                const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://duckduckgo.com${rawUrl}`);
                const uddg = parsed.searchParams.get('uddg');
                if (uddg) finalUrl = decodeURIComponent(uddg);
              } catch (e) {}

              const title = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim();
              let snippet = match[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim();
              if (snippet.length > maxSnippetLen) {
                snippet = snippet.substring(0, maxSnippetLen) + '...';
              }

              if (title && snippet) {
                results.push({ title, snippet, url: finalUrl, link: finalUrl });
              }
            }

            if (results.length > 0) {
              return {
                success: true,
                query: cleanQuery,
                totalResults: results.length,
                results
              };
            }
          }

          // ── Fallback Secundário: DuckDuckGo Instant Answers API ──
          const fallbackUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1`;
          const fbResponse = await fetch(fallbackUrl);
          const fbData = await fbResponse.json();

          const fallbackResults = [];
          if (fbData.AbstractText) {
            fallbackResults.push({
              title: fbData.Heading || cleanQuery,
              snippet: fbData.AbstractText,
              url: fbData.AbstractURL || ''
            });
          }

          if (Array.isArray(fbData.RelatedTopics)) {
            for (const topic of fbData.RelatedTopics.slice(0, maxResults - fallbackResults.length)) {
              if (topic.Text && topic.FirstURL) {
                fallbackResults.push({
                  title: topic.Text.split(' - ')[0] || cleanQuery,
                  snippet: topic.Text,
                  url: topic.FirstURL
                });
              }
            }
          }

          return {
            success: fallbackResults.length > 0,
            query: cleanQuery,
            totalResults: fallbackResults.length,
            results: fallbackResults.length > 0 ? fallbackResults : 'Nenhum resultado encontrado na web para esta busca.'
          };
        } catch (error) {
          return {
            success: false,
            query: cleanQuery,
            error: `Erro ao pesquisar na web: ${error.message}`
          };
        }
      }
    });


    // HTTP Fetch Tool
    this.tools.set('http_fetch', {
      name: 'http_fetch',
      category: 'web',
      description: 'Fetch content from a URL safely',
      schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch'
          },
          method: {
            type: 'string',
            description: 'HTTP method (GET, POST, etc.)',
            default: 'GET'
          },
          headers: {
            type: 'object',
            description: 'HTTP headers'
          },
          body: {
            type: 'string',
            description: 'Request body for POST/PUT'
          },
          timeoutMs: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 15000)'
          }
        },
        required: ['url']
      },
      execute: async (args) => {
        const { url, method = 'GET', headers = {}, body, timeoutMs } = args || {};
        this._validateUrlSecurity(url);

        const timeout = timeoutMs || this.defaultTimeoutMs;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error(`HTTP request to "${url}" timed out after ${timeout}ms`)), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers,
            body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
            signal: controller.signal
          });
          
          const contentType = response.headers.get('content-type') || '';
          let data;
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }
          
          return {
            url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          throw new Error(`HTTP fetch failed: ${error.message}`);
        } finally {
          clearTimeout(timer);
        }
      }
    });

    // URL Validator Tool
    this.tools.set('validate_url', {
      name: 'validate_url',
      category: 'web',
      description: 'Validate if a URL is accessible and returns valid content',
      schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to validate'
          }
        },
        required: ['url']
      },
      execute: async (args) => {
        const { url } = args || {};
        try {
          this._validateUrlSecurity(url);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

          const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timer);
          
          return {
            url,
            valid: response.ok,
            status: response.status,
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length'),
            lastModified: response.headers.get('last-modified')
          };
        } catch (error) {
          return {
            url,
            valid: false,
            error: error.message
          };
        }
      }
    });
  }

  async search(args) {
    const tool = this.tools.get('web_search');
    if (!tool) throw new Error('Tool "web_search" not found in WebTools.');
    return tool.execute(args);
  }

  async execute(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) throw new Error(`Tool "${toolName}" not found in WebTools.`);
    return tool.execute(args);
  }

  getTools() {
    return Array.from(this.tools.values());
  }

  getTool(name) {
    return this.tools.get(name);
  }
}

module.exports = { WebTools };
