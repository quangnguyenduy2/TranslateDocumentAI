export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'Core' | 'Storage' | 'Processing' | 'UI';
  run: () => Promise<TestResult>;
}

export interface TestResult {
  success: boolean;
  message?: string;
  duration?: number;
  details?: any;
}

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface TestExecution {
  testCase: TestCase;
  status: TestStatus;
  result?: TestResult;
  error?: Error;
}
