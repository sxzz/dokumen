import { writeFile } from 'fs/promises'
import path from 'path'
import { generate } from '.'

const rootPath = path.join(__dirname, '..')
const tsConfigFilePath = path.join(rootPath, 'tsconfig.json')

const results = generate(process.argv.slice(2), { rootPath, tsConfigFilePath })

for (const { result, filePath } of results) {
  const jsonFile = filePath.replace(/\.(ts|vue)$/, '.json')
  writeFile(jsonFile, JSON.stringify(result, undefined, 2))
}
