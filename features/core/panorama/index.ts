// Panorama feature module - provides real VPS project structure
import { Router } from 'express';
import panoramaRoute from './panorama.route';

export const router: Router = panoramaRoute;
export const basePath = '/v1/panorama';
export const requiresAuth = false; // Public access for dashboard

export { panoramaService } from './panorama.service';
export * from './panorama.types';
