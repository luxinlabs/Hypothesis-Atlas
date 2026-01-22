const REDIS_URL = process.env.REDIS_URL

let redis: any = null

// Only create Redis client if REDIS_URL is explicitly set
// Don't import ioredis at all if not needed to prevent any connection attempts
if (REDIS_URL && typeof window === 'undefined') {
  console.log('REDIS_URL is set, Redis queue will be available')
  // Dynamic import to prevent loading ioredis when not needed
  import('ioredis').then((Redis) => {
    try {
      redis = new Redis.default(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('Redis connection failed after 3 retries, using fallback mode')
            return null
          }
          return Math.min(times * 100, 2000)
        },
      })
      
      redis.on('error', (err: Error) => {
        console.warn('Redis connection error:', err.message)
      })
      
      redis.on('close', () => {
        console.warn('Redis connection closed')
      })
    } catch (error) {
      console.warn('Redis initialization failed, will use fallback mode')
      redis = null
    }
  }).catch(() => {
    console.warn('Failed to load ioredis module')
    redis = null
  })
} else {
  console.log('REDIS_URL not set, using fallback mode for job processing')
}

export { redis }
