/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  checkIgnorePragma: true,
  embeddedLanguageFormatting: 'auto',
  endOfLine: 'lf',

  /* Last version that doesn't squash type and value imports */
  importOrderTypeScriptVersion: '4.4.0',
  importOrderParserPlugins: ['typescript', 'jsx', 'explicitResourceManagement'],
  importOrder: [
    '<TYPES>^(node:)',
    '<TYPES>',
    '<BUILTIN_MODULES>',
    '^(react/(.*)$)|^(react$)|^(react-native(.*)$)',
    '<THIRD_PARTY_MODULES>',
    '',
    '<TYPES>^@local',
    '^@local/(.*)$',
    '',
    '<TYPES>^[.|..|~]',
    '^~/',
    '^[../]',
    '^[./]',
  ],
  insertPragma: false,
  overrides: [
    {
      files: ['*.mdx'],
      options: {
        proseWrap: 'preserve',
        htmlWhitespaceSensitivity: 'ignore',
      },
    },
    {
      files: ['*.md.hbs'],
      options: {
        parser: 'markdown',
        proseWrap: 'preserve',
        htmlWhitespaceSensitivity: 'ignore',
      },
    },
    {
      files: ['*.txt.hbs'],
      options: {
        parser: 'markdown',
        proseWrap: 'preserve',
        htmlWhitespaceSensitivity: 'ignore',
      },
    },
    {
      files: '*.json.hbs',
      options: {
        parser: 'json',
      },
    },
    {
      files: '*.js.hbs',
      options: {
        parser: 'typescript',
      },
    },
    {
      files: '*.ts.hbs',
      options: {
        parser: 'typescript',
      },
    },
  ],
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  printWidth: 80,
  proseWrap: 'preserve',
  quoteProps: 'as-needed',
  rangeStart: 0,
  requirePragma: false,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
};

export default config;
