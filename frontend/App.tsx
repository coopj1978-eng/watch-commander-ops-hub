import { useEffect, useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import People from "./pages/People";
import ProfileDetail from "./pages/ProfileDetail";
import UnifiedCalendar from "./pages/WatchCalendar";
import Tasks from "./pages/Tasks";
import Targets from "./pages/Targets";
import Policies from "./pages/Policies";
import PolicyQA from "./pages/PolicyQA";
import Reports from "./pages/Reports";
import QuarterlyReport from "./pages/QuarterlyReport";
import QuarterlyReportPrint from "./pages/QuarterlyReportPrint";
import AdminPanel from "./pages/AdminPanel";
import Settings from "./pages/Settings";
import EquipmentChecks from "./pages/EquipmentChecks";
import StaffPortal from "./pages/StaffPortal";
import CrewCommanderHome from "./pages/CrewCommanderHome";
import HandoverPage from "./pages/Handover";
import DetachmentsPage from "./pages/Detachments";
import Resources from "./pages/Resources";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { backendClient } from "./lib/backend";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  watch_unit?: string; // e.g. "Red" | "White" | "Green" | "Blue" | "Amber"
}

interface AuthContextType {
  user: AuthUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoaded: false,
  isSignedIn: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function App() {
  console.log("App rendering");
  useEffect(() => {
    const themeData = getStoredTheme();
    applyTheme(themeData.mode, themeData.customColors);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

function AppInner() {
  console.log("AppInner rendering");
  const [authState, setAuthState] = useState<{
    user: AuthUser | null;
    isLoaded: boolean;
  }>({
    user: null,
    isLoaded: false,
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await backendClient.user.get("me");
        setAuthState({
          user: {
            id: result.id,
            email: result.email,
            name: result.name,
            role: result.role,
            watch_unit: result.watch_unit ?? undefined,
          },
          isLoaded: true,
        });
      } catch (error) {
        setAuthState({
          user: null,
          isLoaded: true,
        });
      }
    };

    checkAuth();
  }, []);

  const signOut = async () => {
    await backendClient.localauth.signOut();
    localStorage.removeItem("auth_token");
    setAuthState({ user: null, isLoaded: true });
    window.location.href = "/sign-in";
  };

  const isSignedIn = !!authState.user;

  console.log("Auth state:", {
    isLoaded: authState.isLoaded,
    isSignedIn,
    user: authState.user,
  });

  if (!authState.isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        isLoaded: authState.isLoaded,
        isSignedIn,
        signOut,
      }}
    >
      <AppRoutes />
    </AuthContext.Provider>
  );
}

function AppRoutes() {
  const { isSignedIn, user } = useAuth();

  console.log("AppRoutes - isSignedIn:", isSignedIn, "user:", user);

  if (!isSignedIn) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    );
  }

  const role = user?.role;

  return (
    <Routes>
      <Route path="/sign-in" element={<Navigate to="/" replace />} />
      <Route path="/sign-up" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            role === "WC" ? (
              <Dashboard />
            ) : role === "CC" ? (
              <CrewCommanderHome />
            ) : (
              <StaffPortal />
            )
          }
        />
        <Route path="/people" element={<People />} />
        <Route path="/people/:userId" element={<ProfileDetail />} />
        <Route path="/profile" element={<ProfileDetail />} />
        <Route path="/calendar" element={<UnifiedCalendar />} />
        <Route path="/calendar/watch" element={<Navigate to="/calendar" replace />} />
        <Route path="/calendar/personal" element={<Navigate to="/calendar" replace />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/equipment" element={<EquipmentChecks />} />
        <Route path="/targets" element={<Targets />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/policies/qa" element={<PolicyQA />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/handover" element={<HandoverPage />} />
        <Route path="/detachments" element={<DetachmentsPage />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/quarterly/:id" element={<QuarterlyReport />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      {/* Print view — outside Layout so it renders clean with no sidebar */}
      <Route path="/reports/quarterly/:id/print" element={<QuarterlyReportPrint />} />
    </Routes>
  );
}

export default App;
