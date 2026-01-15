export interface ThemeConfig {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
}
export interface InstanceConfig {
    instance: string;
    name: string;
    theme: ThemeConfig;
    features: Record<string, boolean>;
}
export interface RawInstanceConfig {
    instance: string;
    name: string;
    domains: string[];
    theme: ThemeConfig;
    features: Record<string, boolean>;
}
export interface InstanceConfigResponse {
    success: boolean;
    config: InstanceConfig;
    matched_domain?: string;
}
//# sourceMappingURL=instance-config.types.d.ts.map