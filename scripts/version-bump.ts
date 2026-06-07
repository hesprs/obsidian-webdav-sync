const targetVersion = Bun.env.npm_package_version ?? '1.0.0';

// Read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(await Bun.file('manifest.json').text()) as {
	minAppVersion: string;
	version?: string;
};
const { minAppVersion } = manifest;
manifest.version = targetVersion;
await Bun.write('manifest.json', JSON.stringify(manifest, undefined, '\t'));

// Update versions.json with target version and minAppVersion from manifest.json
const versions = JSON.parse(await Bun.file('versions.json').text()) as Record<string, string>;
versions[targetVersion] = minAppVersion;
await Bun.write('versions.json', JSON.stringify(versions, undefined, '\t'));

Bun.spawnSync({ cmd: ['bun', 'oxfmt', 'versions.json', 'manifest.json'] });

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
