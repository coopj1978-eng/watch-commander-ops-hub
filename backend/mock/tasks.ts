import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import type { Task } from "../task/types";
import { mockTasks } from "./data";

interface GetMockTasksRequest {
  status?: Query<string>;
  assigned_to?: Query<string>;
}

interface GetMockTasksResponse {
  tasks: Task[];
  total: number;
}

export const getMockTasks = api<GetMockTasksRequest, GetMockTasksResponse>(
  { expose: true, method: "GET", path: "/api/mock/tasks" },
  async (req) => {
    let tasks = mockTasks;
    
    if (req.status) {
      tasks = tasks.filter(t => t.status === req.status);
    }
    
    if (req.assigned_to) {
      tasks = tasks.filter(t => t.assigned_to_user_id === req.assigned_to);
    }

    return {
      tasks,
      total: tasks.length,
    };
  }
);

interface GetMockTaskRequest {
  id: number;
}

export const getMockTask = api<GetMockTaskRequest, Task>(
  { expose: true, method: "GET", path: "/api/mock/tasks/:id" },
  async ({ id }) => {
    const task = mockTasks.find(t => t.id === id);
    if (!task) {
      throw new Error("Task not found");
    }
    return task;
  }
);
