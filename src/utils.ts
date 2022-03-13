import { Node } from 'ts-morph'
import type { Symbol } from 'ts-morph'

export const getDescription = (
  symbol: Symbol,
  name: string,
  filter: Record<string, string> = {}
) =>
  symbol
    .getJsDocTags()
    .filter((tag) => {
      if (tag.getName() !== name) return false

      if (filter) {
        const text = tag.getText()
        return Object.entries(filter).every(([kind, value]) =>
          text.some((text) => text.kind === kind && text.text === value)
        )
      }

      return true
    })
    .map((tag) => tag.getText().find((text) => text.kind === 'text')?.text)
    .join('\n')

export const isTsLib = (filePath: string) =>
  filePath.includes('node_modules/typescript/lib')

// export const resolveType = (symbol: Symbol) => {}

export const findInitializer = (symbol: Symbol | undefined) => {
  if (!symbol) return undefined
  const decl = symbol.getValueDeclaration()
  if (Node.isInitializerExpressionGetable(decl)) {
    return decl.getInitializer()
  }
  return undefined
}
