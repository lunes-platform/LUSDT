import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { routes } from './utils/routes';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.component />}
            />
          ))}
          {/* 404 Route */}
          <Route
            path="*"
            element={
              <div className="text-center py-12">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                  Page Not Found
                </h1>
                <p className="text-gray-600 mb-6">
                  The page you're looking for doesn't exist.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go Home
                </a>
              </div>
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;