import { writeFile } from 'fs/promises'
import { Project } from 'ts-morph'
import { parseTS } from './ts'

const project = new Project({
  skipAddingFilesFromTsConfig: true,
})
project.addSourceFilesAtPaths('./playground/*.ts')

const filename = './playground/test.ts'
const result = parseTS(project.getSourceFile(filename)!)
writeFile(
  filename.replace('.ts', '.json'),
  JSON.stringify(result, undefined, 2)
)
