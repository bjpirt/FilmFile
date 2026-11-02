import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';
import { expect, test } from 'vitest';

const header =
  '// Generated from openapi.json by api-types.test.ts. Run `pnpm generate` to update; do not edit.\n\n';

test('the generated API types match openapi.json', async () => {
  const types = astToString(
    await openapiTS(new URL('../openapi.json', import.meta.url), {
      // Image bodies are files, so the client can send and receive a File or Blob.
      transform: (schema) =>
        schema.format === 'binary'
          ? ts.factory.createTypeReferenceNode('Blob')
          : undefined,
    }),
  );

  await expect(`${header}${types}`).toMatchFileSnapshot('./api-types.ts');
});
