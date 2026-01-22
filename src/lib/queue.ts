import { redis } from './redis'

export interface JobData {
  jobId: string
  topicQuery: string
}

let evidenceQueue: any = null

// Only import and create queue if Redis is available
// This prevents bullmq from trying to connect when REDIS_URL is not set
async function initQueue() {
  if (redis && !evidenceQueue) {
    const { Queue } = await import('bullmq')
    evidenceQueue = new Queue<JobData>('evidence-mapping', {
      connection: redis as any,
    })
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
    const { processEvidenceMapping } = await import('../worker/processor')
    setTimeout(() => {
      processEvidenceMapping({ jobId, topicQuery })
    }, 100)
  }
}
