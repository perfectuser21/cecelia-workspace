"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.xWorker = exports.weiboWorker = exports.xhsWorker = exports.workers = void 0;
const xhs_worker_1 = __importDefault(require("./xhs.worker"));
exports.xhsWorker = xhs_worker_1.default;
const weibo_worker_1 = __importDefault(require("./weibo.worker"));
exports.weiboWorker = weibo_worker_1.default;
const x_worker_1 = __importDefault(require("./x.worker"));
exports.xWorker = x_worker_1.default;
exports.workers = {
    xhs: xhs_worker_1.default,
    weibo: weibo_worker_1.default,
    x: x_worker_1.default,
};
exports.default = exports.workers;
//# sourceMappingURL=index.js.map