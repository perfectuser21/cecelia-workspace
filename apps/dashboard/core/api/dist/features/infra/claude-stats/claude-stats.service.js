"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.service = void 0;
exports.getStats = getStats;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const claude_stats_types_1 = require("./claude-stats.types");
// Use mounted path in container, fallback to HOME for local dev
const CLAUDE_DIR = process.env.CLAUDE_PROJECTS_DIR || path.join(process.env.HOME || '/root', '.claude', 'projects');
function calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens) {
    const pricing = claude_stats_types_1.MODEL_PRICING[model] || claude_stats_types_1.DEFAULT_PRICING;
    return ((inputTokens / 1000000) * pricing.input +
        (outputTokens / 1000000) * pricing.output +
        (cacheReadTokens / 1000000) * pricing.cache_read +
        (cacheCreationTokens / 1000000) * pricing.cache_creation);
}
async function parseJsonlFile(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    const session = {
        session_id: '',
        cwd: '',
        started_at: '',
        ended_at: null,
        models: new Set(),
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        messages: 0,
        entries: [],
    };
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    for await (const line of rl) {
        if (!line.trim())
            continue;
        try {
            const entry = JSON.parse(line);
            if (entry.sessionId && !session.session_id) {
                session.session_id = entry.sessionId;
            }
            if (entry.cwd && !session.cwd) {
                session.cwd = entry.cwd;
            }
            if (entry.timestamp) {
                if (!session.started_at || entry.timestamp < session.started_at) {
                    session.started_at = entry.timestamp;
                }
                if (!session.ended_at || entry.timestamp > session.ended_at) {
                    session.ended_at = entry.timestamp;
                }
            }
            // Count messages - dedupe by message ID to avoid counting same response multiple times
            // Claude logs each content block (thinking, text, tool_use) as separate entries with same usage
            if (entry.type === 'assistant' && entry.message?.usage && entry.message?.id) {
                const msgId = entry.message.id;
                // Skip if we already processed this message
                if (session._processedMsgIds?.has(msgId)) {
                    continue;
                }
                if (!session._processedMsgIds) {
                    session._processedMsgIds = new Set();
                }
                session._processedMsgIds.add(msgId);
                session.messages++;
                const usage = entry.message.usage;
                const model = entry.message.model || 'unknown';
                session.models.add(model);
                session.input_tokens += usage.input_tokens || 0;
                session.output_tokens += usage.output_tokens || 0;
                session.cache_read_tokens += usage.cache_read_input_tokens || 0;
                session.cache_creation_tokens += usage.cache_creation_input_tokens || 0;
                if (entry.timestamp) {
                    session.entries.push({
                        timestamp: entry.timestamp,
                        model,
                        input_tokens: usage.input_tokens || 0,
                        output_tokens: usage.output_tokens || 0,
                        cache_read_tokens: usage.cache_read_input_tokens || 0,
                        cache_creation_tokens: usage.cache_creation_input_tokens || 0,
                    });
                }
            }
        }
        catch {
            // Skip invalid JSON lines
        }
    }
    return session.session_id ? session : null;
}
async function getAllJsonlFiles() {
    const files = [];
    if (!fs.existsSync(CLAUDE_DIR)) {
        return files;
    }
    const dirs = fs.readdirSync(CLAUDE_DIR);
    for (const dir of dirs) {
        const dirPath = path.join(CLAUDE_DIR, dir);
        const stat = fs.statSync(dirPath);
        if (stat.isDirectory()) {
            const jsonlFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'));
            for (const file of jsonlFiles) {
                files.push(path.join(dirPath, file));
            }
        }
    }
    return files;
}
async function getStats(days = 30) {
    const files = await getAllJsonlFiles();
    const sessions = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    for (const file of files) {
        const session = await parseJsonlFile(file);
        if (session && session.started_at) {
            const sessionDate = new Date(session.started_at);
            if (sessionDate >= cutoffDate) {
                sessions.push(session);
            }
        }
    }
    // Sort by start time descending
    sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    // Calculate overview
    const modelUsage = {};
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalMessages = 0;
    for (const session of sessions) {
        totalInputTokens += session.input_tokens;
        totalOutputTokens += session.output_tokens;
        totalMessages += session.messages;
        for (const entry of session.entries) {
            const cost = calculateCost(entry.model, entry.input_tokens, entry.output_tokens, entry.cache_read_tokens, entry.cache_creation_tokens);
            totalCost += cost;
            if (!modelUsage[entry.model]) {
                modelUsage[entry.model] = {
                    model: entry.model,
                    input_tokens: 0,
                    output_tokens: 0,
                    cache_read_tokens: 0,
                    cache_creation_tokens: 0,
                    cost: 0,
                };
            }
            modelUsage[entry.model].input_tokens += entry.input_tokens;
            modelUsage[entry.model].output_tokens += entry.output_tokens;
            modelUsage[entry.model].cache_read_tokens += entry.cache_read_tokens;
            modelUsage[entry.model].cache_creation_tokens += entry.cache_creation_tokens;
            modelUsage[entry.model].cost += cost;
        }
    }
    const overview = {
        total_cost: Math.round(totalCost * 100) / 100,
        total_sessions: sessions.length,
        total_messages: totalMessages,
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        average_cost_per_session: sessions.length > 0 ? Math.round((totalCost / sessions.length) * 100) / 100 : 0,
        by_model: Object.values(modelUsage).map((m) => ({
            ...m,
            cost: Math.round(m.cost * 100) / 100,
        })),
    };
    // Calculate daily stats
    const dailyMap = {};
    for (const session of sessions) {
        for (const entry of session.entries) {
            const date = entry.timestamp.split('T')[0];
            if (!dailyMap[date]) {
                dailyMap[date] = {
                    date,
                    total_cost: 0,
                    total_input_tokens: 0,
                    total_output_tokens: 0,
                    total_cache_read_tokens: 0,
                    total_cache_creation_tokens: 0,
                    sessions: 0,
                    by_model: [],
                };
            }
            const cost = calculateCost(entry.model, entry.input_tokens, entry.output_tokens, entry.cache_read_tokens, entry.cache_creation_tokens);
            dailyMap[date].total_cost += cost;
            dailyMap[date].total_input_tokens += entry.input_tokens;
            dailyMap[date].total_output_tokens += entry.output_tokens;
            dailyMap[date].total_cache_read_tokens += entry.cache_read_tokens;
            dailyMap[date].total_cache_creation_tokens += entry.cache_creation_tokens;
        }
    }
    // Count unique sessions per day
    const sessionsByDay = {};
    for (const session of sessions) {
        const date = session.started_at.split('T')[0];
        if (!sessionsByDay[date])
            sessionsByDay[date] = new Set();
        sessionsByDay[date].add(session.session_id);
    }
    for (const [date, sessionsSet] of Object.entries(sessionsByDay)) {
        if (dailyMap[date]) {
            dailyMap[date].sessions = sessionsSet.size;
        }
    }
    const daily = Object.values(dailyMap)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((d) => ({
        ...d,
        total_cost: Math.round(d.total_cost * 100) / 100,
    }));
    // Recent sessions
    const recentSessions = sessions.slice(0, 20).map((s) => {
        const cost = s.entries.reduce((sum, e) => sum + calculateCost(e.model, e.input_tokens, e.output_tokens, e.cache_read_tokens, e.cache_creation_tokens), 0);
        return {
            session_id: s.session_id,
            cwd: s.cwd,
            started_at: s.started_at,
            ended_at: s.ended_at,
            model: Array.from(s.models).join(', ') || 'unknown',
            cost: Math.round(cost * 100) / 100,
            input_tokens: s.input_tokens,
            output_tokens: s.output_tokens,
            cache_read_tokens: s.cache_read_tokens,
            cache_creation_tokens: s.cache_creation_tokens,
            messages: s.messages,
        };
    });
    return {
        overview,
        daily,
        recent_sessions: recentSessions,
    };
}
exports.service = { getStats };
//# sourceMappingURL=claude-stats.service.js.map