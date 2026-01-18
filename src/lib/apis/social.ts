export interface SocialSignal {
  id: string
  platform: 'twitter' | 'github'
  title: string
  url: string
  snippet: string
  author: string
  date: string
}

const MOCK_SOCIAL_SIGNALS: Record<string, SocialSignal[]> = {
  'neural implant stability': [
    {
      id: 'gh-1',
      platform: 'github',
      title: 'Neuralink/implant-stability-analysis',
      url: 'https://github.com/neuralink/implant-stability',
      snippet: 'Analysis tools for measuring electrode stability in chronic neural recordings',
      author: 'neuralink-research',
      date: '2024-01-15',
    },
    {
      id: 'tw-1',
      platform: 'twitter',
      title: '@neuroscience_lab thread on micromotion',
      url: 'https://twitter.com/neuroscience_lab/status/123',
      snippet: 'New preprint shows 40% reduction in micromotion with flexible polymer coatings',
      author: 'neuroscience_lab',
      date: '2024-01-10',
    },
  ],
  'gliosis': [
    {
      id: 'gh-2',
      platform: 'github',
      title: 'brain-tissue/gliosis-markers',
      url: 'https://github.com/brain-tissue/gliosis-markers',
      snippet: 'Dataset of immunohistochemistry markers for glial scarring around implants',
      author: 'brain-tissue',
      date: '2023-12-20',
    },
  ],
  'CRISPR': [
    {
      id: 'gh-3',
      platform: 'github',
      title: 'crispr-tools/base-editor-v3',
      url: 'https://github.com/crispr-tools/base-editor-v3',
      snippet: 'Latest base editing tools with improved specificity',
      author: 'crispr-tools',
      date: '2024-01-05',
    },
  ],
}

export async function searchSocialSignals(query: string, limit: number = 5): Promise<SocialSignal[]> {
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const lowerQuery = query.toLowerCase()
  
  for (const [key, signals] of Object.entries(MOCK_SOCIAL_SIGNALS)) {
    if (lowerQuery.includes(key.toLowerCase())) {
      return signals.slice(0, limit)
    }
  }
  
  const genericSignals: SocialSignal[] = [
    {
      id: 'gen-1',
      platform: 'github',
      title: `biotech/${query.replace(/\s+/g, '-').toLowerCase()}`,
      url: `https://github.com/biotech/${query.replace(/\s+/g, '-')}`,
      snippet: `Community repository for ${query} research tools and datasets`,
      author: 'biotech-community',
      date: '2023-11-15',
    },
  ]
  
  return genericSignals.slice(0, limit)
}
