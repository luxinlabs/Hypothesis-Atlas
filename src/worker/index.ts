import { Worker } from 'bullmq'
import { processEvidenceMapping } from './processor'

const REDIS_URL = process.env.REDIS_URL

async function startWorker() {
  if (!REDIS_URL) {
    console.error('REDIS_URL not set. Worker cannot start.')
    console.log('Jobs will be processed in fallback mode via setTimeout')
    process.exit(0)
  }

  console.log('Starting worker with Redis connection...')

  // Dynamic import to ensure Redis is loaded
  const Redis = (await import('ioredis')).default
  
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries')
        process.exit(1)
      }
      return Math.min(times * 100, 2000)
    },
  })

  redis.on('error', (err) => {
    console.error('Redis connection error:', err.message)
  })

  const worker = new Worker(
    'evidence-mapping',
    async (job) => {
      console.log(`Processing job ${job.id}:`, job.data)
      await processEvidenceMapping(job.data)
    },
    {
      connection: redis as any,
      concurrency: 2,
    }
  )

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err)
  })

  console.log('Worker started and listening for jobs...')
}

startWorker().catch((err) => {
  console.error('Failed to start worker:', err)
  process.exit(1)
})
