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
        // Stop retrying after 3 attempts
        if (times > 3) {
          console.warn('Redis connection failed after 3 retries, using fallback mode')
          return null
        }
        return Math.min(times * 100, 2000)
      },
    })
    
    redis.on('error', (err) => {
      console.warn('Redis connection error:', err.message)
      // Don't let errors propagate
    })
    
    redis.on('close', () => {
      console.warn('Redis connection closed')
    })

    // Don't attempt to connect immediately - let it connect on first use
    // This prevents errors during module initialization
  } catch (error) {
    console.warn('Redis initialization failed, will use fallback mode')
    redis = null
  }
} else {
  console.log('REDIS_URL not set, using fallback mode for job processing')
}

export { redis }
