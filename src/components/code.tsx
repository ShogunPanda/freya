import { type VNode } from 'preact'
import { type CodeDefinition } from '../slidesets/models.js'
import { useClient } from './contexts.js'

export function Code({ rendered, className }: CodeDefinition): VNode | null {
  const { resolveClasses } = useClient()

  if (!rendered) {
    return null
  }

  // Resolve classes
  rendered = rendered
    .replaceAll(
      / dante-code-element="true" class="([^"]+)"/g,
      (_: string, className: string) => ` class="${resolveClasses(className)}"`
    )
    .replaceAll('$', '&#36;')

  // Extract the root element classed and its contents
  const [, rootClassName, contents] = rendered.match(/<pre dante-code-root="true" class="([^"]+)">(.+)<\/pre>/s)!

  // Render the code block
  return (
    <pre
      className={resolveClasses('freya@code', className?.root, rootClassName)}
      dangerouslySetInnerHTML={{ __html: contents }}
    />
  )
}
