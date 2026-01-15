"use strict";
/**
 * Tasks 模块入口
 *
 * 个人任务面板 - 对接 Notion 任务库
 * 支持按用户查看/勾选/新增任务
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
exports.TASKS_CONFIG = exports.requiresAuth = exports.basePath = exports.router = void 0;
const tasks_route_1 = __importDefault(require("./tasks.route"));
exports.router = tasks_route_1.default;
exports.basePath = '/api/tasks';
exports.requiresAuth = true; // 需要 API Key 认证
__exportStar(require("./tasks.service"), exports);
var tasks_config_1 = require("./tasks.config");
Object.defineProperty(exports, "TASKS_CONFIG", { enumerable: true, get: function () { return tasks_config_1.TASKS_CONFIG; } });
//# sourceMappingURL=index.js.map