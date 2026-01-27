import React, { useState, useRef, useEffect } from 'react';
import { 
  IconUpload, 
  IconMarkdown, 
  IconExcel, 
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
  IconImport
} from './components/Icons';
import { AppStatus, FileType, SupportedLanguage, LogEntry, FileQueueItem, GlossaryItem, HistoryItem } from './types';
import { processMarkdown, processExcel, getExcelSheetNames, parseGlossaryFromExcel } from './services/fileProcessing';

const App: React.FC = () => {
  const [globalStatus, setGlobalStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [targetLang, setTargetLang] = useState<SupportedLanguage>(SupportedLanguage.VIETNAMESE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // New State Features
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  const [context, setContext] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Modal States
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileQueueItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load History & Glossary from LocalStorage
  useEffect(() => {
    const savedGlossary = localStorage.getItem('d12_glossary');
    if (savedGlossary) {
      try { setGlossary(JSON.parse(savedGlossary)); } catch(e) {}
    }

    const savedHistory = localStorage.getItem('d12_history');
    if (savedHistory) {
      try { 
        const parsed = JSON.parse(savedHistory);
        // Filter out items older than 24h
        const now = Date.now();
        const validHistory = parsed.filter((h: HistoryItem) => (now - h.timestamp) < 24 * 60 * 60 * 1000);
        setHistory(validHistory);
      } catch(e) {}
    }
  }, []);

  const saveGlossary = (newGlossary: GlossaryItem[]) => {
    setGlossary(newGlossary);
    localStorage.setItem('d12_glossary', JSON.stringify(newGlossary));
  };

  const updateHistory = (newItem: HistoryItem) => {
    setHistory(prev => {
      const updated = [newItem, ...prev];
      localStorage.setItem('d12_history', JSON.stringify(updated.map(({ blob, downloadUrl, ...rest }) => rest))); // Don't store blobs in LS
      return updated;
    });
  };

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36), message, timestamp: new Date(), type }]);
  };

  const getFileType = (fileName: string): FileType => {
    if (fileName.endsWith('.md') || fileName.endsWith('.txt')) return FileType.MARKDOWN;
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) return FileType.EXCEL;
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
              return { ...q, availableSheets: names, selectedSheets: names, isExpanded: false };
            }
            return q;
          }));
          addLog(`Loaded sheets for ${item.file.name}`, 'info');
        } catch (e) {
          console.error(e);
          addLog(`Failed to load sheets for ${item.file.name}`, 'error');
        }
      }
    };
    loadSheets();
  }, [queue]);

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
        } else {
          resultBlob = await processExcel(await item.file.arrayBuffer(), targetLang, item.selectedSheets, context, glossary, updateProgress);
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

        // Add to History
        updateHistory({
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
        console.error(error);
        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, status: AppStatus.ERROR, errorMessage: error instanceof Error ? error.message : 'Unknown error', progressMessage: 'Failed'
        } : q));
        addLog(`Error translating ${item.file.name}`, 'error');
      }
    }

    setGlobalStatus(AppStatus.COMPLETED);
    addLog('Batch processing finished.', 'success');
  };

  // --- SUB-COMPONENTS FOR MODALS ---

  const GlossaryModal = () => {
    const [term, setTerm] = useState('');
    const [translation, setTranslation] = useState('');
    const glossaryFileRef = useRef<HTMLInputElement>(null);
    const [importLoading, setImportLoading] = useState(false);

    const addTerm = () => {
      if (term && translation) {
        saveGlossary([...glossary, { id: Math.random().toString(36), term, translation }]);
        setTerm('');
        setTranslation('');
      }
    };

    const removeTerm = (id: string) => {
      saveGlossary(glossary.filter(g => g.id !== id));
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      
      setImportLoading(true);
      let newItems: GlossaryItem[] = [];
      let importedCount = 0;

      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        try {
          const items = await parseGlossaryFromExcel(file, targetLang);
          newItems = [...newItems, ...items];
          importedCount += items.length;
          addLog(`Imported ${items.length} terms from ${file.name}`, 'success');
        } catch (err) {
          console.error(err);
          addLog(`Failed to import glossary from ${file.name}`, 'error');
        }
      }

      if (newItems.length > 0) {
        saveGlossary([...glossary, ...newItems]);
      }
      
      setImportLoading(false);
      if (glossaryFileRef.current) glossaryFileRef.current.value = '';
    };

    if (!showGlossaryModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-lg text-white flex items-center gap-2"><IconBook className="w-5 h-5 text-blue-400"/> Glossary Management</h3>
            <button onClick={() => setShowGlossaryModal(false)}><IconClose className="text-slate-400 hover:text-white" /></button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            
            {/* Import Section */}
            <div className="bg-slate-700/30 p-3 rounded border border-slate-700 border-dashed">
               <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-medium text-white flex items-center gap-1.5"><IconExcel className="w-4 h-4 text-green-400" /> Import from Excel</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Auto-detects "{targetLang}" and Source columns.</p>
                  </div>
                  <button 
                    onClick={() => glossaryFileRef.current?.click()}
                    disabled={importLoading}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {importLoading ? <IconLoading className="w-3 h-3" /> : <IconImport className="w-3 h-3" />}
                    Import
                  </button>
                  <input 
                    type="file" 
                    multiple 
                    accept=".xlsx,.xls" 
                    ref={glossaryFileRef} 
                    className="hidden" 
                    onChange={handleImportExcel} 
                  />
               </div>
            </div>

            <div className="flex gap-2">
              <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Term (e.g., 'Japanese')" className="bg-slate-900 border border-slate-700 rounded p-2 flex-1 text-sm outline-none focus:border-blue-500" />
              <input value={translation} onChange={e => setTranslation(e.target.value)} placeholder={`Translation (${targetLang})`} className="bg-slate-900 border border-slate-700 rounded p-2 flex-1 text-sm outline-none focus:border-blue-500" />
              <button onClick={addTerm} className="bg-blue-600 hover:bg-blue-500 p-2 rounded text-white"><IconPlus className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-2">
              {glossary.length === 0 ? <p className="text-slate-500 text-sm italic">No terms added yet.</p> : 
                glossary.map(g => (
                  <div key={g.id} className="flex justify-between items-center bg-slate-700/50 p-2 rounded text-sm group">
                    <div className="flex-1 break-words mr-2"><span className="text-blue-300 font-medium">{g.term}</span> <span className="text-slate-500">→</span> <span className="text-green-300">{g.translation}</span></div>
                    <button onClick={() => removeTerm(g.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-4 h-4" /></button>
                  </div>
                ))
              }
            </div>
          </div>
          <div className="p-4 border-t border-slate-700 text-right">
             <button onClick={() => setShowGlossaryModal(false)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm">Close</button>
          </div>
        </div>
      </div>
    );
  };

  const ContextModal = () => {
    if (!showContextModal) return null;
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
             <button onClick={() => setShowContextModal(false)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm text-white">Save Context</button>
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
                          {h.fileType === FileType.EXCEL ? <IconExcel className="w-4 h-4 text-green-400" /> : <IconMarkdown className="w-4 h-4 text-blue-400" />}
                       </div>
                       <div>
                          <div className="text-sm font-medium text-white">{h.fileName}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(h.timestamp).toLocaleTimeString()} • {h.targetLang}
                          </div>
                       </div>
                    </div>
                    {h.downloadUrl ? (
                      <a href={h.downloadUrl} download={`translated_${h.targetLang}_${h.fileName}`} className="p-2 hover:bg-slate-600 rounded text-green-400"><IconDownload className="w-4 h-4" /></a>
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

  const PreviewModal = () => {
    if (!previewItem) return null;

    // Highlight glossary terms
    const renderHighlightedText = (text: string) => {
       if (!text) return null;
       let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Escape HTML
       
       glossary.forEach(g => {
         // Simple regex replace for glossary highlighting (case insensitive)
         // Escape special regex chars in term
         const escapedTerm = g.translation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         const regex = new RegExp(`(${escapedTerm})`, 'gi');
         html = html.replace(regex, '<span class="bg-yellow-500/20 text-yellow-200 border-b border-yellow-500/50">$1</span>');
       });

       return <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
    };

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-2 md:p-6">
        <div className="bg-slate-900 rounded-xl border border-slate-700 w-full h-full flex flex-col shadow-2xl">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl">
             <div className="flex items-center gap-3">
                <IconSplit className="text-blue-400" />
                <div>
                   <h3 className="font-bold text-white">Side-by-Side Comparison</h3>
                   <p className="text-xs text-slate-400">{previewItem.file.name}</p>
                </div>
             </div>
             <button onClick={() => setPreviewItem(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><IconClose className="text-white" /></button>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
             {/* Original */}
             <div className="flex-1 border-r border-slate-700 flex flex-col min-w-0">
                <div className="p-2 bg-slate-800/50 text-xs font-semibold text-slate-400 text-center uppercase tracking-wide sticky top-0">Original</div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                   {previewItem.type === FileType.MARKDOWN ? (
                     <pre className="whitespace-pre-wrap font-mono text-sm text-slate-300 leading-relaxed">{previewItem.originalText}</pre>
                   ) : (
                     <div className="flex items-center justify-center h-full text-slate-500 italic">Preview not available for Excel source.</div>
                   )}
                </div>
             </div>

             {/* Translated */}
             <div className="flex-1 flex flex-col min-w-0 bg-slate-900/50">
                <div className="p-2 bg-slate-800/50 text-xs font-semibold text-green-400 text-center uppercase tracking-wide sticky top-0">Translated ({targetLang})</div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                   {previewItem.translatedText ? (
                      renderHighlightedText(previewItem.translatedText)
                   ) : (
                      <div className="flex items-center justify-center h-full text-slate-500 italic">
                        {previewItem.type === FileType.EXCEL ? "Preview not available for Excel output." : "Translation not available."}
                      </div>
                   )}
                </div>
             </div>
          </div>
          
          <div className="p-3 bg-slate-800 border-t border-slate-700 text-xs text-slate-400 flex justify-between items-center rounded-b-xl">
            <span><span className="bg-yellow-500/20 text-yellow-200 px-1 rounded">Highlight</span> indicates glossary terms applied.</span>
            {previewItem.downloadUrl && (
              <a href={previewItem.downloadUrl} download={`translated_${targetLang}_${previewItem.file.name}`} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded font-medium transition-colors">
                <IconDownload className="w-3 h-3" /> Download
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8">
      {/* Modals */}
      <GlossaryModal />
      <ContextModal />
      <HistoryModal />
      <PreviewModal />

      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header with Tools */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              DocuTranslate AI
            </h1>
            <p className="text-slate-400 text-sm mt-1">Smart Document Translation</p>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setShowGlossaryModal(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition-colors text-blue-300">
               <IconBook className="w-4 h-4" /> Glossary
             </button>
             <button onClick={() => setShowContextModal(true)} className={`flex items-center gap-2 px-3 py-2 border border-slate-700 rounded-lg text-sm transition-colors ${context ? 'bg-blue-900/30 text-blue-300 border-blue-500/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
               <IconSettings className="w-4 h-4" /> Context
             </button>
             <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm transition-colors text-purple-300">
               <IconHistory className="w-4 h-4" /> History
             </button>
          </div>
        </header>

        {/* Main Card */}
        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
          
          {/* Controls Bar */}
          <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-800/50">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <IconLanguage className="text-blue-400 w-5 h-5" />
              <span className="text-sm font-medium text-slate-300 whitespace-nowrap">Target Language:</span>
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
                className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center hover:border-blue-500 hover:bg-slate-800/80 transition-all cursor-pointer group"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept=".md,.txt,.xlsx,.xls,.csv" />
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform group-hover:bg-blue-500/20">
                  <IconUpload className="w-8 h-8 text-blue-400 group-hover:text-blue-300" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Click or Drag & Drop Files</h3>
                <p className="text-slate-400 text-sm">Supported: Markdown (.md), Text (.txt), Excel (.xlsx)</p>
              </div>
            )}

            {/* File List */}
            {queue.length > 0 && (
              <div className="space-y-4">
                {/* Add More */}
                {globalStatus !== AppStatus.TRANSLATING && (
                  <div className="border border-dashed border-slate-600 rounded-lg p-3 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-300 hover:border-blue-400 hover:bg-slate-800/50 cursor-pointer transition-all" onClick={() => fileInputRef.current?.click()}>
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept=".md,.txt,.xlsx,.xls,.csv" />
                     <IconUpload className="w-4 h-4" /> <span className="text-sm">Add more files</span>
                  </div>
                )}

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {queue.map((item) => (
                    <div key={item.id} className="bg-slate-700/30 rounded-lg border border-slate-700 overflow-hidden">
                      <div className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center shrink-0">
                          {item.type === FileType.EXCEL ? <IconExcel className="w-5 h-5 text-green-400" /> : <IconMarkdown className="w-5 h-5 text-blue-400" />}
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
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                           {item.status === AppStatus.COMPLETED && item.type === FileType.MARKDOWN && (
                             <button onClick={() => setPreviewItem(item)} className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-md transition-colors" title="Preview / Compare">
                               <IconEye className="w-4 h-4" />
                             </button>
                           )}
                           {item.downloadUrl && (
                             <a href={item.downloadUrl} download={`translated_${targetLang}_${item.file.name}`} className="p-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-md transition-colors" title="Download file"><IconDownload className="w-4 h-4" /></a>
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
    </div>
  );
};

export default App;