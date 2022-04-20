import path from 'path'
import { expect, it } from 'vitest'
import { generate } from '../src'

const rootPath = path.join(__dirname, '..')
const tsConfigFilePath = path.join(rootPath, 'tsconfig.json')
const pathFixtures = path.resolve(__dirname, 'fixtures')

it('Options API', () => {
  const results = generate([path.resolve(pathFixtures, 'options.vue')], {
    tsConfigFilePath,
    rootPath,
  }).map(({ result }) => result)
  expect(results).matchSnapshot()
})
