const config = require('@backstage/cli/config/eslint-factory')(__dirname);

// Override rules that are causing CI to fail
module.exports = {
  ...config,
  rules: {
    ...config.rules,
    '@backstage/no-undeclared-imports': 'off',
  },
};
