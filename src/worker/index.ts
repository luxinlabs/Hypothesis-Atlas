import { Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { processEvidenceMapping } from './processor'

if (!redis) {
  console.error('Redis not available. Worker cannot start.')
  console.log('Jobs will be processed in fallback mode via setTimeout')
  process.exit(0)
}

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
