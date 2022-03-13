import { SyntaxKind, TypeFormatFlags, Node } from 'ts-morph'
import { findInitializer, getDescription, isTsLib } from './utils'
import type { Type, SourceFile } from 'ts-morph'

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

interface TypeRef {
  start: number
  end: number
  file: string
  text?: string
}

interface ResolvedType {
  refs?: TypeRef[]
  unionType?: ResolvedType[]
  text: string
}

const resolveType = (type: Type): ResolvedType => {
  let refs: TypeRef[] | undefined = undefined
  const decls = type.getSymbol()?.getDeclarations()
  refs = (decls ?? []).map((decl) => {
    const start = decl.getStart()
    const end = decl.getEnd()
    const file = decl.getSourceFile().getFilePath()
    const text = !isTsLib(file) ? decl.getText() : undefined
    return { start, end, file, text }
  })

  let unionType: ResolvedType[] | undefined = undefined
  if (type.isUnion()) {
    unionType = type.getUnionTypes().map((type) => resolveType(type))
  }
  return {
    refs,
    unionType,
    text: type.getText(
      undefined,
      TypeFormatFlags.InTypeAlias | TypeFormatFlags.NoTruncation
    ),
  }
}

export interface Prop {
  name: string
  type: ResolvedType
  default: string
  description: string
  required: boolean
}
export interface Emit {
  name: string
  signatures: { name: string; type: ResolvedType }[][]
  description: string
}

export const parseTS = (sourceFile: SourceFile) => {
  sourceFile.addStatements(deps)

  let componentName = ''
  let props: Prop[] = []
  let emits: Emit[] = []

  const assignment = sourceFile.getExportAssignmentOrThrow(() => true)
  let callExpr = assignment.getExpression().asKind(SyntaxKind.CallExpression)
  if (!callExpr) {
    callExpr = findInitializer(assignment.getExpression().getSymbol())?.asKind(
      SyntaxKind.CallExpression
    )
  }

  if (!callExpr) return { componentName, props, emits }

  const componentOptions = callExpr
    .getArguments()?.[0]
    .asKind(SyntaxKind.ObjectLiteralExpression)
    ?.getType()

  if (componentOptions) {
    const nameDecl = componentOptions.getProperty('name')?.getValueDeclaration()
    const nameType = nameDecl?.getType()
    const init = findInitializer(nameDecl?.getSymbol())
    if (init && Node.isStringLiteral(init)) {
      componentName = init.getLiteralValue()
    } else if (nameType?.isStringLiteral()) {
      componentName = nameType.getLiteralValue() as string
    }
  }

  const type = callExpr.getType()
  if (type.getAliasSymbol()?.getName() !== 'DefineComponent')
    return { componentName, props, emits }

  const [propsType, , , , , , , emitsType] = type.getAliasTypeArguments()

  if (propsType.isObject()) {
    props = propsType
      .getProperties()
      .map((prop) => {
        const name = prop.getName()
        const description = getDescription(prop, 'description')

        const initializer = findInitializer(prop)?.getType()
        if (!initializer) return undefined

        const typeInitializer = findInitializer(
          initializer.getProperty('type')
        )?.getType()
        let type: ResolvedType
        if (!typeInitializer) {
          type = { text: 'any' }
        } else if (typeInitializer.getAliasSymbol()?.getName() === 'PropType') {
          type = resolveType(typeInitializer.getAliasTypeArguments()[0])
        } else {
          type = resolvePropRawType(sourceFile, typeInitializer)
        }

        const defaultValue =
          findInitializer(initializer.getProperty('default'))
            ?.getType()
            .getText() ?? ''
        const required =
          findInitializer(initializer.getProperty('required'))
            ?.getType()
            .getText() === 'true' ?? false

        return {
          name,
          type,
          default: defaultValue,
          description,
          required,
        }
      })
      .filter((prop): prop is Prop => !!prop)
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
