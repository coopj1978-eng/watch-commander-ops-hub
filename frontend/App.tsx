import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, useUser } from "@clerk/clerk-react";
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

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_c3dlZXBpbmctYW50ZWxvcGUtMjkuY2xlcmsuYWNjb3VudHMuZGV2JA";

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key. Please set VITE_CLERK_PUBLISHABLE_KEY in your environment.");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { isLoaded, isSignedIn, user } = useUser();

  console.log("AppRoutes - isLoaded:", isLoaded, "isSignedIn:", isSignedIn, "user:", user?.id);

  useEffect(() => {
    if (!isLoaded) {
      console.log("Waiting for Clerk to load...");
    } else {
      console.log("Clerk loaded successfully!", { isSignedIn, userId: user?.id });
    }
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading authentication...</p>
          <p className="text-xs text-gray-400 mt-2">Connecting to Clerk...</p>
        </div>
      </div>
    );
  }

  console.log("Clerk loaded, rendering routes");

  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignIn />} />
      <Route path="/sign-up/*" element={<SignUp />} />
      
      <Route
        path="/"
        element={
          isSignedIn ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/sign-in" replace />
          )
        }
      />

      <Route
        path="/*"
        element={
          isSignedIn ? (
            <Layout />
          ) : (
            <Navigate to="/sign-in" replace />
          )
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        
        <Route path="people" element={<People />} />
        <Route path="people/:userId" element={<ProfileDetail />} />
        
        <Route path="watch-calendar" element={<WatchCalendar />} />
        <Route path="personal-calendar" element={<PersonalCalendar />} />
        <Route path="tasks" element={<Tasks />} />
        
        <Route path="inspections" element={<Inspections />} />
        <Route path="targets" element={<Targets />} />
        
        <Route path="policies" element={<Policies />} />
        <Route path="policy-qa" element={<PolicyQA />} />
        
        <Route path="reports" element={<Reports />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="settings" element={<Settings />} />
        <Route path="staff" element={<StaffPortal />} />
        <Route path="crew-home" element={<CrewCommanderHome />} />
      </Route>
    </Routes>
  );
}

function AppInner() {
  console.log("AppInner rendering");
  
  useEffect(() => {
    const { mode, customColors } = getStoredTheme();
    applyTheme(mode, customColors);
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}

export default function App() {
  console.log("App rendering");
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
