import backend from "~backend/client";

export const backendClient = backend.with({
  requestInit: {
    credentials: "include",
  },
});

export function useBackend() {
  return backendClient;
}
