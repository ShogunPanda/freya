import hljs from 'highlight.js'
import { Slide } from '../generation/models.js'

export function Code({ rendered, className }: Required<Slide>['code'] & { className?: string }): JSX.Element {
  return <div className={`code ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: rendered }} />
}
