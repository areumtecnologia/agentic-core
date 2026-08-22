'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// memory/index.js — ponto de entrada do módulo de memória.
// ─────────────────────────────────────────────────────────────────────────────

const { MemoryStore } = require('./MemoryStore');
const { InMemoryStore } = require('./InMemoryStore');
const { WorkingMemory } = require('./WorkingMemory');
const { ContextCompactor } = require('./ContextCompactor');
const { OptimizedContextCompactor } = require('./OptimizedContextCompactor');
const { EpisodicMemory } = require('./EpisodicMemory');
const { SemanticMemory } = require('./SemanticMemory');
const { SemanticMemoryEnhanced } = require('./SemanticMemoryEnhanced');
const { SemanticSearch } = require('./SemanticSearch');
const { SharedMemory } = require('./SharedMemory');

module.exports = {
    MemoryStore,
    InMemoryStore,
    WorkingMemory,
    ContextCompactor,
    OptimizedContextCompactor,
    EpisodicMemory,
    SemanticMemory,
    SemanticMemoryEnhanced,
    SemanticSearch,
    SharedMemory,
};
