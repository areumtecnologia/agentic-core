/**
 * Web Tools Category
 * Tools for web operations: search, fetch, scrape, etc.
 */

class WebTools {
  constructor() {
    this.tools = new Map();
    this.initializeTools();
  }

  initializeTools() {
    // Web Search Tool
    this.tools.set('web_search', {
      name: 'web_search',
      category: 'web',
      description: 'Search the web for information using DuckDuckGo',
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results (default: 5)'
          }
        },
        required: ['query']
      },
      execute: async (args) => {
        const { query, maxResults = 5 } = args;
        try {
          const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
          const response = await fetch(url);
          const data = await response.json();
          
          return {
            query,
            results: {
              abstract: data.AbstractText || 'No abstract found',
              source: data.AbstractSource || 'Unknown',
              sourceLink: data.AbstractURL || '',
              relatedTopics: data.RelatedTopics?.slice(0, maxResults) || []
            },
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          throw new Error(`Web search failed: ${error.message}`);
        }
      }
    });

    // HTTP Fetch Tool
    this.tools.set('http_fetch', {
      name: 'http_fetch',
      category: 'web',
      description: 'Fetch content from a URL',
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
          }
        },
        required: ['url']
      },
      execute: async (args) => {
        const { url, method = 'GET', headers = {}, body } = args;
        try {
          const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
          });
          
          const contentType = response.headers.get('content-type');
          let data;
          if (contentType && contentType.includes('application/json')) {
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
        const { url } = args;
        try {
          const urlObj = new URL(url);
          const response = await fetch(url, { method: 'HEAD' });
          
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

  getTools() {
    return Array.from(this.tools.values());
  }

  getTool(name) {
    return this.tools.get(name);
  }
}

module.exports = { WebTools };
