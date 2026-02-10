import { secret } from "encore.dev/config";

const adminEmailRef = secret("AdminEmail");
const setupTokenRef = secret("SetupToken");

export function getAdminEmail(): string {
  try {
    const val = adminEmailRef();
    if (val) return val;
  } catch {
    // Not configured
  }
  return "";
}

export function getSetupToken(): string {
  try {
    const val = setupTokenRef();
    if (val) return val;
  } catch {
    // Not configured
  }
  return "";
}

// Keep backwards-compatible exports
export const adminEmail = getAdminEmail;
export const setupToken = getSetupToken;
