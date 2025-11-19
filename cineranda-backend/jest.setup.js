// This file contains setup code that runs before each test
// You can add global mocks, setup libraries like jest-dom, etc.

console.log('Jest setup file loaded');

// Increase timeout for MongoDB memory server and bcrypt operations
jest.setTimeout(60000); // 60 seconds

module.exports = async () => {
  // Setup code for Jest tests can be added here
};