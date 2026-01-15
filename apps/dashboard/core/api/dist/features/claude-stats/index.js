"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.service = exports.requiresAuth = exports.basePath = exports.router = void 0;
const claude_stats_route_1 = __importDefault(require("./claude-stats.route"));
exports.router = claude_stats_route_1.default;
exports.basePath = '/v1/claude-stats';
exports.requiresAuth = false; // Dashboard has its own auth (Feishu login)
var claude_stats_service_1 = require("./claude-stats.service");
Object.defineProperty(exports, "service", { enumerable: true, get: function () { return claude_stats_service_1.service; } });
//# sourceMappingURL=index.js.map