/**
 * Built-in Tools Categories for Agentic Core
 * 
 * Provides a structured registry of common tools organized by category
 * with validation, composition, and marketplace capabilities.
 */

const { ToolRegistry } = require('./ToolRegistry');
const { WebTools } = require('./categories/web');
const { FileTools } = require('./categories/file');
const { DatabaseTools } = require('./categories/database');
const { SystemTools } = require('./categories/system');
const { CommunicationTools } = require('./categories/communication');
const { ReasoningTools } = require('./categories/reasoning');
const { MathTools } = require('./categories/math');
const { ToolComposer } = require('./ToolComposer');
const { ToolValidator } = require('./ToolValidator');
const { ToolMarketplace } = require('./ToolMarketplace');
const { ToolSecurityPolicy } = require('./ToolSecurityPolicy');

// Default singleton instances for out-of-the-box usage
const registry = new ToolRegistry();
const composer = new ToolComposer(registry);

module.exports = {
  registry,
  composer,
  ToolRegistry,
  WebTools,
  FileTools,
  DatabaseTools,
  SystemTools,
  CommunicationTools,
  ReasoningTools,
  MathTools,
  ToolComposer,
  ToolValidator,
  ToolMarketplace,
  ToolSecurityPolicy,
};


