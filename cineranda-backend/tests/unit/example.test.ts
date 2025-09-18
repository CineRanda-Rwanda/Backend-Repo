const sum = (a: number, b: number): number => a + b;

describe('Basic test example', () => {
  it('adds 1 + 2 to equal 3', () => {
    expect(sum(1, 2)).toBe(3);
  });
});