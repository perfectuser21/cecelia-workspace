"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const collect_route_1 = __importDefault(require("./collect.route"));
exports.router = collect_route_1.default;
exports.basePath = '/v1/collect'; // Routes at /v1/collect/healthcheck, etc.
exports.requiresAuth = true;
var collect_service_1 = require("./collect.service");
Object.defineProperty(exports, "collectService", { enumerable: true, get: function () { return collect_service_1.collectService; } });
//# sourceMappingURL=index.js.map