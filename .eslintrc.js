module.exports = {
    extends: 'eslint:recommended',
  
    parserOptions: {
      ecmaVersion: 8,
      sourceType: "module",
      ecmaFeatures: {
        jsx: true
      }
    },
  
    env: {
      browser: true,
      webextensions: true,
      es6: true
    },
  
    rules: {
      semi: 'error',
      quotes: ['error', 'single']
    },
  
    globals: {}
  };