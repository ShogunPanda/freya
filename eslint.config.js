import { cowtech } from '@cowtech/eslint-config'
import { fixupConfigRules } from '@eslint/compat'

export default [
  // Cowtech's legacy plugins still use rule APIs removed in ESLint 10.
  ...fixupConfigRules(cowtech),
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
