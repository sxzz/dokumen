import path from 'path'
import { Node, SyntaxKind, TypeFormatFlags } from 'ts-morph'
import { findInitializer, getDescription, isTsLib } from './utils'
import { helperCode } from './helper'
import type { Options } from '.'
import type { Emit, Prop, ResolvedType, TypeRef } from './types'
import type { CallExpression, SourceFile, Type } from 'ts-morph'

export interface Result {
  componentName?: string
  props?: Prop[]
  emits?: Emit[]
}

export const parseTS = (
  sourceFile: SourceFile,
  { rootPath }: Options
): Result => {
  sourceFile.addStatements(helperCode)

  return processOptionsAPI()

  function processOptionsAPI(): Result {
    let callExpr: CallExpression<ts.CallExpression> | undefined

    function getComponentOptions() {
      let expr: Node = assignment!.getExpression()

      // variable reference
      if (expr.asKind(SyntaxKind.Identifier)) {
        const ref = findInitializer(expr.getSymbol())!
        if (!ref) throw new Error('Option API: cannot find reference')

        expr = ref
      }

      if (expr.getKind() === SyntaxKind.CallExpression) {
        callExpr = expr.asKindOrThrow(SyntaxKind.CallExpression)
        const arg = callExpr.getArguments()[0]
        if (!arg) throw new Error('Option API: cannot find call first argument')
        expr = arg
      }

      if (expr.getKind() !== SyntaxKind.ObjectLiteralExpression) {
        throw new Error('Option API: cannot find property definition')
      }

      return expr.asKindOrThrow(SyntaxKind.ObjectLiteralExpression).getType()
    }

    function getComponentName() {
      const nameDecl = componentOptions
        .getProperty('name')
        ?.getValueDeclaration()
      const nameType = nameDecl?.getType()
      const init = findInitializer(nameDecl?.getSymbol())
      if (init && Node.isStringLiteral(init)) {
        return init.getLiteralValue()
      } else if (nameType?.isStringLiteral()) {
        return nameType.getLiteralValue() as string
      }
    }

    function isDefineComponentCall() {
      return (
        callExpr?.getType()?.getAliasSymbol()?.getName() === 'DefineComponent'
      )
    }

    function analyzePropsType(propsType: Type<ts.Type>): Prop[] {
      if (!propsType.isObject()) return []

      return propsType
        .getProperties()
        .map((prop): Prop | undefined => {
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
          } else if (
            typeInitializer.getAliasSymbol()?.getName() === 'PropType'
          ) {
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

    function analyzeEmitsType(emitsType: Type<ts.Type>): Emit[] {
      if (!emitsType.isObject()) return []
      return emitsType.getProperties().map((emit): Emit => {
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

    const assignment = sourceFile.getExportAssignment(() => true)
    if (!assignment) return {}

    const componentOptions = getComponentOptions()
    const componentName = getComponentName()

    let props: Prop[] = []
    let emits: Emit[] = []
    if (isDefineComponentCall()) {
      const type = callExpr!.getType()
      const [propsType, , , , , , , emitsType] = type.getAliasTypeArguments()
      props = analyzePropsType(propsType)
      emits = analyzeEmitsType(emitsType)
    }

    return {
      componentName,
      props,
      emits,
    }
  }

  function resolvePropRawType(file: SourceFile, type: Type) {
    const resolvedType = file.addTypeAlias({
      name: '__RESOLVE_PROPS_RAW_TYPE',
      type: `ResolvePropType<${type.getText()}>`,
    })
    const resolved = resolveType(resolvedType.getType())
    resolvedType.remove()
    return resolved
  }

  function resolveType(type: Type): ResolvedType {
    let refs: TypeRef[] | undefined = undefined
    const decls = type.getSymbol()?.getDeclarations()
    refs = (decls ?? []).map((decl) => {
      const start = decl.getStart()
      const end = decl.getEnd()
      let file = decl.getSourceFile().getFilePath().toString()
      if (
        rootPath &&
        !file.startsWith('/node_modules') &&
        path.isAbsolute(file)
      ) {
        file = path.relative(rootPath, file)
      }
      const text = !isTsLib(file) ? decl.getText() : undefined
      return {
        start,
        end,
        file,
        text,
      }
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
}
