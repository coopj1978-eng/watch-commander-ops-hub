import { Client } from "~backend/client";

const API_BASE_URL = import.meta.env.PROD
  ? "https://watch-commander-ops-hub-d4abnrc82vjoh2sfm460.api.lp.dev"
  : "http://localhost:4000";

export const backendClient = new Client(API_BASE_URL, {
  requestInit: {
    credentials: "include",
  },
});

export function useBackend() {
  return backendClient;
}
