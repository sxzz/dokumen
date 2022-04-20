import { parse } from '@vue/compiler-sfc'
import { parseTS } from './ts'
import type { Options } from '.'
import type { SourceFile } from 'ts-morph'

export const parseVueSFC = (sourceFile: SourceFile, options: Options) => {
  const source = sourceFile.getText()
  const { descriptor } = parse(source, {
    filename: sourceFile.getFilePath(),
  })
  let contents = ''
  if (descriptor.script) {
    contents += descriptor.script.content
  }
  if (descriptor.scriptSetup) {
    contents += `\n${descriptor.scriptSetup.content}`
  }
  const project = sourceFile.getProject()
  const file = project.createSourceFile(
    `${sourceFile.getFilePath()}.ts`,
    contents
  )
  project.removeSourceFile(sourceFile)

  return parseTS(file, options)
}
