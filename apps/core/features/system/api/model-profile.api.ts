import { apiClient } from './client';

export interface ModelLayerConfig {
  provider: string;
  model: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  is_active: boolean;
  config: {
    thalamus: ModelLayerConfig;
    cortex: ModelLayerConfig;
    executor: {
      default_provider: string;
      model_map?: Record<string, Record<string, string | null>>;
      fixed_provider?: Record<string, string>;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface ModelProfilesResponse {
  success: boolean;
  profiles: ModelProfile[];
}

export interface ActiveProfileResponse {
  success: boolean;
  profile: ModelProfile;
}

export async function fetchModelProfiles(): Promise<ModelProfile[]> {
  const res = await apiClient.get<ModelProfilesResponse>('/brain/model-profiles');
  return res.data.profiles;
}

export async function fetchActiveProfile(): Promise<ModelProfile> {
  const res = await apiClient.get<ActiveProfileResponse>('/brain/model-profiles/active');
  return res.data.profile;
}

export async function switchProfile(profileId: string): Promise<void> {
  await apiClient.put('/brain/model-profiles/active', { profile_id: profileId });
}
