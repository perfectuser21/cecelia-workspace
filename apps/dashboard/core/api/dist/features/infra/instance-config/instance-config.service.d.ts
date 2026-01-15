import { InstanceConfig } from './instance-config.types';
/**
 * Load all instance configs from YAML files
 */
export declare function loadAllConfigs(): void;
/**
 * Get config for a specific domain (from Host header)
 * Strips port from domain if present
 */
export declare function getConfigByDomain(host: string): {
    config: InstanceConfig;
    matchedDomain: string | undefined;
};
/**
 * Get config by instance name directly
 */
export declare function getConfigByInstance(instanceName: string): InstanceConfig | undefined;
/**
 * Get all loaded instance configs (for admin/debug)
 */
export declare function getAllConfigs(): InstanceConfig[];
/**
 * Reload configs (useful for development)
 */
export declare function reloadConfigs(): void;
export declare const service: {
    loadAllConfigs: typeof loadAllConfigs;
    getConfigByDomain: typeof getConfigByDomain;
    getConfigByInstance: typeof getConfigByInstance;
    getAllConfigs: typeof getAllConfigs;
    reloadConfigs: typeof reloadConfigs;
};
//# sourceMappingURL=instance-config.service.d.ts.map