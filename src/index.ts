import { Project } from 'ts-morph'
import { parseTS } from './ts'
import { parseVueSFC } from './vue-sfc'
import type { Result } from './ts'

export interface Options {
  tsConfigFilePath?: string
  rootPath?: string
}

export const generate = (files: string[], options: Options = {}) => {
  const project = new Project({
    tsConfigFilePath: options.tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
  })
  project.addSourceFilesAtPaths(files)

  const results: { filePath: string; result: Result }[] = []
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()

    let result: Result
    if (sourceFile.getFilePath().endsWith('.ts')) {
      result = parseTS(sourceFile, options)
    } else if (sourceFile.getFilePath().endsWith('.vue')) {
      result = parseVueSFC(sourceFile, options)
    } else {
      continue
    }

    results.push({
      filePath,
      result,
    })
  }

  return results
}
