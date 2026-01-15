"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const metrics_route_1 = __importDefault(require("./metrics.route"));
exports.router = metrics_route_1.default;
exports.basePath = '/v1/metrics';
exports.requiresAuth = true;
var metrics_service_1 = require("./metrics.service");
Object.defineProperty(exports, "metricService", { enumerable: true, get: function () { return metrics_service_1.metricService; } });
//# sourceMappingURL=index.js.map