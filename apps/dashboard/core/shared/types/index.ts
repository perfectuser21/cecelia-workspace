// Common types for the social media scraper

export interface Platform {
  id: string;
  name: string;
  enabled: boolean;
}

export interface Account {
  id: string;
  platform: string;
  username: string;
  status: 'active' | 'inactive' | 'error';
}

export interface Metrics {
  followers: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  timestamp: Date;
}

export interface CollectionTask {
  id: string;
  platform: string;
  accountId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}
