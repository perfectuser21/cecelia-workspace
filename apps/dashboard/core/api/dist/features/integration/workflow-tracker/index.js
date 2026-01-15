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
exports.workflowTrackerRepository = exports.workflowTrackerService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const workflow_tracker_route_1 = __importDefault(require("./workflow-tracker.route"));
exports.router = workflow_tracker_route_1.default;
exports.basePath = '/v1/workflow-tracker';
exports.requiresAuth = false; // No auth required for executor to send events
// Export service for cross-module dependencies
var workflow_tracker_service_1 = require("./workflow-tracker.service");
Object.defineProperty(exports, "workflowTrackerService", { enumerable: true, get: function () { return workflow_tracker_service_1.workflowTrackerService; } });
var workflow_tracker_repository_1 = require("./workflow-tracker.repository");
Object.defineProperty(exports, "workflowTrackerRepository", { enumerable: true, get: function () { return workflow_tracker_repository_1.workflowTrackerRepository; } });
// Export types
__exportStar(require("./workflow-tracker.types"), exports);
//# sourceMappingURL=index.js.map