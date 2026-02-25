import React, { useState, useEffect } from 'react';
import { IconRefresh, IconSuccess, IconError, IconLoading } from './Icons';

interface HealthCheck {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  timestamp?: number;
  responseTime?: number;
}

interface SystemHealthDashboardProps {
  apiClient?: any;
  onClose: () => void;
}

export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({ apiClient, onClose }) => {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunTime, setLastRunTime] = useState<number>(0);

  const runHealthChecks = async () => {
    setIsRunning(true);
    const checks: HealthCheck[] = [];
    const startTime = Date.now();

    // 1. Frontend Health Check
    checks.push({
      name: 'Frontend Application',
      status: 'success',
      message: 'Running on ' + window.location.origin,
      timestamp: Date.now(),
      responseTime: 0
    });

    // 2. IndexedDB Health Check
    try {
      const checkStart = Date.now();
      const dbRequest = indexedDB.open('TranslateAppDB', 1);
      await new Promise((resolve, reject) => {
        dbRequest.onsuccess = () => resolve(true);
        dbRequest.onerror = () => reject(dbRequest.error);
      });
      checks.push({
        name: 'IndexedDB Storage',
        status: 'success',
        message: 'Database accessible',
        timestamp: Date.now(),
        responseTime: Date.now() - checkStart
      });
    } catch (err) {
      checks.push({
        name: 'IndexedDB Storage',
        status: 'error',
        message: `Database error: ${err}`,
        timestamp: Date.now()
      });
    }

    // 3. LocalStorage Health Check
    try {
      const checkStart = Date.now();
      localStorage.setItem('health_check', 'test');
      const value = localStorage.getItem('health_check');
      localStorage.removeItem('health_check');
      
      if (value === 'test') {
        checks.push({
          name: 'LocalStorage',
          status: 'success',
          message: 'Read/Write operations working',
          timestamp: Date.now(),
          responseTime: Date.now() - checkStart
        });
      } else {
        throw new Error('Read/Write verification failed');
      }
    } catch (err) {
      checks.push({
        name: 'LocalStorage',
        status: 'error',
        message: `Storage error: ${err}`,
        timestamp: Date.now()
      });
    }

    // 4. Backend API Health Check
    if (apiClient) {
      try {
        const checkStart = Date.now();
        const response = await apiClient.get('/health');
        checks.push({
          name: 'Backend API',
          status: 'success',
          message: `Server responding (${response.data?.status || 'OK'})`,
          timestamp: Date.now(),
          responseTime: Date.now() - checkStart
        });
      } catch (err: any) {
        checks.push({
          name: 'Backend API',
          status: 'error',
          message: `API unreachable: ${err.message || 'Connection failed'}`,
          timestamp: Date.now()
        });
      }
    } else {
      checks.push({
        name: 'Backend API',
        status: 'warning',
        message: 'API client not configured',
        timestamp: Date.now()
      });
    }

    // 5. Database Connection (via Backend)
    if (apiClient) {
      try {
        const checkStart = Date.now();
        const response = await apiClient.get('/admin/default-glossary', { 
          params: { page: 1, limit: 1 } 
        });
        checks.push({
          name: 'Database Connection',
          status: 'success',
          message: `PostgreSQL responding (${response.data?.total || 0} glossary items)`,
          timestamp: Date.now(),
          responseTime: Date.now() - checkStart
        });
      } catch (err: any) {
        checks.push({
          name: 'Database Connection',
          status: 'error',
          message: `Database error: ${err.response?.data?.message || err.message}`,
          timestamp: Date.now()
        });
      }
    }

    // 6. Gemini API Health Check
    try {
      const checkStart = Date.now();
      const testApiKey = process.env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
      
      if (!testApiKey) {
        checks.push({
          name: 'Gemini AI API',
          status: 'warning',
          message: 'API key not configured',
          timestamp: Date.now()
        });
      } else {
        // Simple API availability check (no actual translation)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${testApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'test' }] }]
          })
        });
        
        if (response.ok) {
          checks.push({
            name: 'Gemini AI API',
            status: 'success',
            message: 'API responding normally',
            timestamp: Date.now(),
            responseTime: Date.now() - checkStart
          });
        } else {
          checks.push({
            name: 'Gemini AI API',
            status: 'error',
            message: `API error: ${response.status} ${response.statusText}`,
            timestamp: Date.now()
          });
        }
      }
    } catch (err: any) {
      checks.push({
        name: 'Gemini AI API',
        status: 'error',
        message: `Connection failed: ${err.message}`,
        timestamp: Date.now()
      });
    }

    // 7. File Processing Libraries
    try {
      const checkStart = Date.now();
      
      // Test ExcelJS
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      
      // Test xlsx-populate
      const XlsxPopulate = (await import('xlsx-populate')).default;
      
      // Test JSZip
      const JSZip = (await import('jszip')).default;
      
      checks.push({
        name: 'File Processing Libraries',
        status: 'success',
        message: 'ExcelJS, xlsx-populate, JSZip loaded',
        timestamp: Date.now(),
        responseTime: Date.now() - checkStart
      });
    } catch (err: any) {
      checks.push({
        name: 'File Processing Libraries',
        status: 'error',
        message: `Library error: ${err.message}`,
        timestamp: Date.now()
      });
    }

    // 8. Browser Compatibility Check
    const browserChecks = [];
    if (typeof FileReader !== 'undefined') browserChecks.push('FileReader');
    if (typeof Blob !== 'undefined') browserChecks.push('Blob');
    if (typeof ArrayBuffer !== 'undefined') browserChecks.push('ArrayBuffer');
    if (typeof Worker !== 'undefined') browserChecks.push('WebWorker');
    
    checks.push({
      name: 'Browser Compatibility',
      status: browserChecks.length === 4 ? 'success' : 'warning',
      message: `Supported APIs: ${browserChecks.join(', ')}`,
      timestamp: Date.now()
    });

    setHealthChecks(checks);
    setLastRunTime(Date.now() - startTime);
    setIsRunning(false);
  };

  useEffect(() => {
    runHealthChecks();
  }, []);

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'success':
        return <IconSuccess className="w-5 h-5 text-green-500" />;
      case 'error':
        return <IconError className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <span className="w-5 h-5 text-yellow-500">⚠️</span>;
      default:
        return <IconLoading className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const successCount = healthChecks.filter(c => c.status === 'success').length;
  const errorCount = healthChecks.filter(c => c.status === 'error').length;
  const warningCount = healthChecks.filter(c => c.status === 'warning').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">System Health Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">
              Runtime testing and validation • Last run: {lastRunTime}ms
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runHealthChecks}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconRefresh className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800">{healthChecks.length}</div>
              <div className="text-sm text-gray-500">Total Checks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{successCount}</div>
              <div className="text-sm text-gray-500">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
              <div className="text-sm text-gray-500">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{errorCount}</div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
          </div>
        </div>

        {/* Health Checks */}
        <div className="p-6 space-y-3">
          {healthChecks.map((check, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 ${getStatusColor(check.status)} transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStatusIcon(check.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{check.name}</h3>
                    {check.responseTime !== undefined && (
                      <span className="text-xs text-gray-500 font-mono">
                        {check.responseTime}ms
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{check.message}</p>
                  {check.timestamp && (
                    <p className="text-xs text-gray-400 mt-2">
                      Checked at {new Date(check.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              System Status: {errorCount === 0 ? (
                <span className="font-semibold text-green-600">Healthy</span>
              ) : (
                <span className="font-semibold text-red-600">Issues Detected</span>
              )}
            </div>
            <div>
              Browser: {navigator.userAgent.split(' ').slice(-2).join(' ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
