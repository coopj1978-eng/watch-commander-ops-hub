import backend from "~backend/client";

export const backendClient = backend;

export function useBackend() {
  return backend;
}
