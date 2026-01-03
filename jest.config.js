/** @type {import('jest').Config} */
module.exports = {
    testMatch: [
        '<rootDir>/apps/web/tests/**/*.test.ts',
        '<rootDir>/apps/web/__tests__/**/*.test.ts',
        '<rootDir>/apps/web/tests/**/*.test.tsx',
        '<rootDir>/apps/web/e2e/**/*.spec.ts',
        '<rootDir>/src/**/*.test.ts',
        '<rootDir>/src/**/*.spec.ts',
        '<rootDir>/apps/mobile/__tests__/**/*.test.tsx',
    ],
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                jsx: 'react',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                resolveJsonModule: true,
            },
        }],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/apps/web/$1',
        '^@/lib/(.*)$': '<rootDir>/apps/web/lib/$1',
        '^@/src/(.*)$': '<rootDir>/src/$1',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transformIgnorePatterns: [
        'node_modules/(?!(.*\\.mjs$))',
    ],
    globals: {
        'ts-jest': {
            isolatedModules: true,
        },
    },
};
