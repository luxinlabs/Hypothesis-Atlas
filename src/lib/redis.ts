import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL

let redis: Redis | null = null

// Only attempt Redis connection if REDIS_URL is explicitly set
// This prevents connection attempts during build time
if (REDIS_URL && typeof window === 'undefined') {
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null
        return Math.min(times * 100, 2000)
      },
    })
    
    redis.on('error', (err) => {
      console.warn('Redis connection error:', err.message)
    })

    // Attempt to connect, but don't crash if it fails
    redis.connect().catch((err) => {
      console.warn('Redis not available, using fallback mode:', err.message)
      redis = null
    })
  } catch (error) {
    console.warn('Redis initialization failed, will use fallback mode')
    redis = null
  }
}

export { redis }
