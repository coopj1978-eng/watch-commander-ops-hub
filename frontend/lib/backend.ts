import backendDefault from "~backend/client";

export const backendClient = backendDefault.with({
  auth: () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      return { authorization: `Bearer ${token}` };
    }
    return undefined;
  },
});

export default backendClient;

export function useBackend() {
  return backendClient;
}
