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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claudeMonitorRepository = exports.claudeMonitorService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const claude_monitor_route_1 = __importDefault(require("./claude-monitor.route"));
exports.router = claude_monitor_route_1.default;
exports.basePath = '/v1/claude-monitor';
exports.requiresAuth = false; // No auth required for hooks to access
// Export service for cross-module dependencies
var claude_monitor_service_1 = require("./claude-monitor.service");
Object.defineProperty(exports, "claudeMonitorService", { enumerable: true, get: function () { return claude_monitor_service_1.claudeMonitorService; } });
var claude_monitor_repository_1 = require("./claude-monitor.repository");
Object.defineProperty(exports, "claudeMonitorRepository", { enumerable: true, get: function () { return claude_monitor_repository_1.claudeMonitorRepository; } });
// Export types
__exportStar(require("./claude-monitor.types"), exports);
//# sourceMappingURL=index.js.map