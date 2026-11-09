module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  // In-memory MongoDB start-up and parallel-transaction tests can take a while.
  testTimeout: 90000,
  // Helpers live in tests/helpers and are not test files.
  testPathIgnorePatterns: ["/node_modules/", "/tests/helpers/"],
};
