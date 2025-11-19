module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js', './tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }],
  },
};