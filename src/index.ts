import { Project } from 'ts-morph'
import { parseTS } from './ts'

const project = new Project({
  skipAddingFilesFromTsConfig: true,
})
project.addSourceFilesAtPaths('./playground/*.ts')

const result = parseTS(project.getSourceFile('./playground/col.ts')!)
console.log(JSON.stringify(result, undefined, 2))
