import { watch } from 'fs';
import cpy from 'cpy';
import path from 'path';
import dirs from './dirs.js';
import { Parcel } from '@parcel/core';
import { fileURLToPath } from 'url';

const names = Object.keys(dirs);
const dist = path.resolve(process.cwd(), 'dist');
const publicDir = path.resolve(process.cwd(), 'src/public/**');

watch(
    path.resolve(process.cwd(), 'src/public/'),
    {
        recursive: true,
    },
    async () => {
        await cpy(publicDir, dist);
        console.log('✨ Copy public files success');
    },
);

for (let index = 0; index < names.length; index++) {
    const name = names[index];
    const dir = dirs[name];

    const bundler = new Parcel({
        entries: `${dir}/${name}.js`,
        defaultConfig: '@parcel/config-default',
        mode: 'development',
        defaultTargetOptions: {
            engines: {
                browsers: ['last 1 Chrome version'],
            },
        },
        env: {
            NODE_ENV: 'development',
        },
        additionalReporters: [
            {
                packageName: '@parcel/reporter-cli',
                resolveFrom: fileURLToPath(import.meta.url),
            },
        ],
    });

    bundler.watch(async (error, event) => {
        if (error) throw error;
        await cpy(publicDir, dist);
        if (event.type === 'buildSuccess') {
            const bundles = event.bundleGraph.getBundles();
            console.log(`[${name}]`, `✨ Built ${bundles.length} bundles in ${event.buildTime}ms!`);
        } else if (event.type === 'buildFailure') {
            console.log(`[${name}]`, event.diagnostics);
        }
    });
}
