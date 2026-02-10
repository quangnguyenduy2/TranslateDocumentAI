import React, { useState, useRef, useEffect, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
import { 
  IconUpload, 
  IconMarkdown, 
  IconExcel, 
  IconPptx,
  IconLoading, 
  IconSuccess, 
  IconError,
  IconDownload,
  IconLanguage,
  IconClose,
  IconChevronDown,
  IconChevronUp,
  IconTrash,
  IconBook,
  IconHistory,
  IconSettings,
  IconEye,
  IconSplit,
  IconPlus,
  IconSave,
  IconImport,
  IconSearch,
  IconEdit,
  IconImage,
  IconHelp,
  IconRefresh,
  IconShield,
  IconKey
} from './components/Icons';
import { TestDashboard } from './components/TestDashboard';
import { SystemHealthDashboard } from './components/SystemHealthDashboard';
import { AdminPage } from './components/AdminPage';
import { AuthModal } from './components/AuthModal';
import { GoogleCallback } from './components/GoogleCallback';
import { LoginPage } from './components/LoginPage';
import { AppStatus, FileType, SupportedLanguage, LogEntry, FileQueueItem, GlossaryItem, HistoryItem, BlacklistItem } from './types';
import { processMarkdown, processExcel, processExcelWithShapes, processImage, processPptx, getExcelSheetNames, getExcelPreview, parseGlossaryByColumns, parseBlacklistFromExcel, ExcelPreviewData, hasShapes } from './services/fileProcessing';
import { saveFileToDB, getFileFromDB } from './services/storage';
import apiClient, { authAPI, userDataAPI } from './services/apiClient';

const APP_VERSION = "1.3.0";
const APP_AUTHOR = "NDQuang2 ";

const App: React.FC = () => {
  // Handle Google OAuth callback route
  if (window.location.pathname === '/auth/callback') {
    return <GoogleCallback />;
  }

  const [globalStatus, setGlobalStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [sourceLang, setSourceLang] = useState<string>('auto'); // 'auto' or language code (vi, ja, en, ko, zh)
  const [targetLang, setTargetLang] = useState<SupportedLanguage>(SupportedLanguage.VIETNAMESE);
  const [skipAlreadyTranslated, setSkipAlreadyTranslated] = useState<boolean>(true); // Smart mode: skip cells already in target language
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  
  // New State Features
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  const [context, setContext] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Blacklist Protection
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [blacklistEnabled, setBlacklistEnabled] = useState<boolean>(true);
  
  // API Key Management (deprecated - now using backend auth)
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Modal States
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTestDashboard, setShowTestDashboard] = useState(false);
  const [showHealthDashboard, setShowHealthDashboard] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileQueueItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Driver.js Tour Logic - MUST be before conditional returns to follow Rules of Hooks
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps: [
        {
          element: '#tour-welcome',
          popover: {
            title: 'Chào mừng đến với DocuTranslate AI',
            description: 'Công cụ dịch tài liệu thông minh sử dụng Google Gemini AI. Hãy để chúng tôi hướng dẫn bạn qua các tính năng chính!',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#tour-lang',
          popover: {
            title: 'Ngôn ngữ đích',
            description: 'Chọn ngôn ngữ bạn muốn dịch tài liệu sang. Hỗ trợ 9 ngôn ngữ phổ biến nhất.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-glossary',
          popover: {
            title: 'Quản lý Thuật ngữ',
            description: 'Định nghĩa hoặc import các thuật ngữ chuyên ngành để đảm bảo bản dịch nhất quán và chính xác.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-context',
          popover: {
            title: 'Cài đặt Ngữ cảnh',
            description: 'Cung cấp thông tin nền để AI hiểu rõ lĩnh vực chuyên môn của bạn (y học, pháp lý, kỹ thuật...).',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-history',
          popover: {
            title: 'Lịch sử Dịch',
            description: 'Truy cập các file đã dịch gần đây (lưu trong 24 giờ). Tải lại bất cứ lúc nào!',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-upload',
          popover: {
            title: 'Tải lên Tài liệu',
            description: 'Kéo thả file vào đây hoặc click để chọn. Hỗ trợ Excel, Markdown, PowerPoint và Hình ảnh.',
            side: 'top',
            align: 'center'
          }
        }
      ],
      onDestroyStarted: () => {
        localStorage.setItem('d12_tour_seen', 'true');
        driverObj.destroy();
      }
    });

    driverObj.drive();
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data);
          
          // Fetch user's API key from backend
          try {
            const apiKeyResponse = await authAPI.getApiKey();
            if (apiKeyResponse.data.apiKey) {
              localStorage.setItem('user_api_key', apiKeyResponse.data.apiKey);
              setUserApiKey(apiKeyResponse.data.apiKey);
            } else {
              // No API key set, show warning
              setShowApiKeyModal(true);
            }
          } catch (error) {
            console.error('Failed to fetch API key:', error);
            setShowApiKeyModal(true);
          }
        } catch (error) {
          // Token expired or invalid, clear it
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user_api_key');
          setUser(null);
        }
      }
      setIsAuthenticating(false);
    };
    checkAuth();
  }, []);

  // Load History & Glossary from Backend
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        // 1. Load Glossary from backend
        const glossaryResponse = await userDataAPI.getGlossary();
        setGlossary(glossaryResponse.data.map((item: any) => ({
          id: item.id,
          term: item.term,
          translation: item.translation,
        })));
      } catch (e) {
        console.error("Failed to load glossary from backend", e);
      }

      try {
        // 2. Load Blacklist from backend
        const blacklistResponse = await userDataAPI.getBlacklist();
        setBlacklist(blacklistResponse.data.map((item: any) => ({
          id: item.id,
          term: item.term,
          caseSensitive: item.caseSensitive,
          enabled: item.enabled,
        })));
      } catch (e) {
        console.error("Failed to load blacklist from backend", e);
      }

      try {
        // 3. Load Preferences (context, blacklistEnabled)
        const prefResponse = await userDataAPI.getPreferences();
        setContext(prefResponse.data.context || '');
        setBlacklistEnabled(prefResponse.data.blacklistEnabled ?? true);
      } catch (e) {
        console.error("Failed to load preferences from backend", e);
      }

      try {
        // 4. Load History from backend
        const historyResponse = await userDataAPI.getHistory();
        const historyItems = historyResponse.data.map((item: any) => ({
          id: item.id,
          fileName: item.fileName,
          fileType: item.fileType,
          targetLang: item.targetLang,
          timestamp: item.timestamp,
        }));
        setHistory(historyItems);
      } catch (e) {
        console.error("Failed to load history from backend", e);
      }

      // 5. Check Tour Status - Auto start for first-time users
      const hasSeenTour = localStorage.getItem('d12_tour_seen');
      if (!hasSeenTour) {
        setTimeout(() => startTour(), 1500);
      }
    };
    loadData();

    // Keyboard shortcut for Test Dashboard: Ctrl+Shift+T
    // Keyboard shortcut for Health Dashboard: Ctrl+Shift+H
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShowTestDashboard(true);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        setShowHealthDashboard(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, startTour]);

  // Effect to load Excel sheets
  useEffect(() => {
    const loadSheets = async () => {
      const unprocessedExcels = queue.filter(
        item => item.type === FileType.EXCEL && item.availableSheets.length === 0 && item.status === AppStatus.IDLE
      );
      if (unprocessedExcels.length === 0) return;

      for (const item of unprocessedExcels) {
        try {
          const names = await getExcelSheetNames(item.file);
          setQueue(prev => prev.map(q => {
            if (q.id === item.id) {
              // Don't pre-select any sheets, let user choose
              return { ...q, availableSheets: names, selectedSheets: [], isExpanded: false };
            }
            return q;
          }));
          addLog(`Loaded ${names.length} sheets for ${item.file.name}`, 'info');
        } catch (e) {
          console.error(e);
          addLog(`Failed to load sheets for ${item.file.name}`, 'error');
        }
      }
    };
    loadSheets();
  }, [queue]);

  // Add log helper - must be before conditional returns
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36), message, timestamp: new Date(), type }]);
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user_api_key');
    setUser(null);
    setUserApiKey('');
  };

  // Show loading screen while authenticating
  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl flex items-center gap-3">
          <IconLoading className="w-6 h-6 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage onLoginSuccess={(userData) => setUser(userData)} />;
  }

  const handleSaveGlossary = async (newGlossary: GlossaryItem[]) => {
    setGlossary(newGlossary);
    try {
      await userDataAPI.saveGlossary(newGlossary.map(item => ({
        term: item.term,
        translation: item.translation,
      })));
    } catch (e) {
      console.error("Failed to save glossary to backend", e);
    }
  };

  const updateHistory = async (newItem: HistoryItem) => {
    try {
      await userDataAPI.addHistoryItem({
        fileName: newItem.fileName,
        fileType: newItem.fileType,
        targetLang: newItem.targetLang,
        timestamp: newItem.timestamp,
      });
      
      setHistory(prev => [newItem, ...prev]);
    } catch (e) {
      console.error("Failed to save history item to backend", e);
    }
  };

  // Helper function to get detailed error message
  const getDetailedErrorMessage = (error: any): { message: string; details: string } => {
    if (!error) return { message: 'Unknown error occurred', details: 'No error information available' };
    
    // Parse error using helper function
    const errorData = parseError(error);
    
    // If we have an error code (and it's not 200), use API's message directly
    if (errorData.code && errorData.code !== 200) {
      return { 
        message: `API Error ${errorData.code}`, 
        details: errorData.message || 'An API error occurred during translation' 
      };
    }
    
    // Fallback: pattern matching on error message for non-API errors
    const errorMsg = errorData.message;
    
    // Network errors
    if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
      return { 
        message: 'Network Connection Error', 
        details: 'Cannot connect to translation service. Please check your internet connection.' 
      };
    }
    
    // File parsing errors
    if (errorMsg.includes('parse') || errorMsg.includes('invalid') || errorMsg.includes('corrupt')) {
      return { 
        message: 'File Processing Error', 
        details: 'Cannot read file content. The file may be corrupted or in an unsupported format.' 
      };
    }
    
    // Timeout errors
    if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
      return { 
        message: 'Request Timeout', 
        details: 'Translation took too long. Try with a smaller file or retry.' 
      };
    }
    
    // Generic error
    return { 
      message: 'Translation Error', 
      details: errorMsg || 'An unexpected error occurred during translation' 
    };
  };


  // Parse error properly and use API's message directly
  const parseError = (error: any) => {
    // Gemini API error format
    if (error?.error?.code) {
      return {
        code: error.error.code,
        message: error.error.message || 'Unknown API error',
        status: error.error.status
      };
    }
    
    // Standard Error object
    if (error instanceof Error) {
      return { code: null, message: error.message, status: null };
    }
    
    return { code: null, message: String(error), status: null };
  };

  const getFileType = (fileName: string): FileType => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.txt')) return FileType.MARKDOWN;
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return FileType.EXCEL;
    if (lower.endsWith('.pptx')) return FileType.PPTX;
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return FileType.IMAGE;
    return FileType.UNKNOWN;
  };

  const handleFilesAdded = async (fileList: FileList | null) => {
    if (!fileList) return;
    const newItems: FileQueueItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const type = getFileType(file.name);
      
      if (type === FileType.UNKNOWN) {
        addLog(`Skipped unsupported file: ${file.name}`, 'error');
        continue;
      }
      if (queue.some(q => q.file.name === file.name && q.file.size === file.size)) {
        addLog(`Skipped duplicate file: ${file.name}`, 'info');
        continue;
      }

      // Pre-read text for Markdown/Text preview
      let originalText = '';
      if (type === FileType.MARKDOWN) {
        originalText = await file.text();
      }

      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        type,
        status: AppStatus.IDLE,
        progress: 0,
        availableSheets: [],
        selectedSheets: [],
        isExpanded: false,
        originalText
      });
    }

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
      if (globalStatus === AppStatus.COMPLETED) {
        setGlobalStatus(AppStatus.IDLE);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesAdded(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const removeFile = (id: string) => {
    setQueue(prev => {
      const newQueue = prev.filter(item => item.id !== id);
      if (newQueue.length === 0) {
        setGlobalStatus(AppStatus.IDLE);
        setLogs([]);
      }
      return newQueue;
    });
  };

  const retryFile = async (id: string) => {
    const item = queue.find(q => q.id === id);
    if (!item) return;
    
    // Reset item status to IDLE
    setQueue(prev => prev.map(q => q.id === id ? {
      ...q,
      status: AppStatus.IDLE,
      errorMessage: undefined,
      errorDetails: undefined,
      progressMessage: 'Ready to retry',
      progress: 0
    } : q));
    
    addLog(`Retrying ${item.file.name}...`, 'info');
    
    // Auto-start translation for this file
    setTimeout(() => {
      processQueue();
    }, 500);
  };

  const clearAll = () => {
    setQueue([]);
    setGlobalStatus(AppStatus.IDLE);
    setLogs([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSheet = (itemId: string, sheetName: string) => {
    setQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        const isSelected = item.selectedSheets.includes(sheetName);
        const newSheets = isSelected 
          ? item.selectedSheets.filter(s => s !== sheetName)
          : [...item.selectedSheets, sheetName];
        return { ...item, selectedSheets: newSheets };
      }
      return item;
    }));
  };

  const selectAllSheets = (itemId: string) => {
    setQueue(prev => prev.map(item => item.id === itemId ? { ...item, selectedSheets: [...item.availableSheets] } : item));
  };

  const deselectAllSheets = (itemId: string) => {
    setQueue(prev => prev.map(item => item.id === itemId ? { ...item, selectedSheets: [] } : item));
  };

  const toggleExpand = (itemId: string) => {
    setQueue(prev => prev.map(item => item.id === itemId ? { ...item, isExpanded: !item.isExpanded } : item));
  };

  const processQueue = async () => {
    const itemsToProcess = queue.filter(item => item.status === AppStatus.IDLE || item.status === AppStatus.ERROR);
    if (itemsToProcess.length === 0) return;

    // Check if user has API key set
    const apiKey = localStorage.getItem('user_api_key');
    if (!apiKey) {
      addLog('⚠️ No API key configured! Please set your Gemini API key in settings.', 'error');
      setShowApiKeyModal(true);
      return;
    }

    // Check if any Excel file has more than 5 sheets selected
    for (const item of itemsToProcess) {
      if (item.type === FileType.EXCEL && item.selectedSheets.length > 5) {
        addLog(`Error: ${item.file.name} has ${item.selectedSheets.length} sheets selected. Maximum 5 sheets allowed.`, 'error');
        alert(`Cannot translate ${item.file.name}:\n\nYou have selected ${item.selectedSheets.length} sheets, but the maximum allowed is 5 sheets.\n\nPlease deselect some sheets and try again.`);
        return;
      }
    }

    setGlobalStatus(AppStatus.TRANSLATING);
    addLog(`Starting batch translation of ${itemsToProcess.length} files...`);

    for (const item of itemsToProcess) {
      if (item.type === FileType.EXCEL && item.selectedSheets.length === 0) {
         addLog(`Skipping ${item.file.name}: No sheets selected.`, 'error');
         continue;
      }

      setQueue(prev => prev.map(q => q.id === item.id ? { 
        ...q, status: AppStatus.TRANSLATING, progressMessage: 'Starting...', progress: 0
      } : q));

      try {
        let resultBlob: Blob;
        let translatedTextStr: string | undefined;
        
        const updateProgress = (msg: string, percent: number = 0) => {
           setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progressMessage: msg, progress: percent } : q));
        };

        if (item.type === FileType.MARKDOWN) {
          const res = await processMarkdown(item.originalText || '', targetLang, context, glossary, updateProgress);
          resultBlob = res.blob;
          translatedTextStr = res.translatedText;
        } else if (item.type === FileType.IMAGE) {
          const res = await processImage(item.file, targetLang, context, glossary, updateProgress);
          resultBlob = res.blob;
          translatedTextStr = res.translatedText;
        } else if (item.type === FileType.PPTX) {
          resultBlob = await processPptx(item.file, targetLang, context, glossary, updateProgress);
        } else {
          // Smart detection: Check if file has shapes/flowcharts
          const arrayBuffer = await item.file.arrayBuffer();
          const fileHasShapes = await hasShapes(arrayBuffer);
          
          const activeBlacklist = blacklistEnabled ? blacklist : [];
          
          if (fileHasShapes) {
            // Use xlsx-populate + JSZip processor (slower but handles shapes)
            updateProgress('Detected shapes/flowcharts - using advanced processor...', 5);
            resultBlob = await processExcelWithShapes(
              arrayBuffer, 
              targetLang, 
              item.selectedSheets, 
              context, 
              glossary, 
              updateProgress, 
              skipAlreadyTranslated, 
              sourceLang, 
              activeBlacklist
            );
          } else {
            // Use fast ExcelJS processor (no shapes)
            updateProgress('No shapes detected - using fast processor...', 5);
            resultBlob = await processExcel(
              arrayBuffer, 
              targetLang, 
              item.selectedSheets, 
              context, 
              glossary, 
              updateProgress, 
              skipAlreadyTranslated, 
              sourceLang, 
              activeBlacklist
            );
          }
        }

        const url = URL.createObjectURL(resultBlob);
        
        // Update Queue
        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: AppStatus.COMPLETED, 
          progressMessage: 'Done', 
          progress: 100,
          resultBlob: resultBlob,
          downloadUrl: url,
          translatedText: translatedTextStr
        } : q));

        // Add to History (Async)
        await updateHistory({
          id: item.id,
          fileName: item.file.name,
          fileType: item.type,
          targetLang: targetLang,
          timestamp: Date.now(),
          downloadUrl: url,
          blob: resultBlob
        });
        
        addLog(`Successfully translated ${item.file.name}`, 'success');

      } catch (error) {
        console.error('Translation error:', error);
        const errorInfo = getDetailedErrorMessage(error);
        
        // Update current item status to ERROR
        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: AppStatus.ERROR, 
          errorMessage: errorInfo.message,
          errorDetails: errorInfo.details,
          progressMessage: 'Failed'
        } : q));
        addLog(`${errorInfo.message}: ${item.file.name} - ${errorInfo.details}`, 'error');
        
        // Check if this is a critical error (quota exhausted, auth failure, etc.)
        const errorData = parseError(error);
        const isCriticalError = errorData.code === 429 || errorData.code === 401 || errorData.code === 403;
        
        if (isCriticalError) {
          console.error('🛑 CRITICAL ERROR DETECTED - Stopping all processing');
          setGlobalStatus(AppStatus.ERROR);
          addLog('⛔ Processing stopped due to critical API error', 'error');
          return; // Stop processing remaining files
        }
      }
    }

    setGlobalStatus(AppStatus.COMPLETED);
    addLog('Batch processing finished.', 'success');
  };

  // --- GLOSSARY MODAL (Updated for Import Wizard) ---

  const GlossaryModal = () => {
    const [term, setTerm] = useState('');
    const [translation, setTranslation] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const glossaryFileRef = useRef<HTMLInputElement>(null);
    const [importLoading, setImportLoading] = useState(false);
    
    // Import Wizard State
    const [importFile, setImportFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ExcelPreviewData | null>(null);
    const [sourceCol, setSourceCol] = useState<number>(-1);
    const [targetCol, setTargetCol] = useState<number>(-1);
    const [importStep, setImportStep] = useState<'upload' | 'mapping'>('upload');

    const handleSaveTerm = async () => {
      if (!term || !translation) return;

      let newGlossary = [];
      if (editingId) {
        newGlossary = glossary.map(g => g.id === editingId ? { ...g, term, translation } : g);
        setEditingId(null);
        addLog('Term updated.', 'success');
      } else {
        if (glossary.some(g => g.term.toLowerCase() === term.toLowerCase())) {
          addLog('Term already exists.', 'error');
          return;
        }
        newGlossary = [...glossary, { id: Math.random().toString(36), term, translation }];
        addLog('Term added.', 'success');
      }
      await handleSaveGlossary(newGlossary);
      setTerm('');
      setTranslation('');
    };

    const startEdit = (item: GlossaryItem) => {
      setTerm(item.term);
      setTranslation(item.translation);
      setEditingId(item.id);
    };

    const cancelEdit = () => {
      setTerm('');
      setTranslation('');
      setEditingId(null);
    };

    const removeTerm = async (id: string) => {
      if (editingId === id) cancelEdit();
      const newGlossary = glossary.filter(g => g.id !== id);
      await handleSaveGlossary(newGlossary);
    };

    const clearGlossary = async () => {
      if (window.confirm("Are you sure you want to delete ALL glossary terms? This cannot be undone.")) {
        await clearGlossaryDB();
        setGlossary([]);
        addLog('Glossary cleared.', 'info');
      }
    };

    // Step 1: Select File
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        setImportFile(file);
        setImportLoading(true);
        try {
          const preview = await getExcelPreview(file);
          setPreviewData(preview);
          setImportStep('mapping');
          // Auto-guess columns
          const headers = preview.headers.map(h => h.toLowerCase());
          const guessSource = headers.findIndex(h => h.includes('japanese') || h.includes('source') || h.includes('term'));
          const guessTarget = headers.findIndex(h => h.includes('vietnamese') || h.includes('target') || h.includes('trans'));
          if (guessSource >= 0) setSourceCol(guessSource);
          if (guessTarget >= 0) setTargetCol(guessTarget);
        } catch (err) {
          console.error(err);
          addLog('Failed to read Excel file.', 'error');
        } finally {
          setImportLoading(false);
        }
      }
      if (glossaryFileRef.current) glossaryFileRef.current.value = '';
    };

    // Step 2: Confirm Mapping & Save
    const handleConfirmImport = async () => {
      if (!importFile || sourceCol === -1 || targetCol === -1) {
        addLog("Please select both Source and Target columns.", 'error');
        return;
      }
      
      setImportLoading(true);
      try {
        const items = await parseGlossaryByColumns(importFile, sourceCol, targetCol);
        
        // Merge Logic: Overwrite duplicates or Append? 
        // Strategy: Append, but remove old items if term exists to avoid duplicates
        const newTermsMap = new Map();
        items.forEach(i => newTermsMap.set(i.term.toLowerCase(), i));
        
        const existingGlossary = [...glossary];
        // Remove existing items that are in the new import (overwrite behavior)
        const finalGlossary = existingGlossary.filter(g => !newTermsMap.has(g.term.toLowerCase()));
        
        const mergedList = [...finalGlossary, ...items];
        
        await handleSaveGlossary(mergedList);
        addLog(`Imported ${items.length} terms successfully.`, 'success');
        
        // Reset Import UI
        setImportStep('upload');
        setImportFile(null);
        setPreviewData(null);
      } catch (err) {
        console.error(err);
        addLog('Failed to process import.', 'error');
      } finally {
        setImportLoading(false);
      }
    };

    const filteredGlossary = glossary.filter(g => 
      g.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.translation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!showGlossaryModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2"><IconBook className="w-5 h-5 text-blue-400"/> Glossary Management</h3>
            <button onClick={() => setShowGlossaryModal(false)}><IconClose className="text-slate-400 hover:text-white" /></button>
          </div>
          
          <div className="p-4 flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
            
            {/* LEFT PANEL: INPUT / SEARCH / LIST */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden border-r border-slate-700/50 pr-4">
               {/* Input Form */}
              <div className="flex gap-2 items-center bg-slate-700/20 p-2 rounded border border-slate-700/50">
                <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Term (Source)" className="bg-slate-900 border border-slate-700 rounded p-2 flex-1 text-sm outline-none focus:border-blue-500" />
                <input value={translation} onChange={e => setTranslation(e.target.value)} placeholder="Translation" className="bg-slate-900 border border-slate-700 rounded p-2 flex-1 text-sm outline-none focus:border-blue-500" />
                <button onClick={handleSaveTerm} className={`${editingId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'} p-2 rounded text-white transition-colors`} title={editingId ? "Update" : "Add"}>
                   {editingId ? <IconSave className="w-5 h-5" /> : <IconPlus className="w-5 h-5" />}
                </button>
                {editingId && (
                  <button onClick={cancelEdit} className="bg-slate-600 hover:bg-slate-500 p-2 rounded text-white" title="Cancel"><IconClose className="w-5 h-5" /></button>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                 <IconSearch className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                 <input 
                   value={searchTerm} 
                   onChange={e => setSearchTerm(e.target.value)} 
                   placeholder="Search..." 
                   className="w-full bg-slate-900 border border-slate-700 rounded pl-9 p-2 text-sm outline-none focus:border-blue-500"
                 />
              </div>
              
              {/* List */}
              <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar min-h-[200px] border border-slate-700/50 rounded p-2 bg-slate-900/30">
                {glossary.length === 0 ? <p className="text-slate-500 text-sm italic text-center mt-8">No terms. Import or add one.</p> : 
                  filteredGlossary.length === 0 ? <p className="text-slate-500 text-sm italic text-center mt-8">No matches.</p> :
                  filteredGlossary.map(g => (
                    <div key={g.id} className={`flex justify-between items-center bg-slate-700/50 p-2 rounded text-sm group ${editingId === g.id ? 'border border-orange-500/50 bg-orange-900/10' : ''}`}>
                      <div className="flex-1 break-words mr-2"><span className="text-blue-300 font-medium">{g.term}</span> <span className="text-slate-500 mx-2">→</span> <span className="text-green-300">{g.translation}</span></div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => startEdit(g)} className="text-slate-400 hover:text-orange-400 p-1"><IconEdit className="w-3.5 h-3.5" /></button>
                         <button onClick={() => removeTerm(g.id)} className="text-slate-400 hover:text-red-400 p-1"><IconTrash className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))
                }
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                 <span>Total: {glossary.length} terms</span>
                 {glossary.length > 0 && <button onClick={clearGlossary} className="text-red-400 hover:underline">Delete All</button>}
              </div>
            </div>

            {/* RIGHT PANEL: IMPORT WIZARD */}
            <div className="w-full md:w-[450px] flex flex-col gap-4 bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
               <h4 className="font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2">
                 <IconExcel className="w-5 h-5 text-green-400" /> 
                 Bulk Import Wizard
               </h4>

               {importStep === 'upload' && (
                 <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-lg hover:bg-slate-800/50 transition-colors p-8 cursor-pointer" onClick={() => glossaryFileRef.current?.click()}>
                    <input type="file" accept=".xlsx" ref={glossaryFileRef} className="hidden" onChange={handleFileSelect} />
                    {importLoading ? <IconLoading className="w-8 h-8 text-blue-400 mb-2" /> : <IconImport className="w-8 h-8 text-slate-500 mb-2" />}
                    <p className="text-sm font-medium text-slate-300">Click to upload Excel</p>
                    <p className="text-xs text-slate-500 text-center mt-1">Supports large files (10k+ rows)<br/>Row 1 must be headers.</p>
                 </div>
               )}

               {importStep === 'mapping' && previewData && (
                 <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center">
                       <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">File: {importFile?.name}</span>
                       <button onClick={() => { setImportStep('upload'); setImportFile(null); }} className="text-xs text-blue-400 hover:underline">Change File</button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Column for <b>Term</b> (Source):</label>
                        <select value={sourceCol} onChange={e => setSourceCol(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white">
                           <option value={-1}>-- Select Column --</option>
                           {previewData.headers.map((h, idx) => (
                             <option key={idx} value={idx}>{h}</option>
                           ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Column for <b>Translation</b> (Target):</label>
                        <select value={targetCol} onChange={e => setTargetCol(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white">
                           <option value={-1}>-- Select Column --</option>
                           {previewData.headers.map((h, idx) => (
                             <option key={idx} value={idx}>{h}</option>
                           ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto border border-slate-700 rounded bg-slate-900">
                       <table className="w-full text-left text-xs text-slate-300">
                         <thead className="bg-slate-800 text-slate-400 font-medium sticky top-0">
                           <tr>
                             {previewData.headers.map((h, i) => (
                               <th key={i} className={`p-2 border-b border-slate-700 whitespace-nowrap ${i === sourceCol ? 'bg-blue-900/30 text-blue-300' : ''} ${i === targetCol ? 'bg-green-900/30 text-green-300' : ''}`}>
                                 {h}
                               </th>
                             ))}
                           </tr>
                         </thead>
                         <tbody>
                           {previewData.sampleRows.map((row, rIdx) => (
                             <tr key={rIdx} className="border-b border-slate-800 last:border-0">
                               {row.map((cell, cIdx) => (
                                 <td key={cIdx} className={`p-2 truncate max-w-[100px] ${cIdx === sourceCol ? 'bg-blue-900/10' : ''} ${cIdx === targetCol ? 'bg-green-900/10' : ''}`}>
                                   {cell}
                                 </td>
                               ))}
                             </tr>
                           ))}
                         </tbody>
                       </table>
                       {previewData.totalRowsEstimate > 6 && (
                         <div className="p-2 text-center text-[10px] text-slate-500 italic bg-slate-800/50">
                           + approx {previewData.totalRowsEstimate - 6} more rows
                         </div>
                       )}
                    </div>

                    <button 
                      onClick={handleConfirmImport} 
                      disabled={importLoading || sourceCol === -1 || targetCol === -1}
                      className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      {importLoading ? <IconLoading className="w-4 h-4" /> : <IconImport className="w-4 h-4" />}
                      Process Import
                    </button>
                 </div>
               )}
            </div>

          </div>
        </div>
      </div>
    );
  };

  const ContextModal = () => {
    if (!showContextModal) return null;
    
    const handleSaveContext = async () => {
      try {
        await userDataAPI.updatePreferences({ context });
        setShowContextModal(false);
      } catch (e) {
        console.error('Failed to save context', e);
      }
    };
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2"><IconSettings className="w-5 h-5 text-blue-400"/> Context Setting</h3>
            <button onClick={() => setShowContextModal(false)}><IconClose className="text-slate-400 hover:text-white" /></button>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-sm text-slate-400">Provide context about the documents to improve translation accuracy (e.g., "Technical documentation for a software product").</p>
            <textarea 
              value={context} 
              onChange={e => setContext(e.target.value)} 
              className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-3 text-sm text-slate-200 outline-none focus:border-blue-500 resize-none"
              placeholder="Enter context here..."
            />
          </div>
          <div className="p-4 border-t border-slate-700 text-right">
             <button onClick={handleSaveContext} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm text-white">Save Context</button>
          </div>
        </div>
      </div>
    );
  };

  const HistoryModal = () => {
    if (!showHistoryModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2"><IconHistory className="w-5 h-5 text-purple-400"/> History (Last 24h)</h3>
            <button onClick={() => setShowHistoryModal(false)}><IconClose className="text-slate-400 hover:text-white" /></button>
          </div>
          <div className="p-4 overflow-y-auto flex-1 custom-scrollbar space-y-2">
             {history.length === 0 ? <p className="text-slate-500 text-center py-8">No history available yet.</p> :
               history.map(h => (
                 <div key={h.id} className="flex items-center justify-between bg-slate-700/30 p-3 rounded border border-slate-700/50">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center">
                          {h.fileType === FileType.EXCEL ? <IconExcel className="w-4 h-4 text-green-400" /> : 
                           h.fileType === FileType.IMAGE ? <IconImage className="w-4 h-4 text-orange-400" /> :
                           h.fileType === FileType.PPTX ? <IconPptx className="w-4 h-4 text-orange-500" /> :
                           <IconMarkdown className="w-4 h-4 text-blue-400" />}
                       </div>
                       <div>
                          <div className="text-sm font-medium text-white">{h.fileName}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(h.timestamp).toLocaleTimeString()} • {h.targetLang}
                          </div>
                       </div>
                    </div>
                    {h.downloadUrl ? (
                      <a href={h.downloadUrl} download={`translated_${h.targetLang}_${h.fileName}${h.fileType === FileType.IMAGE ? '.md' : ''}`} className="p-2 hover:bg-slate-600 rounded text-green-400"><IconDownload className="w-4 h-4" /></a>
                    ) : (
                      <span className="text-xs text-red-400 italic px-2">Expired</span>
                    )}
                 </div>
               ))
             }
          </div>
        </div>
      </div>
    );
  };

  const ApiKeyModal = () => {
    const [inputKey, setInputKey] = useState(userApiKey || '');
    const [saving, setSaving] = useState(false);
    
    const handleSaveApiKey = async (key: string) => {
      const trimmedKey = key.trim();
      setSaving(true);
      
      try {
        if (trimmedKey) {
          // Save to backend
          await authAPI.updateApiKey(trimmedKey);
          localStorage.setItem('user_api_key', trimmedKey);
          setUserApiKey(trimmedKey);
          addLog('API key saved successfully!', 'success');
        } else {
          // Clear from backend
          await authAPI.updateApiKey('');
          localStorage.removeItem('user_api_key');
          setUserApiKey('');
          addLog('API key removed! Backend will not use any key.', 'success');
        }
        setShowApiKeyModal(false);
      } catch (error) {
        addLog('Failed to save API key to backend', 'error');
        console.error('API key save error:', error);
      } finally {
        setSaving(false);
      }
    };

    if (!showApiKeyModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <IconKey className="w-5 h-5 text-yellow-400" />
                API Key Settings
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {userApiKey ? '🔑 Using your personal API key' : '🌐 Using default API key'}
              </p>
            </div>
            <button onClick={() => setShowApiKeyModal(false)}>
              <IconClose className="text-slate-400 hover:text-white" />
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            <div>
              <label className="text-sm text-slate-300 block mb-2 font-medium">
                Your Gemini API Key (Optional)
              </label>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-xs text-slate-500 mt-2">
                Leave empty to use default key. Get your free key at:{' '}
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Google AI Studio ↗
                </a>
              </p>
            </div>
            
            {userApiKey && (
              <div className="bg-green-900/20 border border-green-500/30 rounded p-3 text-xs text-green-300 flex items-start gap-2">
                <span>✓</span>
                <div>
                  <div className="font-medium">Custom API key is active</div>
                  <div className="text-green-400/70 mt-1">
                    Key: {userApiKey.substring(0, 8)}...{userApiKey.substring(userApiKey.length - 4)}
                  </div>
                </div>
              </div>
            )}
            
            {!userApiKey && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3 text-xs text-blue-300">
                ℹ️ Currently using the default API key (shared with other users)
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-700 flex gap-2 justify-between">
            <button
              onClick={() => {
                if (confirm('Clear API key from storage? This will reload the page and use the default key.')) {
                  localStorage.removeItem('user_api_key');
                  setUserApiKey('');
                  addLog('API key cleared from storage', 'success');
                  setTimeout(() => window.location.reload(), 500);
                }
              }}
              className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/50 rounded text-sm text-orange-300 transition-colors flex items-center gap-2"
              title="Clear API key without reloading (useful if key is invalid)"
            >
              <IconTrash className="w-3 h-3" />
              Clear Storage
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              {userApiKey && (
                <button
                  onClick={() => handleSaveApiKey('')}
                  className="px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded text-sm text-white transition-colors disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Removing...' : 'Remove Key'}
                </button>
              )}
              <button
                onClick={() => handleSaveApiKey(inputKey)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                disabled={saving}
              >
                {saving && <IconLoading className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const BlacklistModal = () => {
    const [term, setTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    
    // Import wizard states
    const [importStep, setImportStep] = useState<'upload' | 'mapping'>('upload');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [previewData, setPreviewData] = useState<ExcelPreviewData | null>(null);
    const [termColIndex, setTermColIndex] = useState(-1);
    const blacklistFileRef = useRef<HTMLInputElement>(null);

    const handleSaveTerm = async () => {
      if (!term.trim()) return;
      
      let updatedBlacklist = blacklist;
      
      if (editingId) {
        updatedBlacklist = blacklist.map(b => b.id === editingId ? { ...b, term: term.trim(), caseSensitive } : b);
        setBlacklist(updatedBlacklist);
        setEditingId(null);
      } else {
        const newItem: BlacklistItem = {
          id: Math.random().toString(36).substr(2, 9),
          term: term.trim(),
          caseSensitive,
          enabled: true,
          isDefault: false // Mark as user's personal item
        };
        updatedBlacklist = [...blacklist, newItem];
        setBlacklist(updatedBlacklist);
      }
      
      setTerm('');
      setCaseSensitive(false);
      
      try {
        // Only save user's personal blacklist (filter out default items)
        const userBlacklist = updatedBlacklist.filter(b => !b.isDefault);
        await userDataAPI.saveBlacklist(userBlacklist.map(b => ({
          term: b.term,
          caseSensitive: b.caseSensitive,
          enabled: b.enabled,
        })));
      } catch (e) {
        console.error('Failed to save blacklist', e);
      }
    };

    const removeTerm = async (id: string) => {
      const item = blacklist.find(b => b.id === id);
      if (item?.isDefault) {
        alert('⚠️ Cannot delete admin blacklist terms (managed by admin only)');
        return;
      }
      
      const updated = blacklist.filter(b => b.id !== id);
      setBlacklist(updated);
      try {
        // Only save user's personal blacklist (filter out default items)
        const userBlacklist = updated.filter(b => !b.isDefault);
        await userDataAPI.saveBlacklist(userBlacklist.map(b => ({
          term: b.term,
          caseSensitive: b.caseSensitive,
          enabled: b.enabled,
        })));
      } catch (e) {
        console.error('Failed to update blacklist', e);
      }
    };

    const toggleEnabled = async (id: string) => {
      // Find the item to check if it's a default (admin) item
      const item = blacklist.find(b => b.id === id);
      if (item?.isDefault) {
        alert('⚠️ Cannot disable admin blacklist terms (company security policy)');
        return;
      }
      
      const updated = blacklist.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b);
      setBlacklist(updated);
      try {
        // Only save user's personal blacklist (filter out default items)
        const userBlacklist = updated.filter(b => !b.isDefault);
        await userDataAPI.saveBlacklist(userBlacklist.map(b => ({
          term: b.term,
          caseSensitive: b.caseSensitive,
          enabled: b.enabled,
        })));
      } catch (e) {
        console.error('Failed to update blacklist', e);
      }
    };

    const startEdit = (item: BlacklistItem) => {
      if (item.isDefault) {
        alert('⚠️ Cannot edit admin blacklist terms (managed by admin only)');
        return;
      }
      setEditingId(item.id);
      setTerm(item.term);
      setCaseSensitive(item.caseSensitive || false);
    };

    const cancelEdit = () => {
      setEditingId(null);
      setTerm('');
      setCaseSensitive(false);
    };

    const clearBlacklistData = async () => {
      const userTermsCount = blacklist.filter(b => !b.isDefault).length;
      if (userTermsCount === 0) {
        alert('No personal terms to delete (admin terms cannot be deleted)');
        return;
      }
      
      if (!confirm(`Delete all ${userTermsCount} of YOUR protected terms? Admin terms will remain. This cannot be undone.`)) return;
      
      // Keep only admin terms
      const adminTerms = blacklist.filter(b => b.isDefault);
      setBlacklist(adminTerms);
      
      try {
        await clearBlacklistDB(); // Clear user's blacklist from DB
      } catch (e) {
        console.error('Failed to clear blacklist', e);
      }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setImportFile(file);
      setImportLoading(true);
      
      try {
        const preview = await getExcelPreview(file);
        setPreviewData(preview);
        setImportStep('mapping');
        setTermColIndex(-1);
      } catch (error) {
        console.error('Failed to parse Excel:', error);
        alert('Failed to read Excel file. Please check the format.');
      } finally {
        setImportLoading(false);
      }
    };

    const handleConfirmImport = async () => {
      if (!importFile || termColIndex === -1) return;
      
      setImportLoading(true);
      try {
        const items = await parseBlacklistFromExcel(importFile, termColIndex);
        // Mark imported items as user's personal items
        const userItems = items.map(item => ({ ...item, isDefault: false }));
        const updatedBlacklist = [...blacklist, ...userItems];
        setBlacklist(updatedBlacklist);
        
        // Only save user's personal blacklist (filter out default items)
        const userBlacklist = updatedBlacklist.filter(b => !b.isDefault);
        await userDataAPI.saveBlacklist(userBlacklist.map(b => ({
          term: b.term,
          caseSensitive: b.caseSensitive,
          enabled: b.enabled,
        })));
        alert(`Imported ${items.length} protected terms!`);
        setImportStep('upload');
        setImportFile(null);
        setPreviewData(null);
      } catch (error) {
        console.error('Import failed:', error);
        alert('Import failed. Please check the file format.');
      } finally {
        setImportLoading(false);
      }
    };

    const filteredBlacklist = blacklist.filter(b => 
      b.term.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!showBlacklistModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <IconShield className="w-5 h-5 text-red-400"/> 
              Blacklist Protection
            </h3>
            <button onClick={() => setShowBlacklistModal(false)}>
              <IconClose className="text-slate-400 hover:text-white" />
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
            
            {/* LEFT PANEL: INPUT / LIST */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden border-r border-slate-700/50 pr-4">
              {/* Input Form */}
              <div className="flex flex-col gap-2 bg-slate-700/20 p-3 rounded border border-slate-700/50">
                <input 
                  value={term} 
                  onChange={e => setTerm(e.target.value)} 
                  placeholder="Protected term (e.g., Project X, john@email.com)" 
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-sm outline-none focus:border-red-500" 
                />
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input 
                    type="checkbox" 
                    checked={caseSensitive} 
                    onChange={e => setCaseSensitive(e.target.checked)}
                    className="w-3 h-3 rounded"
                  />
                  Case sensitive
                </label>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveTerm} 
                    className={`flex-1 ${editingId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-red-600 hover:bg-red-500'} p-2 rounded text-white text-sm transition-colors flex items-center justify-center gap-2`}
                  >
                    {editingId ? <><IconSave className="w-4 h-4" /> Update</> : <><IconPlus className="w-4 h-4" /> Add Term</>}
                  </button>
                  {editingId && (
                    <button onClick={cancelEdit} className="bg-slate-600 hover:bg-slate-500 p-2 rounded text-white">
                      <IconClose className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <IconSearch className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  placeholder="Search..." 
                  className="w-full bg-slate-900 border border-slate-700 rounded pl-9 p-2 text-sm outline-none focus:border-red-500"
                />
              </div>
              
              {/* List */}
              <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar min-h-[200px] border border-slate-700/50 rounded p-2 bg-slate-900/30">
                {blacklist.length === 0 ? 
                  <p className="text-slate-500 text-sm italic text-center mt-8">No protected terms. Add one or import from Excel.</p> : 
                  filteredBlacklist.length === 0 ? 
                  <p className="text-slate-500 text-sm italic text-center mt-8">No matches.</p> :
                  filteredBlacklist.map(b => (
                    <div key={b.id} className={`flex justify-between items-center p-2 rounded text-sm group ${editingId === b.id ? 'border border-orange-500/50 bg-orange-900/10' : b.isDefault ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-slate-700/50'}`}>
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="checkbox" 
                          checked={b.enabled !== false} 
                          onChange={() => toggleEnabled(b.id)}
                          disabled={b.isDefault}
                          className={`w-4 h-4 rounded ${b.isDefault ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={b.isDefault ? 'Admin term - cannot be disabled' : 'Toggle protection'}
                        />
                        <span className={`text-red-300 font-medium ${b.enabled === false ? 'line-through opacity-50' : ''}`}>
                          {b.term}
                        </span>
                        {b.caseSensitive && <span className="text-[10px] bg-slate-600 px-1 py-0.5 rounded text-slate-300">Aa</span>}
                        {b.isDefault && <span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white font-medium">🔒 Admin</span>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!b.isDefault && (
                          <>
                            <button onClick={() => startEdit(b)} className="text-slate-400 hover:text-orange-400 p-1">
                              <IconEdit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removeTerm(b.id)} className="text-slate-400 hover:text-red-400 p-1">
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>
                  Total: {blacklist.length} terms 
                  ({blacklist.filter(b => b.isDefault).length} admin + {blacklist.filter(b => !b.isDefault).length} yours)
                  • {blacklist.filter(b => b.enabled !== false).length} active
                </span>
                {blacklist.filter(b => !b.isDefault).length > 0 && (
                  <button onClick={clearBlacklistData} className="text-red-400 hover:underline">
                    Delete Your Terms
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: IMPORT WIZARD */}
            <div className="w-full md:w-[450px] flex flex-col gap-4 bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <h4 className="font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2">
                <IconExcel className="w-5 h-5 text-green-400" /> 
                Bulk Import (Excel)
              </h4>

              {importStep === 'upload' && (
                <div 
                  className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-lg hover:bg-slate-800/50 transition-colors p-8 cursor-pointer" 
                  onClick={() => blacklistFileRef.current?.click()}
                >
                  <input 
                    type="file" 
                    accept=".xlsx" 
                    ref={blacklistFileRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                  />
                  {importLoading ? 
                    <IconLoading className="w-8 h-8 text-red-400 mb-2" /> : 
                    <IconImport className="w-8 h-8 text-slate-500 mb-2" />
                  }
                  <p className="text-sm font-medium text-slate-300">Click to upload Excel</p>
                  <p className="text-xs text-slate-500 text-center mt-1">
                    1 column: Protected Term<br/>
                    Row 1 must be header
                  </p>
                </div>
              )}

              {importStep === 'mapping' && previewData && (
                <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                      File: {importFile?.name}
                    </span>
                    <button 
                      onClick={() => { setImportStep('upload'); setImportFile(null); }} 
                      className="text-xs text-red-400 hover:underline"
                    >
                      Change File
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Column for <b>Protected Term</b>:
                    </label>
                    <select 
                      value={termColIndex} 
                      onChange={e => setTermColIndex(Number(e.target.value))} 
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white"
                    >
                      <option value={-1}>-- Select Column --</option>
                      {previewData.headers.map((h, idx) => (
                        <option key={idx} value={idx}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 overflow-auto border border-slate-700 rounded bg-slate-900">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800 text-slate-400 font-medium sticky top-0">
                        <tr>
                          {previewData.headers.map((h, i) => (
                            <th 
                              key={i} 
                              className={`p-2 border-b border-slate-700 whitespace-nowrap ${i === termColIndex ? 'bg-red-900/30 text-red-300' : ''}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.sampleRows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-800 last:border-0">
                            {row.map((cell, cIdx) => (
                              <td 
                                key={cIdx} 
                                className={`p-2 truncate max-w-[200px] ${cIdx === termColIndex ? 'bg-red-900/10' : ''}`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.totalRowsEstimate > 6 && (
                      <div className="p-2 text-center text-[10px] text-slate-500 italic bg-slate-800/50">
                        + approx {previewData.totalRowsEstimate - 6} more rows
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleConfirmImport} 
                    disabled={importLoading || termColIndex === -1}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    {importLoading ? 
                      <IconLoading className="w-4 h-4" /> : 
                      <IconImport className="w-4 h-4" />
                    }
                    Import Protected Terms
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  };

  const PreviewModal = () => {
    const [selectedSheet, setSelectedSheet] = useState(0);
    const [excelData, setExcelData] = useState<XLSX.WorkBook | null>(null);
    const [pdfData, setPdfData] = useState<any>(null);
    const [pdfPageNum, setPdfPageNum] = useState(1);
    const [loading, setLoading] = useState(false);
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

    // Load preview data when modal opens
    useEffect(() => {
      if (!previewItem || !previewItem.resultBlob) return;

      const loadPreview = async () => {
        setLoading(true);
        try {
          if (previewItem.type === FileType.EXCEL) {
            // Load Excel using SheetJS (xlsx)
            const arrayBuffer = await previewItem.resultBlob.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            setExcelData(workbook);
            setSelectedSheet(0);
          } else if (previewItem.type === FileType.PDF) {
            // Load PDF using PDF.js
            const arrayBuffer = await previewItem.resultBlob.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            setPdfData(pdf);
            setPdfPageNum(1);
          } else if (previewItem.type === FileType.PPTX) {
            // For PPTX, we don't render preview (show message instead)
            // Just set loading to false
          }
        } catch (error) {
          console.error('Preview loading error:', error);
        } finally {
          setLoading(false);
        }
      };

      loadPreview();

      return () => {
        setExcelData(null);
        setSelectedSheet(0);
        setPdfData(null);
        setPdfPageNum(1);
      };
    }, [previewItem]);

    if (!previewItem) return null;

    // Highlight glossary terms
    const renderHighlightedText = (text: string) => {
       if (!text) return null;
       let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
       
       glossary.forEach(g => {
         const escapedTerm = g.translation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         const regex = new RegExp(`(${escapedTerm})`, 'gi');
         html = html.replace(regex, '<span class="bg-yellow-500/20 text-yellow-200 border-b border-yellow-500/50">$1</span>');
       });

       return <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
    };

    // Render PDF Preview using PDF.js
    const renderPdfPreview = () => {
      if (!pdfData) return <div className="flex items-center justify-center h-full text-slate-400">Loading PDF preview...</div>;

      const renderPage = async (pageNumber: number) => {
        try {
          const page = await pdfData.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = pdfCanvasRef.current;
          if (!canvas) return;

          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          await page.render(renderContext).promise;
        } catch (error) {
          console.error('PDF page render error:', error);
        }
      };

      useEffect(() => {
        if (pdfData && pdfPageNum) {
          renderPage(pdfPageNum);
        }
      }, [pdfData, pdfPageNum]);

      return (
        <div className="flex flex-col h-full">
          {/* PDF Controls */}
          <div className="flex justify-between items-center p-3 bg-slate-800 border-b border-slate-700">
            <button
              onClick={() => setPdfPageNum(Math.max(1, pdfPageNum - 1))}
              disabled={pdfPageNum <= 1}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-sm font-medium transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-slate-300">
              Page {pdfPageNum} of {pdfData.numPages}
            </span>
            <button
              onClick={() => setPdfPageNum(Math.min(pdfData.numPages, pdfPageNum + 1))}
              disabled={pdfPageNum >= pdfData.numPages}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-sm font-medium transition-colors"
            >
              Next →
            </button>
          </div>

          {/* PDF Canvas */}
          <div className="flex-1 overflow-auto p-4 bg-slate-900 flex items-start justify-center">
            <canvas 
              ref={pdfCanvasRef} 
              className="border border-slate-700 shadow-2xl rounded"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        </div>
      );
    };

    // Render Excel Table using SheetJS
    const renderExcelPreview = () => {
      if (!excelData) return <div className="flex items-center justify-center h-full text-slate-400">Loading Excel preview...</div>;

      const sheetNames = excelData.SheetNames;
      const currentSheet = excelData.Sheets[sheetNames[selectedSheet]];
      
      if (!currentSheet) return <div className="text-slate-400 text-center p-4">No data in this sheet</div>;

      // Convert worksheet to HTML using SheetJS
      const htmlString = XLSX.utils.sheet_to_html(currentSheet, { id: 'excel-preview-table' });

      return (
        <div className="flex flex-col h-full">
          {/* Sheet Tabs */}
          {sheetNames.length > 1 && (
            <div className="flex gap-1 p-2 bg-slate-800 border-b border-slate-700 overflow-x-auto">
              {sheetNames.map((name, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSheet(idx)}
                  className={`px-4 py-2 text-xs font-medium rounded-t transition-colors whitespace-nowrap ${
                    selectedSheet === idx
                      ? 'bg-slate-700 text-white border-b-2 border-blue-500'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Table Content */}
          <div className="flex-1 overflow-auto p-4 bg-slate-900">
            <style>{`
              #excel-preview-table {
                border-collapse: collapse;
                width: 100%;
                font-size: 13px;
                background: white;
                border-radius: 8px;
                overflow: hidden;
              }
              #excel-preview-table th {
                background: #1e293b;
                color: #94a3b8;
                font-weight: 600;
                text-align: left;
                padding: 12px;
                border: 1px solid #334155;
                position: sticky;
                top: 0;
                z-index: 10;
              }
              #excel-preview-table td {
                padding: 10px 12px;
                border: 1px solid #334155;
                background: #0f172a;
                color: #e2e8f0;
              }
              #excel-preview-table tr:hover td {
                background: #1e293b;
              }
              #excel-preview-table td:empty::after {
                content: '';
                display: inline-block;
              }
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: htmlString }} />
          </div>
        </div>
      );
    };

    // Render preview based on file type
    const renderPreviewContent = () => {
      if (loading) {
        return (
          <div className="flex-1 flex items-center justify-center gap-3">
            <IconLoading className="w-8 h-8 text-blue-400" />
            <span className="text-slate-400">Loading preview...</span>
          </div>
        );
      }

      // Text-based files (Markdown, Image translation result)
      if (previewItem.type === FileType.MARKDOWN || previewItem.type === FileType.IMAGE) {
        return (
          <div className="flex-1 flex overflow-hidden">
            {/* Original */}
            <div className="flex-1 border-r border-slate-700 flex flex-col min-w-0">
              <div className="p-2 bg-slate-800/50 text-xs font-semibold text-slate-400 text-center uppercase tracking-wide sticky top-0">Original</div>
              <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-900/30">
                {previewItem.type === FileType.IMAGE ? (
                  <div className="flex items-center justify-center h-full p-4">
                    <img src={URL.createObjectURL(previewItem.file)} alt="Original" className="max-w-full max-h-full object-contain rounded shadow-lg border border-slate-700" />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-slate-300 leading-relaxed">{previewItem.originalText}</pre>
                )}
              </div>
            </div>

            {/* Translated */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50">
              <div className="p-2 bg-slate-800/50 text-xs font-semibold text-green-400 text-center uppercase tracking-wide sticky top-0">Translated ({targetLang})</div>
              <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {previewItem.translatedText ? renderHighlightedText(previewItem.translatedText) : (
                  <div className="flex items-center justify-center h-full text-slate-500 italic">Translation not available.</div>
                )}
              </div>
            </div>
          </div>
        );
      }

      // Excel files
      if (previewItem.type === FileType.EXCEL && previewItem.resultBlob) {
        return renderExcelPreview();
      }

      // PDF files
      if (previewItem.type === FileType.PDF && previewItem.resultBlob) {
        return renderPdfPreview();
      }

      // PPTX files
      if (previewItem.type === FileType.PPTX && previewItem.resultBlob) {
        return (
          <div className="flex items-center justify-center h-full text-slate-500 italic p-8">
            <div className="text-center">
              <IconPptx className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <p className="text-lg mb-2">PowerPoint Preview</p>
              <p className="text-sm">Preview for PowerPoint files is currently not available.</p>
              <p className="text-xs text-slate-600 mt-2">Please download the file to view the translated content.</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex-1 flex items-center justify-center text-slate-500 italic">
          Preview not available for this file type. Please download to view.
        </div>
      );
    };

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-2 md:p-6">
        <div className="bg-slate-900 rounded-xl border border-slate-700 w-full h-full flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl">
            <div className="flex items-center gap-3">
              <IconEye className="text-blue-400 w-6 h-6" />
              <div>
                <h3 className="font-bold text-white">Preview - {previewItem.file.name}</h3>
                <p className="text-xs text-slate-400">
                  {previewItem.type} • Translated to {targetLang}
                </p>
              </div>
            </div>
            <button onClick={() => setPreviewItem(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
              <IconClose className="text-white" />
            </button>
          </div>
          
          {/* Content */}
          {renderPreviewContent()}
          
          {/* Footer */}
          <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-between items-center rounded-b-xl">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded">💡 Tip</span>
              <span>
                {previewItem.type === FileType.EXCEL ? 'Use tabs to switch between sheets' : 
                 previewItem.type === FileType.PDF ? 'Use navigation buttons to browse pages' :
                 previewItem.type === FileType.MARKDOWN || previewItem.type === FileType.IMAGE ? 'Highlighted terms from glossary' :
                 'Download to view full formatting'}
              </span>
            </div>
            {previewItem.downloadUrl && (
              <a 
                href={previewItem.downloadUrl} 
                download={`translated_${targetLang}_${previewItem.file.name}${previewItem.type === FileType.IMAGE ? '.md' : ''}`} 
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-medium transition-colors shadow-lg"
              >
                <IconDownload className="w-4 h-4" /> Download
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 flex flex-col relative">
      {/* Modals */}
      <GlossaryModal />
      <BlacklistModal />
      <ContextModal />
      <HistoryModal />
      <PreviewModal />
      <ApiKeyModal />
      {showTestDashboard && <TestDashboard onClose={() => setShowTestDashboard(false)} />}
      {showHealthDashboard && <SystemHealthDashboard apiClient={apiClient} onClose={() => setShowHealthDashboard(false)} />}
      
      {/* Admin Panel - Only accessible by admin users */}
      {showAdminPanel && user?.role?.name === 'admin' && (
        <AdminPage 
          apiClient={apiClient} 
          onClose={() => setShowAdminPanel(false)} 
        />
      )}

      <div className="max-w-4xl mx-auto space-y-8 flex-1 w-full">
        
        {/* Header with Tools */}
        <header id="tour-welcome" className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              DocuTranslate AI
            </h1>
            <p className="text-slate-400 text-sm mt-1">Smart Document Translation</p>
            {user && (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700 rounded-md">
                  <span className="text-slate-500">👤</span>
                  <span className="text-slate-300">{user.email}</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
                  user.role?.name === 'admin' 
                    ? 'bg-purple-900/30 border-purple-500/50 text-purple-300' 
                    : user.role?.name === 'leader'
                    ? 'bg-blue-900/30 border-blue-500/50 text-blue-300'
                    : user.role?.name === 'dev'
                    ? 'bg-green-900/30 border-green-500/50 text-green-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400'
                }`}>
                  <span>{user.role?.name === 'admin' ? '👑' : user.role?.name === 'leader' ? '⭐' : user.role?.name === 'dev' ? '💻' : '🧪'}</span>
                  <span className="font-medium uppercase">{user.role?.name || 'User'}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
             <button id="tour-glossary" onClick={() => setShowGlossaryModal(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition-colors text-blue-300 min-w-[100px] justify-center">
               <IconBook className="w-4 h-4" /> 
               <span>Glossary</span>
             </button>
             <button id="tour-blacklist" onClick={() => setShowBlacklistModal(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition-colors text-red-300 min-w-[100px] justify-center">
               <IconShield className="w-4 h-4" /> 
               <span>Blacklist</span>
               {blacklist.length > 0 && <span className="ml-1 bg-red-500/20 px-1.5 py-0.5 rounded text-xs">{blacklist.length}</span>}
             </button>
             <button id="tour-context" onClick={() => setShowContextModal(true)} className={`flex items-center gap-2 px-3 py-2 border border-slate-700 rounded-lg text-sm transition-colors min-w-[100px] justify-center ${context ? 'bg-blue-900/30 text-blue-300 border-blue-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
               <IconSettings className="w-4 h-4" /> 
               <span>Context</span>
             </button>
             <button id="tour-history" onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition-colors text-purple-300 min-w-[100px] justify-center">
               <IconHistory className="w-4 h-4" /> 
               <span>History</span>
             </button>
             <button 
               onClick={() => setShowApiKeyModal(true)} 
               className={`flex items-center gap-2 px-3 py-2 border border-slate-700 rounded-lg text-sm transition-colors min-w-[100px] justify-center ${userApiKey ? 'bg-green-900/30 text-green-300 border-green-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
               title={userApiKey ? 'Using personal API key' : 'Using default API key'}
             >
               <IconKey className="w-4 h-4" /> 
               <span>Key</span>
             </button>
             {user && (
               <button 
                 onClick={handleLogout} 
                 className="flex items-center gap-2 px-3 py-2 bg-red-900/30 hover:bg-red-800/40 border border-red-500/50 rounded-lg text-sm transition-colors text-red-300 min-w-[100px] justify-center"
                 title={`Logged in as ${user.email}`}
               >
                 <IconKey className="w-4 h-4" /> 
                 <span>Logout</span>
               </button>
             )}
             <button onClick={startTour} className="flex items-center justify-center p-2 w-10 h-10 bg-slate-800 rounded-lg text-slate-500 hover:text-blue-400 transition-colors" title="Start Tour">
                <IconHelp className="w-5 h-5" />
             </button>
          </div>
        </header>

        {/* Main Card */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
          
          {/* Controls Bar */}
          <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start gap-4 bg-slate-800/50">
            <div className="flex flex-col gap-3 w-full md:w-auto">
              {/* From Language Dropdown */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <IconLanguage className="text-purple-400 w-5 h-5" />
                <span className="text-sm font-medium text-slate-300 whitespace-nowrap">From Language:</span>
                <select 
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="bg-slate-700 border-none rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none w-full md:w-48 text-white cursor-pointer hover:bg-slate-600 transition-colors"
                  disabled={globalStatus === AppStatus.TRANSLATING}
                >
                  <option value="auto">Auto Detect</option>
                  <option value="vi">Vietnamese</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="th">Thai</option>
                </select>
              </div>
              
              {/* To Language Dropdown */}
              <div id="tour-lang" className="flex items-center gap-2 w-full md:w-auto">
                <IconLanguage className="text-blue-400 w-5 h-5" />
                <span className="text-sm font-medium text-slate-300 whitespace-nowrap">To Language:</span>
                <select 
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
                  className="bg-slate-700 border-none rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-48 text-white cursor-pointer hover:bg-slate-600 transition-colors"
                  disabled={globalStatus === AppStatus.TRANSLATING}
                >
                  {Object.values(SupportedLanguage).map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
              
              {/* Smart Translation Mode Toggle */}
              <label className="flex items-center gap-2 cursor-pointer group ml-7">
                <input 
                  type="checkbox"
                  checked={skipAlreadyTranslated}
                  onChange={(e) => setSkipAlreadyTranslated(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  disabled={globalStatus === AppStatus.TRANSLATING}
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                  Smart mode: Skip already translated content <span className="text-green-400">(saves 50-70% tokens)</span>
                </span>
              </label>
              
              {/* Blacklist Protection Toggle */}
              <label className="flex items-center gap-2 cursor-pointer group ml-7">
                <input 
                  type="checkbox"
                  checked={blacklistEnabled}
                  onChange={async (e) => {
                    const newValue = e.target.checked;
                    setBlacklistEnabled(newValue);
                    try {
                      await userDataAPI.updatePreferences({ blacklistEnabled: newValue });
                    } catch (error) {
                      console.error('Failed to save blacklist enabled state', error);
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-600 focus:ring-2 focus:ring-red-500 cursor-pointer"
                  disabled={globalStatus === AppStatus.TRANSLATING}
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                  🛡️ Protect sensitive data <span className="text-red-400">({blacklist.length} terms)</span>
                </span>
              </label>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-xs text-slate-500 font-mono">
                Queue: {queue.length} files
              </div>
              {queue.length > 0 && globalStatus !== AppStatus.TRANSLATING && (
                 <button onClick={clearAll} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:underline">
                   <IconTrash className="w-3 h-3" /> Clear All
                 </button>
              )}
            </div>
          </div>

          <div className="p-8">
            {/* Upload Area */}
            {queue.length === 0 && (
              <div 
                id="tour-upload"
                className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center hover:border-blue-500 hover:bg-slate-800/80 transition-all cursor-pointer group"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept=".md,.txt,.xlsx,.xls,.csv,.pptx,.png,.jpg,.jpeg,.webp" />
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform group-hover:bg-blue-500/20">
                  <IconUpload className="w-8 h-8 text-blue-400 group-hover:text-blue-300" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Click or Drag & Drop Files</h3>
                <p className="text-slate-400 text-sm">Supported: Markdown, Excel, PPTX, Images</p>
              </div>
            )}

            {/* File List */}
            {queue.length > 0 && (
              <div className="space-y-4">
                {/* Add More */}
                {globalStatus !== AppStatus.TRANSLATING && (
                  <div className="border border-dashed border-slate-600 rounded-lg p-3 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-300 hover:border-blue-400 hover:bg-slate-800/50 cursor-pointer transition-all" onClick={() => fileInputRef.current?.click()}>
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept=".md,.txt,.xlsx,.xls,.csv,.pptx,.png,.jpg,.jpeg,.webp" />
                     <IconUpload className="w-4 h-4" /> <span className="text-sm">Add more files</span>
                  </div>
                )}

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {queue.map((item) => (
                    <div key={item.id} className="bg-slate-700/30 rounded-lg border border-slate-700 overflow-hidden">
                      <div className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center shrink-0">
                          {item.type === FileType.EXCEL ? <IconExcel className="w-5 h-5 text-green-400" /> : 
                           item.type === FileType.IMAGE ? <IconImage className="w-5 h-5 text-orange-400" /> :
                           item.type === FileType.PPTX ? <IconPptx className="w-5 h-5 text-orange-500" /> :
                           <IconMarkdown className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                             <h4 className="text-sm font-medium text-white truncate pr-2">{item.file.name}</h4>
                             {item.status !== AppStatus.TRANSLATING && (
                               <button onClick={() => removeFile(item.id)} className="text-slate-500 hover:text-red-400 transition-colors"><IconClose className="w-4 h-4" /></button>
                             )}
                          </div>
                          
                          {item.status === AppStatus.TRANSLATING ? (
                            <div className="mt-2 w-full max-w-sm">
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>{item.progressMessage}</span><span>{item.progress}%</span></div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden"><div className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${item.progress}%` }}></div></div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500">{(item.file.size / 1024).toFixed(1)} KB</span>
                                <span className="text-slate-600 text-[10px]">•</span>
                                <div className="flex items-center gap-1.5">
                                  {item.status === AppStatus.COMPLETED && <IconSuccess className="w-3 h-3 text-green-400" />}
                                  {item.status === AppStatus.ERROR && <IconError className="w-3 h-3 text-red-400" />}
                                  <span className={`text-xs ${item.status === AppStatus.COMPLETED ? 'text-green-300' : item.status === AppStatus.ERROR ? 'text-red-300' : 'text-slate-400'}`}>
                                    {item.status === AppStatus.IDLE ? 'Ready' : item.status}
                                  </span>
                                </div>
                              </div>
                              {item.status === AppStatus.ERROR && item.errorMessage && (
                                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-md">
                                  <div className="flex items-start gap-2">
                                    <IconError className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-red-300">{item.errorMessage}</p>
                                      {item.errorDetails && (
                                        <p className="text-[11px] text-red-400/80 mt-0.5 leading-snug">{item.errorDetails}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                           {item.status === AppStatus.ERROR && (
                             <button 
                               onClick={() => retryFile(item.id)} 
                               className="p-1.5 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded-md transition-colors" 
                               title="Retry translation"
                             >
                               <IconRefresh className="w-4 h-4" />
                             </button>
                           )}
                           {item.status === AppStatus.COMPLETED && item.resultBlob && (
                             <button onClick={() => setPreviewItem(item)} className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-md transition-colors" title="Preview">
                               <IconEye className="w-4 h-4" />
                             </button>
                           )}
                           {item.downloadUrl && (
                             <a href={item.downloadUrl} download={`translated_${targetLang}_${item.file.name}${item.type === FileType.IMAGE ? '.md' : ''}`} className="p-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-md transition-colors" title="Download file"><IconDownload className="w-4 h-4" /></a>
                           )}
                           {item.type === FileType.EXCEL && item.availableSheets.length > 0 && (
                             <button onClick={() => toggleExpand(item.id)} className={`p-1.5 rounded-md transition-colors ${item.isExpanded ? 'bg-slate-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`} title="Configure Sheets">
                               {item.isExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                             </button>
                           )}
                        </div>
                      </div>

                      {item.isExpanded && item.type === FileType.EXCEL && (
                        <div className="bg-slate-800/50 p-3 border-t border-slate-700 text-xs">
                          <div className="flex justify-between items-center mb-2">
                             <p className="font-medium text-slate-400">Select Sheets to Translate:</p>
                             <div className="flex gap-2">
                               <button onClick={() => selectAllSheets(item.id)} disabled={item.status === AppStatus.TRANSLATING} className="text-blue-400 hover:text-blue-300 text-[10px] uppercase font-bold tracking-wider disabled:opacity-50 transition-colors">Select All</button>
                               <span className="text-slate-600">|</span>
                               <button onClick={() => deselectAllSheets(item.id)} disabled={item.status === AppStatus.TRANSLATING} className="text-slate-500 hover:text-slate-400 text-[10px] uppercase font-bold tracking-wider disabled:opacity-50 transition-colors">None</button>
                             </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.availableSheets.map(sheet => (
                              <label key={sheet} className="flex items-center gap-1.5 bg-slate-700 px-2 py-1 rounded cursor-pointer hover:bg-slate-600 select-none">
                                <input type="checkbox" checked={item.selectedSheets.includes(sheet)} onChange={() => toggleSheet(item.id, sheet)} className="rounded border-slate-500 bg-slate-800 text-blue-500 focus:ring-blue-500/50" disabled={item.status === AppStatus.TRANSLATING} />
                                <span className="text-slate-200">{sheet}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Global Actions */}
            {queue.length > 0 && (
               <div className="mt-8 pt-4 border-t border-slate-700">
                  <button onClick={processQueue} disabled={globalStatus === AppStatus.TRANSLATING} className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${globalStatus === AppStatus.TRANSLATING ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'}`}>
                    {globalStatus === AppStatus.TRANSLATING ? <><IconLoading className="w-5 h-5" /> Processing Queue...</> : <>Translate All ({queue.filter(i => i.status === AppStatus.IDLE || i.status === AppStatus.ERROR).length})</>}
                  </button>
               </div>
            )}

            {/* Logs Area */}
            <div className="mt-8 bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-400 h-40 overflow-y-auto custom-scrollbar border border-slate-700">
               {logs.length === 0 ? <span className="opacity-50">System logs will appear here...</span> : logs.slice().reverse().map(log => (
                   <div key={log.id} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-slate-400'}`}>
                     <span className="opacity-50">[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
                   </div>
                 ))}
            </div>
            
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto mt-8 py-4 border-t border-slate-800 text-center text-slate-600 text-xs">
         <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowTestDashboard(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-blue-400 transition-all flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-blue-500"
                title="Open System Health Dashboard (Ctrl+Shift+T)"
              >
                <IconSettings className="w-4 h-4" />
                <span className="font-medium">System Health</span>
              </button>
              
              {/* Admin Panel Button */}
              {user?.role?.name === 'admin' && (
                <button 
                  onClick={() => setShowAdminPanel(true)}
                  className="bg-purple-900/30 hover:bg-purple-800/40 text-purple-300 hover:text-purple-200 transition-all flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-700 hover:border-purple-500"
                  title="Open Admin Panel - Manage Default Glossary & Blacklist"
                >
                  <IconShield className="w-4 h-4" />
                  <span className="font-medium">Admin Panel</span>
                </button>
              )}
              
              {/* System Health Dashboard Button */}
              <button 
                onClick={() => setShowHealthDashboard(true)}
                className="bg-green-900/30 hover:bg-green-800/40 text-green-300 hover:text-green-200 transition-all flex items-center gap-2 px-4 py-2 rounded-lg border border-green-700 hover:border-green-500"
                title="System Health Dashboard - Runtime Testing & Validation (Ctrl+Shift+H)"
              >
                <IconRefresh className="w-4 h-4" />
                <span className="font-medium">Health Check</span>
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <span>DocuTranslate AI v{APP_VERSION}</span>
              <span>•</span>
              <span>Created by {APP_AUTHOR}</span>
            </div>
         </div>
      </footer>
      
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={(userData) => {
            setUser(userData);
            setShowAuthModal(false);
          }}
        />
      )}
    </div>
  );
};

export default App;