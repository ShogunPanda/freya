import { cowtech } from '@cowtech/eslint-config'

export default [
  ...cowtech,
  {
    ignores: ['reference/**']
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true
      }
    }
  }
]
