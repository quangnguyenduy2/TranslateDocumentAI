import { TestCase } from './types';
import { coreTests } from './coreTests';
import { storageTests } from './storageTests';
import { processingTests } from './processingTests';

export * from './types';

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
