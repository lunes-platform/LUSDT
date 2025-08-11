import React, { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'networks' | 'privacy'>('general');
  const { 
    preferences, 
    updatePreferences, 
    saveSettings, 
    resetToDefaults, 
    isLoading, 
    hasUnsavedChanges, 
    error,
    clearError 
  } = useSettingsStore();

  const handleToggle = (path: string, value: boolean) => {
    const keys = path.split('.');
    if (keys.length === 2) {
      updatePreferences({
        [keys[0]]: {
          [keys[1]]: value
        }
      } as any);
    }
  };

  const handleSelectChange = (path: string, value: string) => {
    const keys = path.split('.');
    if (keys.length === 2) {
      updatePreferences({
        [keys[0]]: {
          [keys[1]]: value
        }
      } as any);
    } else if (keys.length === 1) {
      updatePreferences({
        [keys[0]]: value
      } as any);
    }
  };

  const tabs = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'networks', name: 'Networks', icon: '🌐' },
    { id: 'privacy', name: 'Privacy', icon: '🔒' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your preferences and account settings
        </p>
      </div>
      
      {/* Settings Navigation */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Content */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-5">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">General Preferences</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Theme
                    </label>
                    <select
                      value={preferences.theme}
                      onChange={(e) => handleSelectChange('theme', e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      value={preferences.display.currency}
                      onChange={(e) => handleSelectChange('display.currency', e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language
                    </label>
                    <select
                      value={preferences.display.language}
                      onChange={(e) => handleSelectChange('display.language', e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="pt">Português</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Compact Mode
                      </label>
                      <p className="text-sm text-gray-500">
                        Use a more compact interface layout
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('display.compactMode', !preferences.display.compactMode)}
                      className={`${
                        preferences.display.compactMode ? 'bg-blue-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      role="switch"
                      aria-checked={preferences.display.compactMode}
                    >
                      <span className={`${
                        preferences.display.compactMode ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Enable Notifications
                      </label>
                      <p className="text-sm text-gray-500">
                        Receive notifications for important updates
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('notifications.enabled', !preferences.notifications.enabled)}
                      className={`${
                        preferences.notifications.enabled ? 'bg-blue-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      role="switch"
                      aria-checked={preferences.notifications.enabled}
                    >
                      <span className={`${
                        preferences.notifications.enabled ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Transaction Updates
                      </label>
                      <p className="text-sm text-gray-500">
                        Get notified when transactions complete or fail
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('notifications.transactionUpdates', !preferences.notifications.transactionUpdates)}
                      className={`${
                        preferences.notifications.transactionUpdates ? 'bg-blue-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      role="switch"
                      aria-checked={preferences.notifications.transactionUpdates}
                    >
                      <span className={`${
                        preferences.notifications.transactionUpdates ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Email Notifications
                      </label>
                      <p className="text-sm text-gray-500">
                        Receive notifications via email
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('notifications.email', !preferences.notifications.email)}
                      className={`${
                        preferences.notifications.email ? 'bg-blue-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      role="switch"
                      aria-checked={preferences.notifications.email}
                    >
                      <span className={`${
                        preferences.notifications.email ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'networks' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Network Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Solana Network
                    </label>
                    <select
                      value={preferences.networks.solana.network}
                      onChange={(e) => handleSelectChange('networks.solana.network', e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="devnet">Devnet</option>
                      <option value="mainnet-beta">Mainnet Beta</option>
                      <option value="testnet">Testnet</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lunes Network
                    </label>
                    <select
                      value={preferences.networks.lunes.network}
                      onChange={(e) => handleSelectChange('networks.lunes.network', e.target.value)}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="mainnet">Mainnet</option>
                      <option value="testnet">Testnet</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Privacy Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Analytics
                      </label>
                      <p className="text-sm text-gray-500">
                        Help improve the app by sharing usage data
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('privacy.analytics', !preferences.privacy.analytics)}
                      className={`${
                        preferences.privacy.analytics ? 'bg-blue-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      role="switch"
                      aria-checked={preferences.privacy.analytics}
                    >
                      <span className={`${
                        preferences.privacy.analytics ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Crash Reporting
                      </label>
                      <p className="text-sm text-gray-500">
                        Automatically send crash reports to help fix bugs
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle('privacy.crashReporting', !preferences.privacy.crashReporting)}
                      className={`${
                        preferences.privacy.crashReporting ? 'bg-blue-600' : 'bg-gray-200'
                      } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      role="switch"
                      aria-checked={preferences.privacy.crashReporting}
                    >
                      <span className={`${
                        preferences.privacy.crashReporting ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex justify-between items-center">
            <button
              onClick={resetToDefaults}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Reset to Defaults
            </button>
            
            <div className="flex space-x-3">
              {hasUnsavedChanges && (
                <span className="text-sm text-amber-600">
                  You have unsaved changes
                </span>
              )}
              <button
                onClick={saveSettings}
                disabled={isLoading || !hasUnsavedChanges}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  hasUnsavedChanges && !isLoading
                    ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                }`}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;