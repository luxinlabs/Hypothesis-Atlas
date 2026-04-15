import { redis } from './redis'

export interface JobData {
  jobId: string
  topicQuery: string
}

let evidenceQueue: any = null

// Only import and create queue if Redis is available
// This prevents bullmq from trying to connect when REDIS_URL is not set
async function initQueue() {
  if (process.env.REDIS_URL && redis && !evidenceQueue) {
    try {
      const { Queue } = await import('bullmq')
      evidenceQueue = new Queue<JobData>('evidence-mapping', {
        connection: redis as any,
      })
    } catch (error) {
      console.warn('Failed to initialize BullMQ queue, falling back to setTimeout mode:', error)
      evidenceQueue = null
    }
  }
  return evidenceQueue
}

export { evidenceQueue }

export async function addEvidenceMappingJob(jobId: string, topicQuery: string) {
  const queue = await initQueue()
  
  if (queue) {
    await queue.add('map-evidence', { jobId, topicQuery })
  } else {
    // Fallback: process directly without queue
    console.log('Using setTimeout fallback for job:', jobId)
    try {
      const { processEvidenceMapping } = await import('../worker/processor')
      setTimeout(() => {
        processEvidenceMapping({ jobId, topicQuery })
          .then(() => console.log('Fallback processing completed for job:', jobId))
          .catch((error) => console.error('Fallback processing failed for job:', jobId, error))
      }, 100)
    } catch (error) {
      console.error('Failed to initialize fallback processing for job:', jobId, error)
      throw error
    }
  }
}
