import { type VNode } from 'preact'
import { type CodeDefinition } from '../slidesets/models.js'
import { useClient, type CSSClassesResolver } from './contexts.js'

// This is needed to avoid compress code class multiple times
function shouldResolveClass(klass: string): boolean {
  return /^((font-italic|font-bold|underline|(?:text-#(?:[a-fA-F0-9]+)))\s*)+$/.test(klass)
}

function applyCodeClasses(resolveClasses: CSSClassesResolver, rendered: string): [string, string] {
  // Resolve classes
  rendered = rendered
    .replaceAll(
      / dante-code-element="true" class="([^"]+)"/g,
      (_: string, classes: string) => ` class="${shouldResolveClass(classes) ? resolveClasses(classes) : classes}"`
    )
    .replaceAll('$', '&#36;')

  // Extract the root element classed and its contents
  const [, rootClassName, contents] = rendered.match(/<pre dante-code-root="true" class="([^"]+)">(.+)<\/pre>/s)!

  return [rootClassName, contents]
}

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
