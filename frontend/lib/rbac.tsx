import { useAuth, useUser } from "@clerk/clerk-react";
import backend from "~backend/client";
import { useQuery } from "@tanstack/react-query";

export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  if (!isSignedIn) return backend;
  return backend.with({
    auth: async () => {
      const token = await getToken();
      return { authorization: `Bearer ${token}` };
    },
  });
}

export function useUserRole() {
  const { user } = useUser();
  return (user?.publicMetadata?.role as string | undefined) || "FF";
}

export function useCanViewPeople() {
  const role = useUserRole();
  return ["WC", "CC", "RO"].includes(role);
}

export function useCanCreatePerson() {
  const role = useUserRole();
  return ["WC", "CC"].includes(role);
}

export function useCanEditProfiles() {
  const role = useUserRole();
  return ["WC", "CC"].includes(role);
}

export function useIsWC() {
  const role = useUserRole();
  return role === "WC";
}

export function useIsWatchCommander() {
  const role = useUserRole();
  return role === "WC";
}

export function useHasWC() {
  const client = useBackend();
  return useQuery({
    queryKey: ["check-wc"],
    queryFn: async () => {
      const response = await client.admin.checkWC();
      return response.hasWC;
    },
    staleTime: 60000,
  });
}
