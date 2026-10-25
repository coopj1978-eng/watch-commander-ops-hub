import { api, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { loadHandovers } from "./items";
import type { ListHandoversResponse, Handover } from "./types";

interface ListRequest {
  watch?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export const list = api<ListRequest, ListHandoversResponse>(
  { auth: true, expose: true, method: "GET", path: "/handovers" },
  async (req) => {
    getAuthData()!;
    return req.watch
      ? loadHandovers("WHERE LOWER(h.watch) = LOWER($1)", [req.watch], req.limit ?? 20, req.offset ?? 0)
      : loadHandovers("", [], req.limit ?? 20, req.offset ?? 0);
  }
);

interface GetLatestResponse {
  handover: Handover | null;
  found: boolean;
}

export const getLatest = api<{ watch?: Query<string> }, GetLatestResponse>(
  { auth: true, expose: true, method: "GET", path: "/handovers/latest" },
  async (req) => {
    getAuthData()!;
    const { handovers } = req.watch
      ? await loadHandovers("WHERE LOWER(h.watch) = LOWER($1)", [req.watch], 1)
      : await loadHandovers("", [], 1);
    return handovers[0] ? { handover: handovers[0], found: true } : { handover: null, found: false };
  }
);
