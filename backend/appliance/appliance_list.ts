import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import db from "../db";
import type { Appliance, ListAppliancesResponse } from "./types";

interface ListAppliancesRequest {
  station_call_sign?: Query<string>;
  active_only?: Query<boolean>;
}

export const listAppliances = api<ListAppliancesRequest, ListAppliancesResponse>(
  { auth: true, expose: true, method: "GET", path: "/appliances" },
  async (req) => {
    const activeOnly = req.active_only !== false;

    if (req.station_call_sign) {
      const appliances = activeOnly
        ? await db.queryAll<Appliance>`
            SELECT * FROM appliances WHERE station_call_sign = ${req.station_call_sign} AND active = true ORDER BY call_sign
          `
        : await db.queryAll<Appliance>`
            SELECT * FROM appliances WHERE station_call_sign = ${req.station_call_sign} ORDER BY call_sign
          `;
      return { appliances };
    }

    const appliances = activeOnly
      ? await db.queryAll<Appliance>`SELECT * FROM appliances WHERE active = true ORDER BY call_sign`
      : await db.queryAll<Appliance>`SELECT * FROM appliances ORDER BY call_sign`;

    return { appliances };
  }
);
