"use strict";
// Claude Stats types
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PRICING = exports.MODEL_PRICING = void 0;
// Claude pricing (2025) - per million tokens
exports.MODEL_PRICING = {
    'claude-opus-4-5-20251101': { input: 15, output: 75, cache_read: 1.5, cache_creation: 18.75 },
    'claude-sonnet-4-5-20250929': { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 },
    'claude-sonnet-4-20250514': { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 },
    'claude-3-5-haiku-20241022': { input: 0.8, output: 4, cache_read: 0.08, cache_creation: 1 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25, cache_read: 0.03, cache_creation: 0.3 },
};
// Default pricing for unknown models (use Sonnet pricing)
exports.DEFAULT_PRICING = { input: 3, output: 15, cache_read: 0.3, cache_creation: 3.75 };
//# sourceMappingURL=claude-stats.types.js.map