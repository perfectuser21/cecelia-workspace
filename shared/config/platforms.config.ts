// Platform specifications for content publishing

export interface PlatformSpec {
  name: string;
  displayName: string;
  imageSpecs: {
    aspectRatios: string[];
    maxWidth: number;
    maxHeight: number;
    maxSize: number; // bytes
    formats: string[];
  };
  videoSpecs: {
    maxDuration: number; // seconds
    maxSize: number; // bytes
    formats: string[];
  };
  titleLimit: number;
  contentLimit: number;
  supportsMultiImage: boolean;
  maxImages: number;
}

export const platformSpecs: Record<string, PlatformSpec> = {
  xhs: {
    name: 'xhs',
    displayName: '小红书',
    imageSpecs: {
      aspectRatios: ['3:4', '1:1', '4:3'],
      maxWidth: 2160,
      maxHeight: 2880,
      maxSize: 20 * 1024 * 1024, // 20MB
      formats: ['jpg', 'jpeg', 'png', 'webp'],
    },
    videoSpecs: {
      maxDuration: 300, // 5 minutes
      maxSize: 1024 * 1024 * 1024, // 1GB
      formats: ['mp4', 'mov'],
    },
    titleLimit: 20,
    contentLimit: 1000,
    supportsMultiImage: true,
    maxImages: 18,
  },
  weibo: {
    name: 'weibo',
    displayName: '微博',
    imageSpecs: {
      aspectRatios: ['*'], // any ratio
      maxWidth: 4096,
      maxHeight: 4096,
      maxSize: 20 * 1024 * 1024, // 20MB
      formats: ['jpg', 'jpeg', 'png', 'gif'],
    },
    videoSpecs: {
      maxDuration: 900, // 15 minutes
      maxSize: 500 * 1024 * 1024, // 500MB
      formats: ['mp4'],
    },
    titleLimit: 0, // no separate title
    contentLimit: 2000,
    supportsMultiImage: true,
    maxImages: 9,
  },
  x: {
    name: 'x',
    displayName: 'X (Twitter)',
    imageSpecs: {
      aspectRatios: ['16:9', '1:1', '4:5'],
      maxWidth: 4096,
      maxHeight: 4096,
      maxSize: 5 * 1024 * 1024, // 5MB
      formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    },
    videoSpecs: {
      maxDuration: 140, // 2:20
      maxSize: 512 * 1024 * 1024, // 512MB
      formats: ['mp4'],
    },
    titleLimit: 0, // no separate title
    contentLimit: 280,
    supportsMultiImage: true,
    maxImages: 4,
  },
  douyin: {
    name: 'douyin',
    displayName: '抖音',
    imageSpecs: {
      aspectRatios: ['9:16', '3:4', '1:1'],
      maxWidth: 1080,
      maxHeight: 1920,
      maxSize: 10 * 1024 * 1024, // 10MB
      formats: ['jpg', 'jpeg', 'png'],
    },
    videoSpecs: {
      maxDuration: 900, // 15 minutes
      maxSize: 4 * 1024 * 1024 * 1024, // 4GB
      formats: ['mp4', 'mov'],
    },
    titleLimit: 55,
    contentLimit: 2200,
    supportsMultiImage: true,
    maxImages: 35,
  },
  website: {
    name: 'website',
    displayName: 'ZenithJoyAI',
    imageSpecs: {
      aspectRatios: ['*'], // any ratio
      maxWidth: 4096,
      maxHeight: 4096,
      maxSize: 50 * 1024 * 1024, // 50MB
      formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    },
    videoSpecs: {
      maxDuration: 0, // unlimited
      maxSize: 0, // unlimited
      formats: ['mp4', 'webm', 'mov'],
    },
    titleLimit: 0, // unlimited
    contentLimit: 0, // unlimited
    supportsMultiImage: true,
    maxImages: 100,
  },
};

export function getPlatformSpec(platform: string): PlatformSpec | null {
  return platformSpecs[platform] || null;
}

export function getAllPlatforms(): PlatformSpec[] {
  return Object.values(platformSpecs);
}

export default platformSpecs;
