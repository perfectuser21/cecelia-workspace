"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishService = exports.requiresAuth = exports.basePath = exports.router = void 0;
const publish_route_1 = __importDefault(require("./publish.route"));
exports.router = publish_route_1.default;
exports.basePath = '/v1/publish';
exports.requiresAuth = true;
var publish_service_1 = require("./publish.service");
Object.defineProperty(exports, "publishService", { enumerable: true, get: function () { return publish_service_1.publishService; } });
//# sourceMappingURL=index.js.map