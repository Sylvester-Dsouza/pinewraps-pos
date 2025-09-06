// jest.setup.js
// This file is run after the test environment is set up but before the tests are run

// Add any global test setup here

// Make Jest types globally available
global.jest = jest;
global.expect = expect;
global.describe = describe;
global.it = it;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.beforeAll = beforeAll;
global.afterAll = afterAll;