import React, { useEffect } from 'react';
import { authAPI } from '../services/apiClient';

export const GoogleCallback: React.FC = () => {
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (token) {
        localStorage.setItem('accessToken', token);
        
        // Fetch user's API key
        try {
          const apiKeyResponse = await authAPI.getApiKey();
          if (apiKeyResponse.data.apiKey) {
            localStorage.setItem('user_api_key', apiKeyResponse.data.apiKey);
          }
        } catch (error) {
          console.error('Failed to fetch API key:', error);
        }

        // Redirect to main app
        window.location.href = '/';
      } else {
        // Error handling - redirect to home
        window.location.href = '/';
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-white text-lg">Signing in with Google...</div>
    </div>
  );
};
