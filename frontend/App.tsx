import { useEffect, useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import People from "./pages/People";
import ProfileDetail from "./pages/ProfileDetail";
import WatchCalendar from "./pages/WatchCalendar";
import PersonalCalendar from "./pages/PersonalCalendar";
import Tasks from "./pages/Tasks";
import Inspections from "./pages/Inspections";
import Targets from "./pages/Targets";
import Policies from "./pages/Policies";
import PolicyQA from "./pages/PolicyQA";
import Reports from "./pages/Reports";
import AdminPanel from "./pages/AdminPanel";
import Settings from "./pages/Settings";
import StaffPortal from "./pages/StaffPortal";
import CrewCommanderHome from "./pages/CrewCommanderHome";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
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
        const result = await backendClient.user.get({ id: "me" });
        setAuthState({
          user: {
            id: result.id,
            email: result.email,
            name: result.name,
            role: result.role,
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
    document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    );
  }

  const role = user?.role;

  return (
    <Routes>
      <Route path="/sign-in" element={<Navigate to="/" replace />} />
      <Route path="/sign-up" element={<Navigate to="/" replace />} />
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
        <Route path="/calendar/watch" element={<WatchCalendar />} />
        <Route path="/calendar/personal" element={<PersonalCalendar />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/targets" element={<Targets />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/policies/qa" element={<PolicyQA />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
