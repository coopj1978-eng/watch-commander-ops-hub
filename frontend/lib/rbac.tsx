import { createContext, useContext, ReactNode } from "react";
import backend from "~backend/client";
import { useAuth } from "@/App";

export function useBackend() {
  return backend;
}

export function useUserRole() {
  const { user } = useAuth();
  return user?.role || "FF";
}

export function useIsWatchCommander() {
  const role = useUserRole();
  return role === "WC";
}

export function useIsCrewCommander() {
  const role = useUserRole();
  return role === "CC" || role === "WC";
}

export function useCanViewPeople() {
  const role = useUserRole();
  return role === "WC" || role === "CC";
}

export function useCanEditProfiles() {
  const role = useUserRole();
  return role === "WC" || role === "CC";
}

export function useCanCreatePerson() {
  const role = useUserRole();
  return role === "WC";
}

export function useIsWC() {
  return useIsWatchCommander();
}
