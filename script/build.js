import cpy from 'cpy';
import path from 'path';
import rimraf from 'rimraf';
import dirs from './dirs.js';
import { Parcel } from '@parcel/core';

const names = Object.keys(dirs);
const distDir = path.resolve(process.cwd(), 'dist');
const cacheDir = path.resolve(process.cwd(), '.parcel-cache');
const publicDir = path.resolve(process.cwd(), 'src/public/**');

rimraf.sync(distDir);
rimraf.sync(cacheDir);

(async function () {
    for (let index = 0; index < names.length; index++) {
        const name = names[index];
        const dir = dirs[name];

        const bundler = new Parcel({
            entries: `${dir}/${name}.js`,
            defaultConfig: '@parcel/config-default',
            mode: 'production',
            defaultTargetOptions: {
                sourceMaps: false,
                engines: {
                    browsers: ['last 1 Chrome version'],
                },
            },
            env: {
                NODE_ENV: 'production',
            },
        });

        try {
            const { bundleGraph, buildTime } = await bundler.run();
            const bundles = bundleGraph.getBundles();
            console.log(`✨ Built ${bundles.length} bundles in ${buildTime}ms!`);
        } catch (err) {
            console.log(err.diagnostics);
        }
    }

    await cpy(publicDir, distDir);
    console.log('✨ Copy public files success');
})();
