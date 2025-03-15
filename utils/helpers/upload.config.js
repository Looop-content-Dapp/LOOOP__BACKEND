export const uploadConfig = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    supportedFormats: ['mp3', 'wav', 'aac', 'flac'],
    maxDailyUploads: 20,
    maxRetries: 3,
    qualityRequirements: {
      minBitrate: 128, // kbps
      maxBitrate: 320, // kbps
      minDuration: 30, // seconds
      maxDuration: 10 * 60 // 10 minutes
    },
    corruptionCheck: {
      enabled: true,
      checksumAlgorithm: 'sha256'
    }
  };
  