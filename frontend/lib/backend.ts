import Client, { Local, Environment } from "~backend/client";
import type { AuthDataGenerator } from "~backend/client";

const authGenerator: AuthDataGenerator = () => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  return undefined;
};

const baseURL = typeof window !== "undefined" && window.location.hostname !== "localhost"
  ? "https://staging-watch-commander-ops-hub-8spi.encr.app"
  : Local;

export const backendClient = new Client(baseURL, { auth: authGenerator });

export default backendClient;

export function useBackend() {
  return backendClient;
}
