import backend from "~backend/client";

export const backendClient = backend.with({
  auth: () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      return { authorization: `Bearer ${token}` };
    }
    return undefined;
  },
});

export function useBackend() {
  return backendClient;
}
