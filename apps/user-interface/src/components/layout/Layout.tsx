import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import Breadcrumb from './Breadcrumb';
import MobileNav from './MobileNav';
import { getRouteByPath } from '../../utils/routes';
import type { BreadcrumbItem } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentRoute = getRouteByPath(location.pathname);
  
  // Generate breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: 'Home', href: '/' },
    ...(currentRoute && currentRoute.path !== '/' 
      ? [{ name: currentRoute.title, current: true }] 
      : []
    )
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      <div className="flex flex-1">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
        
        <main className="flex-1 lg:ml-64 pb-16 lg:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            {breadcrumbItems.length > 1 && (
              <div className="mb-6">
                <Breadcrumb items={breadcrumbItems} />
              </div>
            )}
            
            {/* Page Content */}
            <div className="animate-fade-in">
              {children}
            </div>
          </div>
        </main>
      </div>
      
      <Footer />
      
      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
};

export default Layout;