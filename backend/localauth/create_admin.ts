import { api } from "encore.dev/api";
import * as bcrypt from "bcrypt";
import db from "../db";

interface CreateAdminResponse {
  success: boolean;
  message: string;
}

export const createAdmin = api<void, CreateAdminResponse>(
  { expose: true, method: "POST", path: "/localauth/create-admin" },
  async () => {
    const email = "coopj1978@gmail.com";
    const password = "Admin123!";
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await db.exec`
      UPDATE users 
      SET password_hash = ${passwordHash}, 
          role = 'WC', 
          is_active = true
      WHERE email = ${email}
    `;
    
    return {
      success: true,
      message: `Admin account updated for ${email}`,
    };
  }
);
