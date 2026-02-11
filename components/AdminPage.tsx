import React, { useEffect, useState, useRef } from 'react';
import { X, Plus, Trash2, Edit2, Users, Shield, Search, Save, FileSpreadsheet, Upload, Book } from 'lucide-react';
import { getExcelPreview, parseGlossaryByColumns, parseBlacklistFromExcel } from '../services/fileProcessing';

interface DefaultGlossaryItem {
  id: string;
  term: string;
  translation: string;
  isActive: boolean;
  createdAt: string;
}

interface DefaultBlacklistItem {
  id: string;
  term: string;
  description?: string;
  caseSensitive: boolean;
  isActive: boolean;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  isActive: boolean;
  role: { id: string; name: string };
  createdAt: string;
}

interface AdminPageProps {
  apiClient: any;
  onClose: () => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ apiClient, onClose, showConfirm }) => {
  const [activeTab, setActiveTab] = useState<'glossary' | 'blacklist' | 'users'>('glossary');
  const [defaultGlossary, setDefaultGlossary] = useState<DefaultGlossaryItem[]>([]);
  const [defaultBlacklist, setDefaultBlacklist] = useState<DefaultBlacklistItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Glossary states
  const [glossaryTerm, setGlossaryTerm] = useState('');
  const [glossaryTranslation, setGlossaryTranslation] = useState('');
  const [glossarySearch, setGlossarySearch] = useState('');
  const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(null);

  // Blacklist states
  const [blacklistTerm, setBlacklistTerm] = useState('');
  const [blacklistDesc, setBlacklistDesc] = useState('');
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [editingBlacklistId, setEditingBlacklistId] = useState<string | null>(null);

  // Import states
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [importType, setImportType] = useState<'glossary' | 'blacklist'>('glossary');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping'>('upload');
  const [previewData, setPreviewData] = useState<any>(null);
  const [sourceCol, setSourceCol] = useState(-1);
  const [targetCol, setTargetCol] = useState(-1);

  // Bulk selection state
  const [selectedGlossaryIds, setSelectedGlossaryIds] = useState<string[]>([]);
  const [selectedBlacklistIds, setSelectedBlacklistIds] = useState<string[]>([]);

  const glossaryFileRef = useRef<HTMLInputElement>(null);
  const blacklistFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'glossary') {
        const response = await apiClient.get('/admin/default-glossary');
        setDefaultGlossary(response.data);
      } else if (activeTab === 'blacklist') {
        const response = await apiClient.get('/admin/default-blacklist');
        setDefaultBlacklist(response.data);
      } else {
        const response = await apiClient.get('/admin/users');
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load data. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Glossary functions
  const handleSaveGlossary = async () => {
    if (!glossaryTerm || !glossaryTranslation) return;
    
    try {
      if (editingGlossaryId) {
        await apiClient.put(`/admin/default-glossary/${editingGlossaryId}`, {
          term: glossaryTerm,
          translation: glossaryTranslation,
        });
        setEditingGlossaryId(null);
      } else {
        await apiClient.post('/admin/default-glossary', {
          term: glossaryTerm,
          translation: glossaryTranslation,
        });
      }
      setGlossaryTerm('');
      setGlossaryTranslation('');
      loadData();
    } catch (error) {
      console.error('Failed to save glossary item:', error);
      alert('Failed to save glossary item.');
    }
  };

  const startEditGlossary = (item: DefaultGlossaryItem) => {
    setGlossaryTerm(item.term);
    setGlossaryTranslation(item.translation);
    setEditingGlossaryId(item.id);
  };

  const cancelEditGlossary = () => {
    setGlossaryTerm('');
    setGlossaryTranslation('');
    setEditingGlossaryId(null);
  };

  const deleteGlossaryItem = async (id: string) => {
    showConfirm(
      'Delete Default Glossary Term',
      'Delete this default glossary term? This will remove it for ALL users.',
      async () => {
        try {
          await apiClient.delete(`/admin/default-glossary/${id}`);
          if (editingGlossaryId === id) cancelEditGlossary();
          loadData();
        } catch (error) {
          console.error('Failed to delete glossary item:', error);
          alert('Failed to delete item.');
        }
      },
      'Delete',
      'Cancel'
    );
  };

  const toggleGlossaryActive = async (item: DefaultGlossaryItem) => {
    try {
      await apiClient.put(`/admin/default-glossary/${item.id}`, {
        term: item.term,
        translation: item.translation,
        isActive: !item.isActive,
      });
      loadData();
    } catch (error) {
      console.error('Failed to toggle glossary item:', error);
      alert('Failed to toggle item.');
    }
  };

  // Blacklist functions
  const handleSaveBlacklist = async () => {
    if (!blacklistTerm.trim()) return;
    
    try {
      if (editingBlacklistId) {
        await apiClient.put(`/admin/default-blacklist/${editingBlacklistId}`, {
          term: blacklistTerm,
          description: blacklistDesc,
          caseSensitive,
        });
        setEditingBlacklistId(null);
      } else {
        await apiClient.post('/admin/default-blacklist', {
          term: blacklistTerm,
          description: blacklistDesc,
          caseSensitive,
        });
      }
      setBlacklistTerm('');
      setBlacklistDesc('');
      setCaseSensitive(false);
      loadData();
    } catch (error) {
      console.error('Failed to save blacklist item:', error);
      alert('Failed to save blacklist item.');
    }
  };

  const startEditBlacklist = (item: DefaultBlacklistItem) => {
    setBlacklistTerm(item.term);
    setBlacklistDesc(item.description || '');
    setCaseSensitive(item.caseSensitive);
    setEditingBlacklistId(item.id);
  };

  const cancelEditBlacklist = () => {
    setBlacklistTerm('');
    setBlacklistDesc('');
    setCaseSensitive(false);
    setEditingBlacklistId(null);
  };

  const deleteBlacklistItem = async (id: string) => {
    showConfirm(
      'Delete Default Blacklist Term',
      'Delete this default blacklist term? This will remove protection for ALL users.',
      async () => {
        try {
          await apiClient.delete(`/admin/default-blacklist/${id}`);
          if (editingBlacklistId === id) cancelEditBlacklist();
          loadData();
        } catch (error) {
          console.error('Failed to delete blacklist item:', error);
          alert('Failed to delete item.');
        }
      },
      'Delete',
      'Cancel'
    );
  };

  const toggleBlacklistActive = async (item: DefaultBlacklistItem) => {
    try {
      await apiClient.put(`/admin/default-blacklist/${item.id}`, {
        term: item.term,
        description: item.description,
        caseSensitive: item.caseSensitive,
        isActive: !item.isActive,
      });
      loadData();
    } catch (error) {
      console.error('Failed to toggle blacklist item:', error);
      alert('Failed to toggle item.');
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      await apiClient.put(`/admin/users/${userId}/toggle-status`);
      loadData();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      alert('Failed to toggle user status.');
    }
  };

  // Bulk selection functions
  const selectAllGlossary = () => {
    setSelectedGlossaryIds(filteredGlossary.map(g => g.id));
  };

  const unselectAllGlossary = () => {
    setSelectedGlossaryIds([]);
  };

  const deleteSelectedGlossary = async () => {
    if (selectedGlossaryIds.length === 0) return;
    
    showConfirm(
      'Delete Selected Glossary Terms',
      `Delete ${selectedGlossaryIds.length} selected glossary terms? This will remove them for ALL users.`,
      async () => {
        try {
          await Promise.all(selectedGlossaryIds.map(id => 
            apiClient.delete(`/admin/default-glossary/${id}`)
          ));
          setSelectedGlossaryIds([]);
          loadData();
        } catch (error) {
          console.error('Failed to delete selected items:', error);
          alert('Failed to delete some items.');
        }
      },
      'Delete All',
      'Cancel'
    );
  };

  const selectAllBlacklist = () => {
    setSelectedBlacklistIds(filteredBlacklist.map(b => b.id));
  };

  const unselectAllBlacklist = () => {
    setSelectedBlacklistIds([]);
  };

  const deleteSelectedBlacklist = async () => {
    if (selectedBlacklistIds.length === 0) return;
    
    showConfirm(
      'Delete Selected Blacklist Terms',
      `Delete ${selectedBlacklistIds.length} selected blacklist terms? This will remove protection for ALL users.`,
      async () => {
        try {
          await Promise.all(selectedBlacklistIds.map(id => 
            apiClient.delete(`/admin/default-blacklist/${id}`)
          ));
          setSelectedBlacklistIds([]);
          loadData();
        } catch (error) {
          console.error('Failed to delete selected items:', error);
          alert('Failed to delete some items.');
        }
      },
      'Delete All',
      'Cancel'
    );
  };

  // Import handlers
  const openImportWizard = (type: 'glossary' | 'blacklist') => {
    setImportType(type);
    setImportStep('upload');
    setImportFile(null);
    setPreviewData(null);
    setSourceCol(-1);
    setTargetCol(-1);
    setShowImportWizard(true);
  };

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
        const headers = preview.headers.map((h: string) => h.toLowerCase());
        const guessSource = headers.findIndex((h: string) => h.includes('japanese') || h.includes('source') || h.includes('term'));
        const guessTarget = headers.findIndex((h: string) => h.includes('vietnamese') || h.includes('target') || h.includes('trans') || h.includes('description'));
        if (guessSource >= 0) setSourceCol(guessSource);
        if (guessTarget >= 0) setTargetCol(guessTarget);
      } catch (err) {
        console.error(err);
        alert('Failed to read Excel file.');
      } finally {
        setImportLoading(false);
      }
    }
    if (glossaryFileRef.current) glossaryFileRef.current.value = '';
    if (blacklistFileRef.current) blacklistFileRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importFile || sourceCol === -1 || (importType === 'glossary' && targetCol === -1)) {
      alert("Please select the required columns.");
      return;
    }
    
    setImportLoading(true);
    try {
      if (importType === 'glossary') {
        const items = await parseGlossaryByColumns(importFile, sourceCol, targetCol);
        
        // Batch upload to backend (1 request instead of N requests)
        await apiClient.post('/admin/default-glossary/batch', items.map(item => ({
          term: item.term,
          translation: item.translation,
        })));
        
        alert(`✅ Imported ${items.length} glossary terms successfully.`);
      } else {
        const items = await parseBlacklistFromExcel(importFile, sourceCol, targetCol);
        
        // Batch upload to backend (1 request instead of N requests)
        await apiClient.post('/admin/default-blacklist/batch', items.map(item => ({
          term: item.term,
          description: item.description || '',
          caseSensitive: item.caseSensitive || false,
        })));
        
        alert(`✅ Imported ${items.length} blacklist terms successfully.`);
      }
      
      // Reset and reload
      setShowImportWizard(false);
      setImportStep('upload');
      setImportFile(null);
      setPreviewData(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to process import.');
    } finally {
      setImportLoading(false);
    }
  };

  const filteredGlossary = defaultGlossary.filter(g => 
    g.term.toLowerCase().includes(glossarySearch.toLowerCase()) || 
    g.translation.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  const filteredBlacklist = defaultBlacklist.filter(b => 
    b.term.toLowerCase().includes(blacklistSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-600 to-blue-600">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-white" />
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-3 bg-slate-800/50 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('glossary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'glossary'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Book className="w-4 h-4" />
            Default Glossary
          </button>
          <button
            onClick={() => setActiveTab('blacklist')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'blacklist'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Default Blacklist
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            User Management
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>
          ) : (
            <>
              {/* Default Glossary Tab */}
              {activeTab === 'glossary' && (
                <div className="flex flex-col h-full gap-4">
                  {/* Input Form */}
                  <div className="flex gap-2 items-center bg-slate-700/20 p-3 rounded border border-slate-700/50">
                    <input 
                      value={glossaryTerm} 
                      onChange={e => setGlossaryTerm(e.target.value)} 
                      placeholder="Term (Source)" 
                      className="bg-slate-900 border border-slate-700 rounded p-2 flex-1 text-sm outline-none focus:border-blue-500" 
                    />
                    <input 
                      value={glossaryTranslation} 
                      onChange={e => setGlossaryTranslation(e.target.value)} 
                      placeholder="Translation" 
                      className="bg-slate-900 border border-slate-700 rounded p-2 flex-1 text-sm outline-none focus:border-blue-500" 
                    />
                    <button 
                      onClick={handleSaveGlossary} 
                      className={`flex items-center gap-2 ${editingGlossaryId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'} p-2 rounded text-white text-sm transition-colors`}
                    >
                      {editingGlossaryId ? <><Save className="w-4 h-4" /> Update</> : <><Plus className="w-4 h-4" /> Add</>}
                    </button>
                    {editingGlossaryId && (
                      <button onClick={cancelEditGlossary} className="bg-slate-600 hover:bg-slate-500 p-2 rounded text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Search */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input 
                        value={glossarySearch} 
                        onChange={e => setGlossarySearch(e.target.value)} 
                        placeholder="Search..." 
                        className="w-full bg-slate-900 border border-slate-700 rounded pl-9 p-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => openImportWizard('glossary')}
                      className="bg-green-600 hover:bg-green-500 text-white p-2 rounded flex items-center gap-2 text-sm transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Import
                    </button>
                  </div>

                  {/* Bulk Actions */}
                  {selectedGlossaryIds.length > 0 && (
                    <div className="flex gap-2 items-center justify-between p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                      <span className="text-sm text-blue-300">{selectedGlossaryIds.length} selected</span>
                      <div className="flex gap-2">
                        <button onClick={unselectAllGlossary} className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded">
                          Unselect All
                        </button>
                        <button onClick={deleteSelectedGlossary} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded">
                          Delete Selected
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List */}
                  <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar border border-slate-700/50 rounded p-2 bg-slate-900/30">
                    {filteredGlossary.length === 0 ? 
                      <p className="text-slate-500 text-sm italic text-center mt-8">No default glossary terms. Add one above.</p> :
                      filteredGlossary.map(g => (
                        <div key={g.id} className={`flex justify-between items-center p-2 rounded text-sm group ${editingGlossaryId === g.id ? 'border border-orange-500/50 bg-orange-900/10' : selectedGlossaryIds.includes(g.id) ? 'bg-blue-900/20 border border-blue-500/30' : 'bg-slate-700/50'}`}>
                          <div className="flex items-center gap-2 flex-1">
                            <input 
                              type="checkbox" 
                              checked={selectedGlossaryIds.includes(g.id)} 
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedGlossaryIds(prev => 
                                  prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]
                                );
                              }}
                              className="w-4 h-4 rounded"
                              title="Select for bulk action"
                            />
                            <button
                              onClick={() => toggleGlossaryActive(g)}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                g.isActive ? 'bg-green-500 border-green-500' : 'bg-slate-600 border-slate-500'
                              }`}
                              title="Toggle active/inactive"
                            >
                              {g.isActive && (
                                <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                  <path d="M5 13l4 4L19 7"></path>
                                </svg>
                              )}
                            </button>
                            <span className={`text-blue-300 font-medium ${!g.isActive ? 'line-through opacity-50' : ''}`}>
                              {g.term}
                            </span>
                            <span className="text-slate-500">→</span>
                            <span className={`text-slate-300 ${!g.isActive ? 'line-through opacity-50' : ''}`}>
                              {g.translation}
                            </span>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditGlossary(g)} className="text-slate-400 hover:text-orange-400 p-1">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteGlossaryItem(g.id)} className="text-slate-400 hover:text-red-400 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  {/* Footer stats */}
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Total: {defaultGlossary.length} terms ({defaultGlossary.filter(g => g.isActive).length} active)</span>
                    <div className="flex gap-2">
                      {selectedGlossaryIds.length > 0 && (
                        <button onClick={unselectAllGlossary} className="text-blue-400 hover:underline">
                          Unselect All
                        </button>
                      )}
                      {filteredGlossary.length > 0 && (
                        <button onClick={selectAllGlossary} className="text-blue-400 hover:underline">
                          Select All ({filteredGlossary.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Default Blacklist Tab */}
              {activeTab === 'blacklist' && (
                <div className="flex flex-col h-full gap-4">
                  {/* Input Form */}
                  <div className="flex flex-col gap-2 bg-slate-700/20 p-3 rounded border border-slate-700/50">
                    <input 
                      value={blacklistTerm} 
                      onChange={e => setBlacklistTerm(e.target.value)} 
                      placeholder="Protected term (e.g., API_KEY, password)" 
                      className="bg-slate-900 border border-slate-700 rounded p-2 text-sm outline-none focus:border-red-500" 
                    />
                    <input 
                      value={blacklistDesc} 
                      onChange={e => setBlacklistDesc(e.target.value)} 
                      placeholder="Description (optional)" 
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
                        onClick={handleSaveBlacklist} 
                        className={`flex-1 ${editingBlacklistId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-red-600 hover:bg-red-500'} p-2 rounded text-white text-sm transition-colors flex items-center justify-center gap-2`}
                      >
                        {editingBlacklistId ? <><Save className="w-4 h-4" /> Update</> : <><Plus className="w-4 h-4" /> Add Term</>}
                      </button>
                      {editingBlacklistId && (
                        <button onClick={cancelEditBlacklist} className="bg-slate-600 hover:bg-slate-500 p-2 rounded text-white">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input 
                        value={blacklistSearch} 
                        onChange={e => setBlacklistSearch(e.target.value)} 
                        placeholder="Search..." 
                        className="w-full bg-slate-900 border border-slate-700 rounded pl-9 p-2 text-sm outline-none focus:border-red-500"
                      />
                    </div>
                    <button
                      onClick={() => openImportWizard('blacklist')}
                      className="bg-green-600 hover:bg-green-500 text-white p-2 rounded flex items-center gap-2 text-sm transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Import
                    </button>
                  </div>

                  {/* Bulk Actions */}
                  {selectedBlacklistIds.length > 0 && (
                    <div className="flex gap-2 items-center justify-between p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                      <span className="text-sm text-blue-300">{selectedBlacklistIds.length} selected</span>
                      <div className="flex gap-2">
                        <button onClick={unselectAllBlacklist} className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded">
                          Unselect All
                        </button>
                        <button onClick={deleteSelectedBlacklist} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded">
                          Delete Selected
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List */}
                  <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar border border-slate-700/50 rounded p-2 bg-slate-900/30">
                    {defaultBlacklist.length === 0 ? 
                      <p className="text-slate-500 text-sm italic text-center mt-8">No default blacklist terms. Add one above.</p> :
                      filteredBlacklist.length === 0 ? 
                      <p className="text-slate-500 text-sm italic text-center mt-8">No matches found.</p> :
                      filteredBlacklist.map(b => (
                        <div key={b.id} className={`flex justify-between items-center p-2 rounded text-sm group ${editingBlacklistId === b.id ? 'border border-orange-500/50 bg-orange-900/10' : selectedBlacklistIds.includes(b.id) ? 'bg-blue-900/20 border border-blue-500/30' : 'bg-slate-700/50'}`}>
                          <div className="flex items-center gap-2 flex-1">
                            <input 
                              type="checkbox" 
                              checked={selectedBlacklistIds.includes(b.id)} 
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedBlacklistIds(prev => 
                                  prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                                );
                              }}
                              className="w-4 h-4 rounded"
                              title="Select for bulk action"
                            />
                            <button
                              onClick={() => toggleBlacklistActive(b)}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                b.isActive ? 'bg-green-500 border-green-500' : 'bg-slate-600 border-slate-500'
                              }`}
                              title="Toggle active/inactive"
                            >
                              {b.isActive && (
                                <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                  <path d="M5 13l4 4L19 7"></path>
                                </svg>
                              )}
                            </button>
                            <div className="flex-1">
                              <span className={`text-red-300 font-medium ${!b.isActive ? 'line-through opacity-50' : ''}`}>
                                {b.term}
                              </span>
                              {b.caseSensitive && <span className="ml-2 text-[10px] bg-slate-600 px-1 py-0.5 rounded text-slate-300">Aa</span>}
                              {b.description && (
                                <div className="text-xs text-slate-500 mt-0.5">{b.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditBlacklist(b)} className="text-slate-400 hover:text-orange-400 p-1">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteBlacklistItem(b.id)} className="text-slate-400 hover:text-red-400 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  {/* Footer stats */}
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Total: {defaultBlacklist.length} terms ({defaultBlacklist.filter(b => b.isActive).length} active) • Applies to ALL users</span>
                    {filteredBlacklist.length > 0 && (
                      <button onClick={selectAllBlacklist} className="text-blue-400 hover:underline">
                        Select All ({filteredBlacklist.length})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* User Management Tab */}
              {activeTab === 'users' && (
                <div className="bg-slate-800/50 rounded-lg overflow-hidden h-full">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="text-left p-3 text-slate-300 text-sm">Email</th>
                        <th className="text-center p-3 text-slate-300 text-sm">Role</th>
                        <th className="text-center p-3 text-slate-300 text-sm">Status</th>
                        <th className="text-center p-3 text-slate-300 text-sm">Joined</th>
                        <th className="text-center p-3 text-slate-300 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3 text-white text-sm">{user.email}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              user.role.name === 'admin' 
                                ? 'bg-purple-600/20 text-purple-400'
                                : user.role.name === 'leader'
                                ? 'bg-blue-600/20 text-blue-400'
                                : user.role.name === 'dev'
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-slate-600/20 text-slate-400'
                            }`}>
                              {user.role.name}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs ${
                                user.isActive
                                  ? 'bg-green-600/20 text-green-400'
                                  : 'bg-red-600/20 text-red-400'
                              }`}
                            >
                              {user.isActive ? '✅ Active' : '❌ Blocked'}
                            </span>
                          </td>
                          <td className="p-3 text-center text-slate-400 text-xs">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleUserStatus(user.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                user.isActive
                                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                                  : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                              }`}
                            >
                              {user.isActive ? 'Block User' : 'Unblock User'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Import Wizard Modal */}
      {showImportWizard && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
                Import {importType === 'glossary' ? 'Glossary' : 'Blacklist'} from Excel
              </h3>
              <button onClick={() => setShowImportWizard(false)}>
                <X className="text-slate-400 hover:text-white w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {importStep === 'upload' && (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-lg p-12 hover:bg-slate-700/20 transition-colors cursor-pointer"
                     onClick={() => (importType === 'glossary' ? glossaryFileRef : blacklistFileRef).current?.click()}>
                  <input 
                    type="file" 
                    accept=".xlsx,.xls" 
                    ref={importType === 'glossary' ? glossaryFileRef : blacklistFileRef}
                    className="hidden" 
                    onChange={handleFileSelect} 
                  />
                  {importLoading ? (
                    <div className="text-blue-400 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                      <p>Reading file...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-slate-500 mb-3" />
                      <p className="text-slate-300 font-medium mb-2">Click to upload Excel file</p>
                      <p className="text-xs text-slate-500 text-center">
                        Supports .xlsx and .xls files<br />
                        First row must be column headers
                      </p>
                    </>
                  )}
                </div>
              )}

              {importStep === 'mapping' && previewData && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 bg-slate-700 px-3 py-1 rounded">
                      📄 {importFile?.name}
                    </span>
                    <button 
                      onClick={() => { setImportStep('upload'); setImportFile(null); }} 
                      className="text-blue-400 hover:underline"
                    >
                      Change File
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Column for <b>{importType === 'glossary' ? 'Term (Source)' : 'Protected Term'}</b>:
                      </label>
                      <select 
                        value={sourceCol} 
                        onChange={e => setSourceCol(Number(e.target.value))} 
                        className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm text-white"
                      >
                        <option value={-1}>-- Select Column --</option>
                        {previewData.headers.map((h: string, i: number) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {importType === 'glossary' && (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Column for <b>Translation</b>:
                        </label>
                        <select 
                          value={targetCol} 
                          onChange={e => setTargetCol(Number(e.target.value))} 
                          className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm text-white"
                        >
                          <option value={-1}>-- Select Column --</option>
                          {previewData.headers.map((h: string, i: number) => (
                            <option key={i} value={i}>{h}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {importType === 'blacklist' && targetCol >= 0 && (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Column for <b>Description</b> (optional):
                        </label>
                        <select 
                          value={targetCol} 
                          onChange={e => setTargetCol(Number(e.target.value))} 
                          className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-sm text-white"
                        >
                          <option value={-1}>-- None --</option>
                          {previewData.headers.map((h: string, i: number) => (
                            <option key={i} value={i}>{h}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900 rounded p-3 border border-slate-700 max-h-48 overflow-auto">
                    <p className="text-xs text-slate-400 mb-2">Preview (first 5 rows):</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          {previewData.headers.map((h: string, i: number) => (
                            <th key={i} className="text-left p-1 text-slate-300">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows && previewData.rows.slice(0, 5).map((row: any[], i: number) => (
                          <tr key={i} className="border-b border-slate-800">
                            {row.map((cell, j) => (
                              <td key={j} className="p-1 text-slate-400">{cell || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setImportStep('upload')}
                      className="flex-1 bg-slate-600 hover:bg-slate-500 text-white p-2 rounded text-sm transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importLoading || sourceCol === -1 || (importType === 'glossary' && targetCol === -1)}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white p-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {importLoading ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Confirm Import
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
