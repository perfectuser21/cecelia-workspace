"use strict";
/**
 * Webhook 验证模块
 */
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
exports.webhookValidatorRoutes = exports.WebhookValidatorService = void 0;
var webhook_validator_service_1 = require("./webhook-validator.service");
Object.defineProperty(exports, "WebhookValidatorService", { enumerable: true, get: function () { return webhook_validator_service_1.WebhookValidatorService; } });
__exportStar(require("./webhook-validator.types"), exports);
var webhook_validator_route_1 = require("./webhook-validator.route");
Object.defineProperty(exports, "webhookValidatorRoutes", { enumerable: true, get: function () { return __importDefault(webhook_validator_route_1).default; } });
//# sourceMappingURL=index.js.map