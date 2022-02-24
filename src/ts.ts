import { SyntaxKind, TypeFormatFlags } from 'ts-morph'
import type { Symbol as tsSymbol, SourceFile as tsSourceFile } from 'typescript'
import type { Type, Symbol, SourceFile } from 'ts-morph'
const deps = `
import type { ExtractPropTypes } from 'vue'
type ResolveProp<T> = ExtractPropTypes<{
  key: { type: T; required: true }
}>['key']
type ResolvePropType<T> = ResolveProp<T> extends { type: infer V }
  ? V
  : ResolveProp<T>
`

const resolvePropRawType = (file: SourceFile, type: Type) => {
  const resolvedType = file.addTypeAlias({
    name: '__RESOLVE_PROPS_RAW_TYPE',
    type: `ResolvePropType<${type.getText()}>`,
  })
  const resolved = resolveType(resolvedType.getType())
  resolvedType.remove()
  return resolved
}

const getDescription = (
  symbol: Symbol,
  name: string,
  textFilter: Record<string, string> = {}
) =>
  symbol
    .getJsDocTags()
    .filter((tag) => {
      if (tag.getName() !== name) return false

      if (textFilter) {
        const text = tag.getText()
        return Object.entries(textFilter).every(([kind, value]) =>
          text.some((text) => text.kind === kind && text.text === value)
        )
      }

      return true
    })
    .map((tag) => tag.getText().find((text) => text.kind === 'text')?.text)
    .join('\n')

interface ResolvedType {
  ref?: { start: number; end: number }
  refFile?: string
  text: string
}

const resolveType = (type: Type): ResolvedType => {
  const decl = type.getSymbol()?.getDeclarations()[0]
  const parent = (type.getSymbol()?.compilerSymbol as any).parent as
    | tsSymbol
    | undefined
  const refFile = (parent?.valueDeclaration as tsSourceFile | undefined)
    ?.fileName
  return {
    ref: decl ? { start: decl.getStart(), end: decl.getEnd() } : undefined,
    refFile,
    text: type.getText(undefined, TypeFormatFlags.InTypeAlias),
  }
}

export const parseTS = (sourceFile: SourceFile) => {
  sourceFile.addStatements(deps)

  const assignment = sourceFile.getExportAssignmentOrThrow(() => true)
  const callExpr = assignment
    .getExpression()
    .asKindOrThrow(SyntaxKind.CallExpression)

  const componentOptions = callExpr
    .getArguments()?.[0]
    .asKind(SyntaxKind.ObjectLiteralExpression)

  let componentName = ''
  if (componentOptions) {
    const nameProp = componentOptions.getProperty('name')
    componentName =
      nameProp
        ?.asKind(SyntaxKind.PropertyAssignment)
        ?.getInitializerIfKind(SyntaxKind.StringLiteral)
        ?.getLiteralText() ?? ''
  }

  const type = callExpr.getType()
  if (type.getAliasSymbol()?.getName() !== 'DefineComponent') return

  const [propsType, , , , , , , emitsType] = type.getAliasTypeArguments()
  let props: {
    name: string
    type: ResolvedType
    default: string
    description: string
    required: boolean
  }[] = []
  let emits: {
    name: string
    signatures: { name: string; type: ResolvedType }[][]
    description: string
  }[] = []

  if (propsType.isObject()) {
    props = propsType.getProperties().map((prop) => {
      const name = prop.getName()
      const description = getDescription(prop, 'description')

      const initializer = prop
        .getValueDeclarationOrThrow()
        .asKindOrThrow(SyntaxKind.PropertyAssignment)
        .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)

      const typeInitializer = initializer
        .getPropertyOrThrow('type')
        .asKindOrThrow(SyntaxKind.PropertyAssignment)
        .getInitializerOrThrow()
      const rawType = typeInitializer.getType()
      let type: ResolvedType
      if (rawType.getAliasSymbol()?.getName() === 'PropType') {
        type = resolveType(rawType.getAliasTypeArguments()[0])
      } else {
        type = resolvePropRawType(sourceFile, rawType)
      }

      const defaultValue =
        initializer
          .getProperty('default')
          ?.asKindOrThrow(SyntaxKind.PropertyAssignment)
          .getInitializerOrThrow()
          .getType()
          .getText() ?? ''
      const required =
        initializer
          .getProperty('required')
          ?.asKindOrThrow(SyntaxKind.PropertyAssignment)
          .getInitializerOrThrow()
          .getType()
          .getText() === 'true' ?? false

      return {
        name,
        type,
        default: defaultValue,
        description,
        required,
      }
    })
  }

  if (emitsType.isObject()) {
    emits = emitsType.getProperties().map((emit) => {
      const name = emit.getName()
      const description = getDescription(emit, 'description')
      const _type = emit.getValueDeclarationOrThrow().getType()
      const types = _type.isUnion() ? _type.getUnionTypes() : [_type]

      const signatures: { name: string; type: ResolvedType }[][] = []
      types.forEach((type) => {
        signatures.push(
          ...type.getCallSignatures().map((sign) => {
            const args = sign.getParameters().map((param) => {
              const name = param.getName()
              const type = resolveType(
                param.getValueDeclarationOrThrow().getType()
              )
              const description = getDescription(param, 'param', {
                parameterName: name,
              })
              return {
                name,
                type,
                description,
              }
            })
            return args
          })
        )
      })

      return {
        name,
        signatures,
        description,
      }
    })
  }

  return {
    componentName,
    props,
    emits,
  }
}
