// Workers export
import { WorkerInterface } from './worker.interface';
import xhsWorker from './xhs.worker';
import weiboWorker from './weibo.worker';
import xWorker from './x.worker';

export const workers: Record<string, WorkerInterface> = {
  xhs: xhsWorker,
  weibo: weiboWorker,
  x: xWorker,
};

export { WorkerInterface, xhsWorker, weiboWorker, xWorker };
export default workers;
