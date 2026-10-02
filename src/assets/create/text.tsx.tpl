import type { VNode } from 'preact'
import { useClient } from '@perseveranza-pets/freya/client'

export function Text({ text }: { text: string }): VNode {
  const { parseContent } = useClient()

  return <span data-pptx="text" dangerouslySetInnerHTML={{ __html: parseContent(text) }} />
}
