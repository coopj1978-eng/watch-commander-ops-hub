import { api } from "encore.dev/api";
import type { User } from "../user/types";
import { mockUsers } from "./data";

interface GetMockUsersRequest {
  role?: string;
}

interface GetMockUsersResponse {
  users: User[];
  total: number;
}

export const getMockUsers = api<GetMockUsersRequest, GetMockUsersResponse>(
  { expose: true, method: "GET", path: "/api/mock/users" },
  async (req) => {
    let users = mockUsers;
    
    if (req.role) {
      users = users.filter(u => u.role === req.role);
    }

    return {
      users,
      total: users.length,
    };
  }
);

interface GetMockUserRequest {
  id: string;
}

export const getMockUser = api<GetMockUserRequest, User>(
  { expose: true, method: "GET", path: "/api/mock/users/:id" },
  async ({ id }) => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
);
