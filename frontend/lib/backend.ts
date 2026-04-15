import Client, { Local, Environment } from "~backend/client";
import type { AuthDataGenerator } from "~backend/client";

const authGenerator: AuthDataGenerator = () => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  return undefined;
};

// When served from Encore (same origin) use "" so API calls are relative.
// In local dev (Vite on :5173) use Local (http://localhost:4000).
const baseURL = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? ""
  : Local;

export const backendClient = new Client(baseURL, { auth: authGenerator });

export default backendClient;

export function useBackend() {
  return backendClient;
}
