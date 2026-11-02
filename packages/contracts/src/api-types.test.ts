import openapiTS, { astToString } from 'openapi-typescript';
import { expect, test } from 'vitest';

const header =
  '// Generated from openapi.json by api-types.test.ts. Run `pnpm generate` to update; do not edit.\n\n';

test('the generated API types match openapi.json', async () => {
  const types = astToString(
    await openapiTS(new URL('../openapi.json', import.meta.url)),
  );

  await expect(`${header}${types}`).toMatchFileSnapshot('./api-types.ts');
});
