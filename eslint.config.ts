import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/dist/', '**/coverage/', 'test/architecture/fixtures/'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports.',
        },
        {
          selector: 'ExportAllDeclaration',
          message:
            'No barrel re-exports; import from the file that defines it.',
        },
        {
          selector: 'TSEnumDeclaration',
          message: 'Use a string literal union or an `as const` object.',
        },
      ],
      // Type assertions are only for tested boundary code, with a disable comment saying why.
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    // Layer rules (CLAUDE.md, "Architecture in brief"). Every import must be
    // allowed by a policy, including npm packages and Node built-ins.
    // test/architecture checks these rules against a fixture copy of the layout.
    files: [
      'apps/**/*.{ts,tsx}',
      'packages/**/*.ts',
      'test/architecture/fixtures/**/*.ts',
    ],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'apps/service/src/domain/**' },
        { type: 'application', pattern: 'apps/service/src/application/**' },
        { type: 'adapters', pattern: 'apps/service/src/adapters/**' },
        { type: 'composition', pattern: 'apps/service/src/composition/**' },
        { type: 'service-test', pattern: 'apps/service/test/**' },
        { type: 'web', pattern: 'apps/web/**' },
        { type: 'contracts', pattern: 'packages/contracts/**' },
      ].map((element) => ({ ...element, partialMatch: false })),
      // Element patterns match folders, so single files are classified here.
      'boundaries/files': [
        { category: 'main', pattern: 'apps/service/src/main.ts' },
        { category: 'test', pattern: '**/*.test.{ts,tsx}' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          checkUnknownLocals: true,
          policies: [
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { type: 'domain' } } },
            },
            {
              from: { element: { type: 'application' } },
              allow: { to: { element: { type: ['domain', 'application'] } } },
            },
            {
              from: { element: { type: 'adapters' } },
              allow: [
                {
                  to: {
                    element: {
                      type: ['domain', 'application', 'adapters', 'contracts'],
                    },
                  },
                },
                { to: { module: { origin: ['external', 'core'] } } },
              ],
            },
            {
              from: { element: { type: 'composition' } },
              allow: [
                {
                  to: {
                    element: {
                      type: [
                        'domain',
                        'application',
                        'adapters',
                        'composition',
                      ],
                    },
                  },
                },
                { to: { module: { origin: ['external', 'core'] } } },
              ],
            },
            {
              from: { file: { categories: 'main' } },
              allow: [
                { to: { element: { type: 'composition' } } },
                { to: { module: { origin: ['external', 'core'] } } },
              ],
            },
            {
              from: { element: { type: 'service-test' } },
              allow: [
                {
                  to: {
                    element: {
                      type: [
                        'domain',
                        'application',
                        'adapters',
                        'composition',
                        'service-test',
                        'contracts',
                      ],
                    },
                  },
                },
                { to: { module: { origin: ['external', 'core'] } } },
              ],
            },
            {
              from: { element: { type: 'contracts' } },
              allow: [
                { to: { element: { type: 'contracts' } } },
                { to: { module: { origin: 'external' } } },
              ],
            },
            {
              // The browser app: no Node built-ins, and only contracts from the workspace.
              from: { element: { type: 'web' } },
              allow: [
                { to: { element: { type: ['web', 'contracts'] } } },
                { to: { module: { origin: 'external' } } },
              ],
            },
            {
              // Tests in any layer may use the test tools.
              from: { file: { categories: 'test' } },
              allow: {
                to: {
                  module: {
                    origin: 'external',
                    source: ['vitest', 'fast-check'],
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
  {
    // Tool config files must use a default export.
    files: ['*.config.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
