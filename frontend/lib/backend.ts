import Client, { Local } from "~backend/client";
import type { AuthDataGenerator } from "~backend/client";

const authGenerator: AuthDataGenerator = () => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  return undefined;
};

export const backendClient = new Client(Local, { auth: authGenerator });

export default backendClient;

export function useBackend() {
  return backendClient;
}
