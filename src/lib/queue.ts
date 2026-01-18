import { Queue, Worker, Job as BullJob } from 'bullmq'
import { redis } from './redis'

export interface JobData {
  jobId: string
  topicQuery: string
}

let evidenceQueue: Queue<JobData> | null = null

if (redis) {
  evidenceQueue = new Queue<JobData>('evidence-mapping', {
    connection: redis,
  })
}

export { evidenceQueue }

export async function addEvidenceMappingJob(jobId: string, topicQuery: string) {
  if (evidenceQueue) {
    await evidenceQueue.add('map-evidence', { jobId, topicQuery })
  } else {
    const { processEvidenceMapping } = await import('../worker/processor')
    setTimeout(() => {
      processEvidenceMapping({ jobId, topicQuery })
    }, 100)
  }
}
