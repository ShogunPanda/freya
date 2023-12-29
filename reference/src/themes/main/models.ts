export interface Slide {
  layout?: string
  title?: string
  subtitle?: string
  content: string[]
  image: string
  foreground?: string
  background?: string
  options: {
    dark?: boolean
  }
  classes: {
    slide?: string
    title?: string
    subtitle?: string
    content?: string
    raw?: string
  }
  notes?: string
}
