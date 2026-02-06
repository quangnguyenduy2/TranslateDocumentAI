import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Edit2, Users, Shield } from 'lucide-react';

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
}

export const AdminPage: React.FC<AdminPageProps> = ({ apiClient, onClose }) => {
  const [activeTab, setActiveTab] = useState<'glossary' | 'blacklist' | 'users'>('glossary');
  const [defaultGlossary, setDefaultGlossary] = useState<DefaultGlossaryItem[]>([]);
  const [defaultBlacklist, setDefaultBlacklist] = useState<DefaultBlacklistItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // New item forms
  const [newGlossaryTerm, setNewGlossaryTerm] = useState('');
  const [newGlossaryTranslation, setNewGlossaryTranslation] = useState('');
  const [newBlacklistTerm, setNewBlacklistTerm] = useState('');
  const [newBlacklistDesc, setNewBlacklistDesc] = useState('');

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
    } finally {
      setLoading(false);
    }
  };

  const addGlossaryItem = async () => {
    if (!newGlossaryTerm || !newGlossaryTranslation) return;
    try {
      await apiClient.post('/admin/default-glossary', {
        term: newGlossaryTerm,
        translation: newGlossaryTranslation,
      });
      setNewGlossaryTerm('');
      setNewGlossaryTranslation('');
      loadData();
    } catch (error) {
      console.error('Failed to add glossary item:', error);
    }
  };

  const deleteGlossaryItem = async (id: string) => {
    try {
      await apiClient.delete(`/admin/default-glossary/${id}`);
      loadData();
    } catch (error) {
      console.error('Failed to delete glossary item:', error);
    }
  };

  const toggleGlossaryActive = async (item: DefaultGlossaryItem) => {
    try {
      await apiClient.put(`/admin/default-glossary/${item.id}`, {
        isActive: !item.isActive,
      });
      loadData();
    } catch (error) {
      console.error('Failed to toggle glossary item:', error);
    }
  };

  const addBlacklistItem = async () => {
    if (!newBlacklistTerm) return;
    try {
      await apiClient.post('/admin/default-blacklist', {
        term: newBlacklistTerm,
        description: newBlacklistDesc,
      });
      setNewBlacklistTerm('');
      setNewBlacklistDesc('');
      loadData();
    } catch (error) {
      console.error('Failed to add blacklist item:', error);
    }
  };

  const deleteBlacklistItem = async (id: string) => {
    try {
      await apiClient.delete(`/admin/default-blacklist/${id}`);
      loadData();
    } catch (error) {
      console.error('Failed to delete blacklist item:', error);
    }
  };

  const toggleBlacklistActive = async (item: DefaultBlacklistItem) => {
    try {
      await apiClient.put(`/admin/default-blacklist/${item.id}`, {
        isActive: !item.isActive,
      });
      loadData();
    } catch (error) {
      console.error('Failed to toggle blacklist item:', error);
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      await apiClient.put(`/admin/users/${userId}/toggle-status`);
      loadData();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800 px-6 py-3 flex gap-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'glossary'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Default Glossary
          </button>
          <button
            onClick={() => setActiveTab('blacklist')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'blacklist'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Default Blacklist
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            User Management
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : (
            <>
              {/* Default Glossary Tab */}
              {activeTab === 'glossary' && (
                <div>
                  <div className="mb-6 bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-white font-medium mb-3">Add New Default Term</h3>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Term (e.g., AI)"
                        value={newGlossaryTerm}
                        onChange={(e) => setNewGlossaryTerm(e.target.value)}
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Translation (e.g., Trí tuệ nhân tạo)"
                        value={newGlossaryTranslation}
                        onChange={(e) => setNewGlossaryTranslation(e.target.value)}
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                      />
                      <button
                        onClick={addGlossaryItem}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="text-left p-3 text-gray-300">Term</th>
                          <th className="text-left p-3 text-gray-300">Translation</th>
                          <th className="text-center p-3 text-gray-300">Status</th>
                          <th className="text-center p-3 text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {defaultGlossary.map((item) => (
                          <tr key={item.id} className="border-t border-gray-700 hover:bg-gray-750">
                            <td className="p-3 text-white">{item.term}</td>
                            <td className="p-3 text-white">{item.translation}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => toggleGlossaryActive(item)}
                                className={`px-3 py-1 rounded-full text-sm ${
                                  item.isActive
                                    ? 'bg-green-600/20 text-green-400'
                                    : 'bg-gray-600/20 text-gray-400'
                                }`}
                              >
                                {item.isActive ? '✅ Active' : '❌ Inactive'}
                              </button>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => deleteGlossaryItem(item.id)}
                                className="text-red-400 hover:text-red-300 p-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Default Blacklist Tab */}
              {activeTab === 'blacklist' && (
                <div>
                  <div className="mb-6 bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-white font-medium mb-3">Add New Protected Term</h3>
                    <div className="flex gap-3 mb-2">
                      <input
                        type="text"
                        placeholder="Term to protect (e.g., API_KEY)"
                        value={newBlacklistTerm}
                        onChange={(e) => setNewBlacklistTerm(e.target.value)}
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={newBlacklistDesc}
                        onChange={(e) => setNewBlacklistDesc(e.target.value)}
                        className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                      />
                      <button
                        onClick={addBlacklistItem}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="text-left p-3 text-gray-300">Term</th>
                          <th className="text-left p-3 text-gray-300">Description</th>
                          <th className="text-center p-3 text-gray-300">Status</th>
                          <th className="text-center p-3 text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {defaultBlacklist.map((item) => (
                          <tr key={item.id} className="border-t border-gray-700 hover:bg-gray-750">
                            <td className="p-3 text-white font-mono">{item.term}</td>
                            <td className="p-3 text-gray-400">{item.description || '-'}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => toggleBlacklistActive(item)}
                                className={`px-3 py-1 rounded-full text-sm ${
                                  item.isActive
                                    ? 'bg-green-600/20 text-green-400'
                                    : 'bg-gray-600/20 text-gray-400'
                                }`}
                              >
                                {item.isActive ? '✅ Active' : '❌ Inactive'}
                              </button>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => deleteBlacklistItem(item.id)}
                                className="text-red-400 hover:text-red-300 p-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* User Management Tab */}
              {activeTab === 'users' && (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="text-left p-3 text-gray-300">Email</th>
                        <th className="text-center p-3 text-gray-300">Role</th>
                        <th className="text-center p-3 text-gray-300">Status</th>
                        <th className="text-center p-3 text-gray-300">Joined</th>
                        <th className="text-center p-3 text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t border-gray-700 hover:bg-gray-750">
                          <td className="p-3 text-white">{user.email}</td>
                          <td className="p-3 text-center">
                            <span className="px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 text-sm">
                              {user.role.name}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-sm ${
                                user.isActive
                                  ? 'bg-green-600/20 text-green-400'
                                  : 'bg-red-600/20 text-red-400'
                              }`}
                            >
                              {user.isActive ? 'Active' : 'Blocked'}
                            </span>
                          </td>
                          <td className="p-3 text-center text-gray-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleUserStatus(user.id)}
                              className={`px-3 py-1 rounded-lg text-sm ${
                                user.isActive
                                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                                  : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                              }`}
                            >
                              {user.isActive ? 'Block' : 'Unblock'}
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
    </div>
  );
};
