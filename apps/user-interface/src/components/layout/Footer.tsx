import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">LUSDT Bridge</h3>
                <p className="text-sm text-gray-500">Cross-chain USDT bridge</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4 max-w-md">
              Seamlessly bridge USDT between Solana and Lunes networks with low fees, 
              fast transactions, and enterprise-grade security.
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500 font-medium">Bridge Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Uptime:</span>
                <span className="text-xs text-green-600 font-medium">99.9%</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <a href="/bridge" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Bridge Tokens
                </a>
              </li>
              <li>
                <a href="/history" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Transaction History
                </a>
              </li>
              <li>
                <a href="/settings" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Settings
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  API Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Support & Resources */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Contact Support
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Status Page
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  Bug Reports
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Network Status Bar */}
        <div className="border-t border-gray-200 pt-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Network Status</h4>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-purple-500 rounded-full flex items-center justify-center">
                    <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
                  </div>
                  <span className="text-sm text-gray-600">Solana</span>
                  <span className="text-xs text-green-600 font-medium">Operational</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
                  </div>
                  <span className="text-sm text-gray-600">Lunes</span>
                  <span className="text-xs text-green-600 font-medium">Operational</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse"></div>
                  </div>
                  <span className="text-sm text-gray-600">Bridge Service</span>
                  <span className="text-xs text-green-600 font-medium">Online</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Last updated</div>
              <div className="text-xs text-gray-500">
                {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-500">
                © {currentYear} LUSDT Bridge. All rights reserved.
              </div>
              <div className="flex items-center space-x-4">
                <a
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-150"
                >
                  Privacy Policy
                </a>
                <a
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-150"
                >
                  Terms of Service
                </a>
                <a
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-150"
                >
                  Security
                </a>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-xs text-gray-500">Version 1.0.0</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Built with</span>
                <span className="text-xs text-blue-600 font-medium">React</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-blue-600 font-medium">TypeScript</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-blue-600 font-medium">Tailwind</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;