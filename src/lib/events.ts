import { prisma } from './prisma'

export interface ProgressEvent {
  jobId: string
  stage: string
  status: 'started' | 'progress' | 'completed' | 'error'
  message: string
  count?: number
  timestamp: number
}

export async function emitProgressEvent(event: ProgressEvent) {
  try {
    await prisma.progressEvent.create({
      data: {
        jobId: event.jobId,
        stage: event.stage,
        status: event.status,
        message: event.message,
        count: event.count,
        timestamp: BigInt(event.timestamp),
      },
    })
    console.log(`[Job ${event.jobId}] ${event.stage}: ${event.message}`)
  } catch (error) {
    console.error('Error emitting progress event:', error)
  }
}

export async function getProgressEvents(jobId: string): Promise<ProgressEvent[]> {
  try {
    const events = await prisma.progressEvent.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    })
    
    return events.map((e: any): ProgressEvent => ({
      jobId: e.jobId,
      stage: e.stage,
      status: e.status as 'started' | 'progress' | 'completed' | 'error',
      message: e.message,
      count: e.count ?? undefined,
      timestamp: Number(e.timestamp),
    }))
  } catch (error) {
    console.error('Error getting progress events:', error)
    return []
  }
}

export async function clearProgressEvents(jobId: string) {
  try {
    await prisma.progressEvent.deleteMany({
      where: { jobId },
    })
  } catch (error) {
    console.error('Error clearing progress events:', error)
  }
}
