/**
 * Tool Marketplace - Registry and discovery for tools
 * Manages tool registration, discovery, and sharing
 */

class ToolMarketplace {
  constructor() {
    this.tools = new Map();
    this.categories = new Map();
    this.tags = new Map();
    this.ratings = new Map();
    this.usageStats = new Map();
  }

  /**
   * Register a tool in the marketplace
   */
  registerTool(tool, metadata = {}) {
    const toolId = tool.name || `tool_${Date.now()}`;
    
    const toolEntry = {
      id: toolId,
      name: tool.name,
      description: tool.description,
      category: tool.category || 'uncategorized',
      version: metadata.version || '1.0.0',
      author: metadata.author || 'unknown',
      tags: metadata.tags || [],
      schema: tool.schema,
      execute: tool.execute,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloads: 0,
      rating: 0,
      reviews: []
    };

    this.tools.set(toolId, toolEntry);
    
    // Index by category
    if (!this.categories.has(toolEntry.category)) {
      this.categories.set(toolEntry.category, new Set());
    }
    this.categories.get(toolEntry.category).add(toolId);
    
    // Index by tags
    toolEntry.tags.forEach(tag => {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag).add(toolId);
    });

    this.usageStats.set(toolId, {
      executions: 0,
      errors: 0,
      lastUsed: null,
      averageExecutionTime: 0
    });

    return toolId;
  }

  /**
   * Discover tools by category
   */
  discoverByCategory(category) {
    const toolIds = this.categories.get(category) || new Set();
    return Array.from(toolIds).map(id => this.tools.get(id));
  }

  /**
   * Discover tools by tag
   */
  discoverByTag(tag) {
    const toolIds = this.tags.get(tag) || new Set();
    return Array.from(toolIds).map(id => this.tools.get(id));
  }

  /**
   * Search tools by name or description
   */
  search(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [id, tool] of this.tools) {
      if (
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(tool);
      }
    }
    
    return results.sort((a, b) => b.downloads - a.downloads);
  }

  /**
   * Get tool by ID
   */
  getTool(toolId) {
    return this.tools.get(toolId);
  }

  /**
   * List all tools
   */
  listAll() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Rate a tool
   */
  rateTool(toolId, rating, review = '') {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    tool.reviews.push({
      rating,
      review,
      timestamp: new Date().toISOString()
    });

    // Recalculate average rating
    const totalRating = tool.reviews.reduce((sum, r) => sum + r.rating, 0);
    tool.rating = totalRating / tool.reviews.length;
    
    return tool.rating;
  }

  /**
   * Track tool usage
   */
  trackUsage(toolId, executionTime, success = true) {
    const stats = this.usageStats.get(toolId);
    if (!stats) return;

    stats.executions++;
    if (!success) stats.errors++;
    stats.lastUsed = new Date().toISOString();
    
    // Update average execution time
    const totalTime = stats.averageExecutionTime * (stats.executions - 1) + executionTime;
    stats.averageExecutionTime = totalTime / stats.executions;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(toolId) {
    return this.usageStats.get(toolId);
  }

  /**
   * Get popular tools
   */
  getPopular(limit = 10) {
    return Array.from(this.tools.values())
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  }

  /**
   * Get trending tools (recently used)
   */
  getTrending(limit = 10) {
    return Array.from(this.tools.values())
      .filter(tool => {
        const stats = this.usageStats.get(tool.id);
        return stats && stats.lastUsed;
      })
      .sort((a, b) => {
        const statsA = this.usageStats.get(a.id);
        const statsB = this.usageStats.get(b.id);
        return new Date(statsB.lastUsed) - new Date(statsA.lastUsed);
      })
      .slice(0, limit);
  }

  /**
   * Export marketplace data
   */
  export() {
    return {
      tools: Array.from(this.tools.values()),
      categories: Array.from(this.categories.keys()),
      tags: Array.from(this.tags.keys()),
      stats: Object.fromEntries(this.usageStats)
    };
  }

  /**
   * Import marketplace data
   */
  import(data) {
    if (data.tools) {
      data.tools.forEach(tool => {
        this.tools.set(tool.id, tool);
      });
    }
  }
}

module.exports = { ToolMarketplace };
