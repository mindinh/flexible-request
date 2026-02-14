/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            isolatedModules: true,
            useESM: false
        }]
    },
    testTimeout: 30000,
    setupFilesAfterEnv: [],
    moduleNameMapper: {
        '^#cds-models/(.*)$': '<rootDir>/@cds-models/$1/index.js'
    },
    // Ignore node_modules except @sap packages that need transpilation
    transformIgnorePatterns: [
        'node_modules/(?!(@sap)/)'
    ]
};
