import { applyCodeClasses } from '@perseveranza-pets/dante'
import { type VNode } from 'preact'
import { type CodeDefinition } from '../slidesets/models.js'
import { useClient } from './contexts.js'

export function Code({ rendered, className }: CodeDefinition): VNode | null {
  const { resolveClasses } = useClient()

  if (!rendered) {
    return null
  }

  const [rootClassName, codeContents] = applyCodeClasses(resolveClasses, rendered)

  // Render the code block
  return (
    <pre
      className={resolveClasses('freya@code', className?.root, rootClassName)}
      dangerouslySetInnerHTML={{ __html: codeContents }}
    />
  )
}
