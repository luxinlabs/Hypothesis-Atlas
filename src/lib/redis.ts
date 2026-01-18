import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let redis: Redis | null = null

try {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 3) return null
      return Math.min(times * 100, 2000)
    },
  })
  
  redis.on('error', (err) => {
    console.warn('Redis connection error:', err.message)
  })
} catch (error) {
  console.warn('Redis not available, will use fallback mode')
}

export { redis }
