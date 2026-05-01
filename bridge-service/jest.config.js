/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/simple-bridge.ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.mjs$': ['ts-jest', { useESM: true }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@solana/web3\\.js|@solana/spl-token|@solana/buffer-layout|@solana/buffer-layout-utils|bs58|jayson)/)',
  ],
};
