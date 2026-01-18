import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import { Toaster } from '@/components/ui/toaster';
import { LoginPage, DashboardPage, FieldsPage, UnauthorizedPage, WorkforcePage, FinancialPage } from '@/pages';
import { useAuthInit } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

// Placeholder pages for navigation
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        This page is under construction. Check back soon!
      </p>
    </div>
  );
}

// Auth initialization wrapper
function AuthInitializer({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return <>{children}</>;
}

// Global loading screen
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes with main layout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/fields" element={<FieldsPage />} />
        <Route path="/equipment" element={<PlaceholderPage title="Equipment" />} />
        <Route path="/resources" element={<PlaceholderPage title="Resources" />} />
        <Route path="/financial" element={<FinancialPage />} />
        <Route path="/workforce" element={<WorkforcePage />} />
        <Route path="/maintenance" element={<PlaceholderPage title="Maintenance" />} />
        <Route path="/weather" element={<PlaceholderPage title="Weather" />} />
        <Route path="/recommendations" element={<PlaceholderPage title="Recommendations" />} />
      </Route>

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthInitializer>
        <AppRoutes />
        <Toaster />
      </AuthInitializer>
    </BrowserRouter>
  );
}

export default App;
