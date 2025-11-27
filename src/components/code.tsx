import type { VNode } from 'preact'
import type { CodeDefinition } from '../slidesets/models.ts'
import { cleanCssClasses } from './styling.ts'

export function Code({ rendered, className }: CodeDefinition): VNode | null {
  if (!rendered) {
    return null
  }

  rendered = rendered
    .replace(/^<pre class="([^"]+)"/, (_, klass: string) => `<pre class="${cleanCssClasses(klass, className?.root)}"`)
    .replaceAll('$', '&#36;')

  // Render the code block
  return <div dangerouslySetInnerHTML={{ __html: rendered }} />
}
