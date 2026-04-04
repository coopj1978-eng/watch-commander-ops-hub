import Client, { Local, Environment } from "~backend/client";
import type { AuthDataGenerator } from "~backend/client";

const authGenerator: AuthDataGenerator = () => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  return undefined;
};

const baseURL = import.meta.env.VITE_API_URL || Local;

export const backendClient = new Client(baseURL, { auth: authGenerator });

export default backendClient;

export function useBackend() {
  return backendClient;
}
