import neo4j, { Driver, Session } from 'neo4j-driver'

let driver: Driver | null = null

function getDriver(): Driver | null {
  if (driver) return driver

  const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env
  if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
    console.warn('Neo4j credentials not set, graph features disabled')
    return null
  }

  driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
  )

  return driver
}

export function getSession(): Session | null {
  const d = getDriver()
  if (!d) return null
  return d.session({ database: process.env.NEO4J_DATABASE || 'neo4j' })
}

export async function runCypher(query: string, params?: Record<string, any>) {
  const session = getSession()
  if (!session) return null

  try {
    const result = await session.run(query, params)
    return result.records
  } finally {
    await session.close()
  }
}

export async function verifyConnection(): Promise<boolean> {
  const d = getDriver()
  if (!d) return false
  try {
    await d.verifyConnectivity()
    return true
  } catch {
    return false
  }
}

export { neo4j }
