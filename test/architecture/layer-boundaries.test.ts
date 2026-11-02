import path from 'node:path';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// The fixtures copy the repo layout, with a `target` export in each layer.
const repoRoot = path.resolve(import.meta.dirname, '../..');
const fixtures = path.join(import.meta.dirname, 'fixtures');

async function boundaryErrors(
  fromFile: string,
  importStatement: string,
): Promise<string[]> {
  const eslint = new ESLint({
    cwd: repoRoot,
    ignore: false,
    // Fixture files aren't in a tsconfig, so run only the boundary rules, without type information.
    ruleFilter: ({ ruleId }) => ruleId.startsWith('boundaries/'),
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: false } },
    },
  });
  const results = await eslint.lintText(
    `${importStatement}\nexport { target };\n`,
    { filePath: path.join(fixtures, fromFile) },
  );
  return results.flatMap((result) =>
    result.messages.map((message) => message.message),
  );
}

beforeAll(() => {
  // Match element patterns against the fixture tree instead of the repo.
  process.env.ESLINT_PLUGIN_BOUNDARIES_ROOT_PATH = fixtures;
});

afterAll(() => {
  delete process.env.ESLINT_PLUGIN_BOUNDARIES_ROOT_PATH;
});

const domain = 'apps/service/src/domain/source.ts';
const application = 'apps/service/src/application/source.ts';
const adapters = 'apps/service/src/adapters/source.ts';
const composition = 'apps/service/src/composition/source.ts';
const main = 'apps/service/src/main.ts';
const serviceTest = 'apps/service/test/source.ts';
const web = 'apps/web/src/source.ts';
const contracts = 'packages/contracts/src/source.ts';

describe('allowed imports', () => {
  test.each([
    ['domain imports domain', domain, "import { target } from './target.ts';"],
    [
      'application imports domain',
      application,
      "import { target } from '../domain/target.ts';",
    ],
    [
      'adapters import application',
      adapters,
      "import { target } from '../application/target.ts';",
    ],
    [
      'adapters import contracts',
      adapters,
      "import { target } from '../../../../packages/contracts/src/target.ts';",
    ],
    [
      'adapters use Node built-ins',
      adapters,
      "import { target } from 'node:fs';",
    ],
    [
      'composition imports adapters',
      composition,
      "import { target } from '../adapters/target.ts';",
    ],
    [
      'main imports composition',
      main,
      "import { target } from './composition/target.ts';",
    ],
    [
      'service tests import composition',
      serviceTest,
      "import { target } from '../src/composition/target.ts';",
    ],
    ['contracts use npm packages', contracts, "import { target } from 'zod';"],
    [
      'web imports contracts',
      web,
      "import { target } from '../../../packages/contracts/src/target.ts';",
    ],
    ['web uses npm packages', web, "import { target } from 'react';"],
    [
      'a domain test uses the test tools',
      'apps/service/src/domain/source.test.ts',
      "import { target } from 'vitest';",
    ],
  ])('%s', async (_name, fromFile, importStatement) => {
    expect(await boundaryErrors(fromFile, importStatement)).toEqual([]);
  });
});

describe('disallowed imports', () => {
  test.each([
    [
      'domain imports an adapter',
      domain,
      "import { target } from '../adapters/target.ts';",
    ],
    [
      'domain imports a type from application',
      domain,
      "import type { target } from '../application/target.ts';",
    ],
    [
      'domain imports a file outside every layer',
      domain,
      "import { target } from '../stray.ts';",
    ],
    ['domain uses Node built-ins', domain, "import { target } from 'node:fs';"],
    ['domain uses npm packages', domain, "import { target } from 'zod';"],
    [
      'domain code uses the test tools',
      domain,
      "import { target } from 'vitest';",
    ],
    [
      'application imports an adapter',
      application,
      "import { target } from '../adapters/target.ts';",
    ],
    [
      'application uses Node built-ins',
      application,
      "import { target } from 'node:crypto';",
    ],
    [
      'adapters import composition',
      adapters,
      "import { target } from '../composition/target.ts';",
    ],
    [
      'composition imports main',
      composition,
      "import { target } from '../main.ts';",
    ],
    [
      'main imports domain directly',
      main,
      "import { target } from './domain/target.ts';",
    ],
    [
      'web imports the service',
      web,
      "import { target } from '../../service/src/domain/target.ts';",
    ],
    ['web uses Node built-ins', web, "import { target } from 'node:fs';"],
    [
      'contracts import the service',
      contracts,
      "import { target } from '../../../apps/service/src/domain/target.ts';",
    ],
  ])('%s', async (_name, fromFile, importStatement) => {
    expect(await boundaryErrors(fromFile, importStatement)).not.toEqual([]);
  });
});
