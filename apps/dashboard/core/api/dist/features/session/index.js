"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiresAuth = exports.basePath = exports.router = void 0;
const session_route_1 = __importDefault(require("./session.route"));
exports.router = session_route_1.default;
exports.basePath = '/api/session';
exports.requiresAuth = false;
//# sourceMappingURL=index.js.map