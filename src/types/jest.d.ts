// This file provides TypeScript declarations for Jest

declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any> {
      (...args: Y): T;
      mockImplementation(fn: (...args: Y) => T): this;
      mockReturnValue(value: T): this;
      mockReturnValueOnce(value: T): this;
      mockResolvedValue(value: T): this;
      mockResolvedValueOnce(value: T): this;
      mockRejectedValue(value: any): this;
      mockRejectedValueOnce(value: any): this;
      mockClear(): this;
      mockReset(): this;
      mockRestore(): this;
    }

    function fn<T = any, Y extends any[] = any>(): Mock<T, Y>;
    function fn<T = any, Y extends any[] = any>(implementation: (...args: Y) => T): Mock<T, Y>;
    function clearAllMocks(): void;
    function resetAllMocks(): void;
    function restoreAllMocks(): void;
    function mock(moduleName: string, factory?: any): void;
  }

  function describe(name: string, fn: () => void): void;
  function beforeEach(fn: () => void): void;
  function afterEach(fn: () => void): void;
  function beforeAll(fn: () => void): void;
  function afterAll(fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function expect<T>(value: T): any;
}

export {};