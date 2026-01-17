const config = require('@backstage/cli/config/eslint-factory')(__dirname);

// Downgrade React default import deprecation to warning
// TODO: Migrate to named imports per https://backstage.io/docs/tutorials/jsx-transform-migration
config.rules = {
  ...config.rules,
  'no-restricted-syntax': 'warn',
  '@backstage/no-relative-monorepo-imports': 'warn',
};

module.exports = config;
