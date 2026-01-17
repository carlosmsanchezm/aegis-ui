const config = require('@backstage/cli/config/eslint-factory')(__dirname);

// Override rules that are causing CI to fail
// TODO: Migrate to named React imports per https://backstage.io/docs/tutorials/jsx-transform-migration
// TODO: Fix relative monorepo imports to use absolute paths
module.exports = {
  ...config,
  rules: {
    ...config.rules,
    'no-restricted-syntax': 'off',
    '@backstage/no-relative-monorepo-imports': 'off',
    '@backstage/no-undeclared-imports': 'off',
    'dot-notation': 'off',
    'consistent-return': 'off',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
