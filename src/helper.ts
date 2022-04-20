export const helperCode = `
import type { ExtractPropTypes } from 'vue'
export type ResolveProp<T> = ExtractPropTypes<{
  key: { type: T; required: true }
}>['key']
export type ResolvePropType<T> = ResolveProp<T> extends { type: infer V }
  ? V
  : ResolveProp<T>
`
