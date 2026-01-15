"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentsRepository = exports.requiresAuth = exports.basePath = exports.router = void 0;
const contents_route_1 = __importDefault(require("./contents.route"));
exports.router = contents_route_1.default;
exports.basePath = '/api/contents';
exports.requiresAuth = false; // Has mixed auth (public + admin endpoints)
var contents_repository_1 = require("./contents.repository");
Object.defineProperty(exports, "contentsRepository", { enumerable: true, get: function () { return contents_repository_1.contentsRepository; } });
//# sourceMappingURL=index.js.map