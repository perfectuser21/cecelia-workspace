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
exports.panoramaService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const panorama_route_1 = __importDefault(require("./panorama.route"));
exports.router = panorama_route_1.default;
exports.basePath = '/v1/panorama';
exports.requiresAuth = false; // Public access for dashboard
var panorama_service_1 = require("./panorama.service");
Object.defineProperty(exports, "panoramaService", { enumerable: true, get: function () { return panorama_service_1.panoramaService; } });
__exportStar(require("./panorama.types"), exports);
//# sourceMappingURL=index.js.map