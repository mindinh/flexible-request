import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './layouts';
import { GlobalErrorBoundary, GlobalToast } from './components/shared';
import { PageLoadingSkeleton } from './components/ui';
import { AuthProvider } from './lib/auth-context';

// Lazy load feature components for better code splitting
const RequestList = lazy(() =>
  import('./features/requests/RequestList').then(m => ({ default: m.RequestList }))
);
const DynamicRequestForm = lazy(() =>
  import('./features/requests/DynamicRequestForm').then(m => ({ default: m.DynamicRequestForm }))
);
const RequestDetail = lazy(() =>
  import('./features/requests/RequestDetail').then(m => ({ default: m.RequestDetail }))
);
const Inbox = lazy(() =>
  import('./features/inbox/Inbox').then(m => ({ default: m.Inbox }))
);
const RequestTypeLanding = lazy(() =>
  import('./features/studio/RequestTypeLanding').then(m => ({ default: m.RequestTypeLanding }))
);
const RequestTypeStudio = lazy(() =>
  import('./features/studio/RequestTypeStudio').then(m => ({ default: m.RequestTypeStudio }))
);
const OrganizationPage = lazy(() =>
  import('./features/organization/OrganizationPage').then(m => ({ default: m.OrganizationPage }))
);
const WikiPage = lazy(() =>
  import('./features/wiki/WikiPage').then(m => ({ default: m.WikiPage }))
);

/**
 * Suspense wrapper with loading fallback
 */
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      {children}
    </Suspense>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <GlobalToast />
        <BrowserRouter basename="/">
          <Routes>
            {/* Handle direct navigation to /index.html (from BTP approuter) */}
            <Route path="/index.html" element={<Navigate to="/" replace />} />

            {/* Studio Detail Route (standalone full-screen layout for editing) */}
            <Route
              path="/studio/:id"
              element={
                <SuspenseWrapper>
                  <RequestTypeStudio />
                </SuspenseWrapper>
              }
            />

            {/* Main App Routes with AppShell (unified sidebar navigation) */}
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/requests" replace />} />
              <Route
                path="/requests"
                element={
                  <SuspenseWrapper>
                    <RequestList />
                  </SuspenseWrapper>
                }
              />
              <Route
                path="/requests/create/:typeId"
                element={
                  <SuspenseWrapper>
                    <DynamicRequestForm />
                  </SuspenseWrapper>
                }
              />
              <Route
                path="/requests/:id"
                element={
                  <SuspenseWrapper>
                    <RequestDetail />
                  </SuspenseWrapper>
                }
              />
              <Route
                path="/requests/:id/edit"
                element={
                  <SuspenseWrapper>
                    <DynamicRequestForm />
                  </SuspenseWrapper>
                }
              />
              <Route
                path="/inbox"
                element={
                  <SuspenseWrapper>
                    <Inbox />
                  </SuspenseWrapper>
                }
              />
              {/* Studio Landing (Request Type list) */}
              <Route
                path="/studio"
                element={
                  <SuspenseWrapper>
                    <RequestTypeLanding />
                  </SuspenseWrapper>
                }
              />
              {/* Organization Management */}
              <Route
                path="/organization"
                element={
                  <SuspenseWrapper>
                    <OrganizationPage />
                  </SuspenseWrapper>
                }
              />
              {/* Wiki Documentation */}
              <Route
                path="/wiki/*"
                element={
                  <SuspenseWrapper>
                    <WikiPage />
                  </SuspenseWrapper>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GlobalErrorBoundary >
  );
}

export default App;
