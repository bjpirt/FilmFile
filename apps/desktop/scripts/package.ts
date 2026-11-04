import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses';
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { build } from 'rolldown';

// Builds FilmFile.app and FilmFile.dmg in apps/desktop/out (U84, D56), from
// the UI `pnpm build` has built. The app holds two bundles, its own main
// process and the service, with the built UI and the few packages that can't
// be bundled: sharp (native code, kept out of the app archive) and
// swagger-ui-dist (files the API docs serve).

const desktop = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(desktop, '../..');
const backend = path.join(repo, 'apps', 'backend');
const out = path.join(desktop, 'out');
const stage = path.join(out, 'stage');

const packageJson = z.object({
  version: z.string(),
  dependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
});

async function readPackage(folder: string) {
  return packageJson.parse(
    JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8')),
  );
}

/**
 * Copies a package, and the packages it needs, from the node_modules folder
 * `from` into the app's. pnpm keeps each package's own dependencies beside
 * it, in the node_modules folder that holds it; optional ones for other
 * platforms aren't installed, and are left out.
 */
async function copyPackage(
  name: string,
  from: string,
  copied = new Set<string>(),
): Promise<void> {
  const source = path.join(from, name);
  if (copied.has(name) || !existsSync(source)) {
    return;
  }
  copied.add(name);
  await cp(source, path.join(stage, 'node_modules', name), {
    recursive: true,
    dereference: true,
  });
  const real = await realpath(source);
  const own = real.slice(
    0,
    real.lastIndexOf(`${path.sep}node_modules${path.sep}`) +
      `${path.sep}node_modules`.length,
  );
  const { dependencies = {}, optionalDependencies = {} } =
    await readPackage(real);
  for (const dependency of [
    ...Object.keys(dependencies),
    ...Object.keys(optionalDependencies),
  ]) {
    await copyPackage(dependency, own, copied);
  }
}

async function bundle(input: string, file: string, external: string[]) {
  await build({
    input,
    platform: 'node',
    external,
    output: { file, format: 'esm' },
    logLevel: 'warn',
  });
}

await rm(out, { recursive: true, force: true });
await mkdir(stage, { recursive: true });

console.log('Bundling the app and the service…');
await bundle(
  path.join(desktop, 'src', 'main.ts'),
  path.join(stage, 'main.mjs'),
  ['electron'],
);
await bundle(
  path.join(backend, 'src', 'main.ts'),
  path.join(stage, 'service.mjs'),
  ['sharp', 'swagger-ui-dist'],
);
await cp(path.join(repo, 'apps', 'web', 'dist'), path.join(stage, 'web'), {
  recursive: true,
});
for (const name of ['sharp', 'swagger-ui-dist']) {
  await copyPackage(name, path.join(backend, 'node_modules'));
}
const { version } = await readPackage(desktop);
await writeFile(
  path.join(stage, 'package.json'),
  `${JSON.stringify({ name: 'filmfile', productName: 'FilmFile', version, type: 'module', main: 'main.mjs' }, null, 2)}\n`,
);

console.log('Packaging FilmFile.app…');
const electronVersion = (
  await readPackage(path.join(desktop, 'node_modules', 'electron'))
).version;
const [appFolder] = await packager({
  dir: stage,
  out,
  name: 'FilmFile',
  platform: 'darwin',
  arch: 'arm64',
  electronVersion,
  icon: path.join(desktop, 'build', 'icon.icns'),
  appBundleId: 'app.filmfile.desktop',
  appCategoryType: 'public.app-category.photography',
  // sharp's native code can't be loaded from inside the app archive.
  asar: { unpack: '**/node_modules/{sharp,@img}/**' },
  prune: false,
  overwrite: true,
  quiet: true,
});
if (appFolder === undefined) {
  throw new Error('The packager made no app.');
}
const app = path.join(appFolder, 'FilmFile.app');

// Electron's fuses: the app can't be used to run other code with Node.js,
// and loads only its own archive, checked against the hash it was built with.
await flipFuses(app, {
  version: FuseVersion.V1,
  resetAdHocDarwinSignature: true,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
});

console.log('Making FilmFile.dmg…');
const dmgFolder = path.join(out, 'dmg');
await mkdir(dmgFolder);
// ditto keeps the app's framework symlinks and signature as they are.
execFileSync('ditto', [app, path.join(dmgFolder, 'FilmFile.app')]);
await symlink('/Applications', path.join(dmgFolder, 'Applications'));
execFileSync('hdiutil', [
  'create',
  '-volname',
  'FilmFile',
  '-srcfolder',
  dmgFolder,
  '-ov',
  '-format',
  'UDZO',
  path.join(out, 'FilmFile.dmg'),
]);
await rm(dmgFolder, { recursive: true });
console.log(`Made ${app} and ${path.join(out, 'FilmFile.dmg')}`);
