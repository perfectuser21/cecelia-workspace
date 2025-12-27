// Douyin feature module
import { Router } from 'express';
import douyinRoute from './douyin.route';

export const router: Router = douyinRoute;
export const basePath = '/douyin';
export const requiresAuth = false;
