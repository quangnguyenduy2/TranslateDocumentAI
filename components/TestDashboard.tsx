import React, { useState } from 'react';
import { allTests, TestCase, TestExecution, TestStatus } from '../tests';
import { IconSettings, IconLoading, IconSuccess, IconError, IconClose, IconChevronDown, IconChevronUp } from './Icons';

export const TestDashboard = ({ onClose }: { onClose: () => void }) => {
  const [executions, setExecutions] = useState<Map<string, TestExecution>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  const runAllTests = async () => {
    setIsRunning(true);
    const newExecutions = new Map<string, TestExecution>();
    
    // Initialize all as pending
    allTests.forEach(test => {
      newExecutions.set(test.id, {
        testCase: test,
        status: 'pending'
      });
    });
    setExecutions(new Map(newExecutions));

    // Run each test sequentially
    for (const test of allTests) {
      // Mark as running
      newExecutions.set(test.id, {
        testCase: test,
        status: 'running'
      });
      setExecutions(new Map(newExecutions));

      try {
        const result = await test.run();
        newExecutions.set(test.id, {
          testCase: test,
          status: result.success ? 'passed' : 'failed',
          result
        });
      } catch (error) {
        newExecutions.set(test.id, {
          testCase: test,
          status: 'failed',
          error: error instanceof Error ? error : new Error('Unknown error')
        });
      }
      
      setExecutions(new Map(newExecutions));
    }

    setIsRunning(false);
  };

  const toggleExpand = (testId: string) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testId)) {
      newExpanded.delete(testId);
    } else {
      newExpanded.add(testId);
    }
    setExpandedTests(newExpanded);
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'running': return <IconLoading className="w-5 h-5 text-blue-400" />;
      case 'passed': return <IconSuccess className="w-5 h-5 text-green-400" />;
      case 'failed': return <IconError className="w-5 h-5 text-red-400" />;
      default: return <div className="w-5 h-5 border-2 border-slate-600 rounded-full" />;
    }
  };

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case 'running': return 'border-blue-500/50 bg-blue-900/10';
      case 'passed': return 'border-green-500/50 bg-green-900/10';
      case 'failed': return 'border-red-500/50 bg-red-900/10';
      default: return 'border-slate-700';
    }
  };

  const testsByCategory = allTests.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = [];
    acc[test.category].push(test);
    return acc;
  }, {} as Record<string, TestCase[]>);

  const totalTests = allTests.length;
  const executedTests = Array.from(executions.values()).filter((e: TestExecution) => e.status !== 'pending').length;
  const passedTests = Array.from(executions.values()).filter((e: TestExecution) => e.status === 'passed').length;
  const failedTests = Array.from(executions.values()).filter((e: TestExecution) => e.status === 'failed').length;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-md p-4">
      <div className="bg-slate-900 rounded-xl border-2 border-slate-700 w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-slate-800 to-slate-900">
          <div>
            <h2 className="font-bold text-2xl text-white flex items-center gap-3">
              <IconSettings className="w-7 h-7 text-blue-400" />
              System Health Dashboard
            </h2>
            <p className="text-sm text-slate-400 mt-1">Runtime testing and validation</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
          >
            <IconClose className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Bar */}
        {executions.size > 0 && (
          <div className="p-4 bg-slate-800/50 border-b border-slate-700 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{totalTests}</div>
              <div className="text-xs text-slate-400">Total Tests</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{executedTests}</div>
              <div className="text-xs text-slate-400">Executed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{passedTests}</div>
              <div className="text-xs text-slate-400">Passed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{failedTests}</div>
              <div className="text-xs text-slate-400">Failed</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/30">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <IconLoading className="w-5 h-5" />
                Running Tests... ({executedTests}/{totalTests})
              </>
            ) : (
              <>
                <IconSettings className="w-5 h-5" />
                Run All Tests
              </>
            )}
          </button>
        </div>

        {/* Test Results */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {Object.entries(testsByCategory).map(([category, tests]) => (
            <div key={category} className="mb-6">
              <h3 className="font-bold text-lg text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                {category} Tests
                <span className="text-xs bg-slate-700 px-2 py-1 rounded-full">{tests.length}</span>
              </h3>
              
              <div className="space-y-2">
                {tests.map(test => {
                  const execution = executions.get(test.id);
                  const status = execution?.status || 'pending';
                  const isExpanded = expandedTests.has(test.id);

                  return (
                    <div 
                      key={test.id}
                      className={`border rounded-lg overflow-hidden transition-all ${getStatusColor(status)}`}
                    >
                      <div 
                        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-700/30"
                        onClick={() => toggleExpand(test.id)}
                      >
                        {getStatusIcon(status)}
                        
                        <div className="flex-1">
                          <div className="font-medium text-white">{test.name}</div>
                          <div className="text-xs text-slate-400">{test.description}</div>
                        </div>

                        {execution?.result?.duration && (
                          <div className="text-xs text-slate-500">
                            {execution.result.duration.toFixed(2)}ms
                          </div>
                        )}

                        {isExpanded ? (
                          <IconChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <IconChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      {isExpanded && execution && (
                        <div className="p-3 border-t border-slate-700/50 bg-slate-900/50 text-sm">
                          {execution.result?.message && (
                            <div className={`mb-2 ${execution.status === 'passed' ? 'text-green-300' : 'text-red-300'}`}>
                              <strong>Result:</strong> {execution.result.message}
                            </div>
                          )}
                          
                          {execution.result?.details && (
                            <div className="text-slate-400">
                              <strong>Details:</strong>
                              <pre className="mt-1 p-2 bg-slate-950 rounded text-xs overflow-x-auto">
                                {JSON.stringify(execution.result.details, null, 2)}
                              </pre>
                            </div>
                          )}

                          {execution.error && (
                            <div className="text-red-300">
                              <strong>Error:</strong> {execution.error.message}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {executions.size === 0 && (
            <div className="text-center py-16 text-slate-500">
              <IconSettings className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No tests run yet</p>
              <p className="text-sm">Click "Run All Tests" to start validation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
