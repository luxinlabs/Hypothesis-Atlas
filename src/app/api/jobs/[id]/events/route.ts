import { NextRequest } from 'next/server'
import { getProgressEvents } from '@/lib/events'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder()
  let lastEventCount = 0
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          } catch (error) {
            console.error('Error sending SSE event:', error)
          }
        }
      }

      const existingEvents = await getProgressEvents(params.id)
      for (const event of existingEvents) {
        sendEvent(event)
      }
      lastEventCount = existingEvents.length

      const checkInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(checkInterval)
          return
        }

        const allEvents = await getProgressEvents(params.id)
        
        if (allEvents.length > lastEventCount) {
          const newEvents = allEvents.slice(lastEventCount)
          for (const event of newEvents) {
            sendEvent(event)
          }
          lastEventCount = allEvents.length
        }

        const lastEvent = allEvents[allEvents.length - 1]
        if (lastEvent && (lastEvent.status === 'completed' || lastEvent.status === 'error')) {
          clearInterval(checkInterval)
          if (!isClosed) {
            isClosed = true
            try {
              controller.close()
            } catch (error) {
              console.error('Error closing SSE stream:', error)
            }
          }
        }
      }, 500)

      setTimeout(() => {
        clearInterval(checkInterval)
        if (!isClosed) {
          isClosed = true
          try {
            controller.close()
          } catch (error) {
            console.error('Error closing SSE stream on timeout:', error)
          }
        }
      }, 300000)
    },
    cancel() {
      isClosed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
