const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  extends: ['@sxzz/eslint-config-ts', '@sxzz/eslint-config-prettier'],
  rules: {
    'import/named': 'off',
    'import/namespace': 'off',
    'import/default': 'off',
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
  },
})
