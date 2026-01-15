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
exports.n8nWorkflowsService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const n8n_workflows_route_1 = __importDefault(require("./n8n-workflows.route"));
exports.router = n8n_workflows_route_1.default;
exports.basePath = '/v1/n8n-workflows';
exports.requiresAuth = false; // Public access for dashboard
// Export service for cross-module dependencies
var n8n_workflows_service_1 = require("./n8n-workflows.service");
Object.defineProperty(exports, "n8nWorkflowsService", { enumerable: true, get: function () { return n8n_workflows_service_1.n8nWorkflowsService; } });
// Export types
__exportStar(require("./n8n-workflows.types"), exports);
//# sourceMappingURL=index.js.map