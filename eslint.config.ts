import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/dist/', '**/coverage/'] },
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
    // Tool config files must use a default export.
    files: ['*.config.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
