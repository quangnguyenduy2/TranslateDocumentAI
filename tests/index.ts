import { TestCase } from './types.ts';
import { coreTests } from './coreTests.ts';
import { storageTests } from './storageTests.ts';
import { processingTests } from './processingTests.ts';

export * from './types.ts';

export const allTests: TestCase[] = [
  ...coreTests,
  ...storageTests,
  ...processingTests
];

export const getTestsByCategory = (category: string): TestCase[] => {
  return allTests.filter(test => test.category === category);
};

export const getTestById = (id: string): TestCase | undefined => {
  return allTests.find(test => test.id === id);
};
