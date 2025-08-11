import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';

export function createRollupConfig(packageName, hasStyles = false) {
  const plugins = [
    peerDepsExternal(),
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      rootDir: 'src'
    })
  ];

  if (hasStyles) {
    plugins.push(
      postcss({
        extract: true,
        minimize: true,
        use: ['sass']
      })
    );
  }

  return {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        inlineDynamicImports: true
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
        inlineDynamicImports: true
      }
    ],
    plugins,
    external: [
      'react',
      'react-dom',
      '@solana/web3.js',
      '@polkadot/api',
      '@polkadot/api-contract',
      '@polkadot/extension-dapp',
      'zustand'
    ]
  };
}