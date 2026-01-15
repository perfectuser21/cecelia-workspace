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
exports.accountsRepository = exports.accountsService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const accounts_route_1 = __importDefault(require("./accounts.route"));
exports.router = accounts_route_1.default;
exports.basePath = '/v1/accounts';
exports.requiresAuth = true;
// Export service for cross-module dependencies
var accounts_service_1 = require("./accounts.service");
Object.defineProperty(exports, "accountsService", { enumerable: true, get: function () { return accounts_service_1.accountsService; } });
var accounts_repository_1 = require("./accounts.repository");
Object.defineProperty(exports, "accountsRepository", { enumerable: true, get: function () { return accounts_repository_1.accountsRepository; } });
// Export types
__exportStar(require("./accounts.types"), exports);
//# sourceMappingURL=index.js.map