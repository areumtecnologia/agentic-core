'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// memory/index.js — ponto de entrada do módulo de memória.
// ─────────────────────────────────────────────────────────────────────────────

const { MemoryStore } = require('./MemoryStore');
const { InMemoryStore } = require('./InMemoryStore');
const { WorkingMemory } = require('./WorkingMemory');
const { ContextCompactor } = require('./ContextCompactor');
const { EpisodicMemory } = require('./EpisodicMemory');
const { SemanticMemory } = require('./SemanticMemory');

module.exports = {
    MemoryStore,
    InMemoryStore,
    WorkingMemory,
    ContextCompactor,
    EpisodicMemory,
    SemanticMemory,
};
