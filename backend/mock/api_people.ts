import { api } from "encore.dev/api";

interface MockPerson {
  id: string;
  email: string;
  name: string;
  role: "WC" | "CC" | "FF" | "RO";
  watch?: "Green" | "Red" | "White" | "Blue" | "Amber";
  phone?: string;
  staffNumber?: string;
  niNumber?: string;
  rank: "SC" | "WC" | "CC" | "FF";
  skills: string[];
  driverPathway: {
    status:
      | "medical_due"
      | "application_sent"
      | "awaiting_theory"
      | "awaiting_course"
      | "passed_LGV"
      | "awaiting_ERD"
      | "passed";
    lgvPassedDate?: string;
  };
  notes: string;
  lastConversation?: {
    date: string;
    text: string;
  };
  customFields: Record<string, string | number | boolean | null>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

let mockPeople: MockPerson[] = [
  {
    id: "person_1",
    email: "john.smith@fire.gov.uk",
    name: "John Smith",
    role: "WC",
    watch: "Red",
    phone: "+44 7700 900123",
    staffNumber: "FF-001234",
    niNumber: "AB123456C",
    rank: "WC",
    skills: ["BA", "RTC", "Water Rescue"],
    driverPathway: {
      status: "passed",
      lgvPassedDate: "2023-05-15",
    },
    notes: "Experienced watch commander",
    lastConversation: {
      date: "2025-01-10",
      text: "Discussed upcoming training rotation",
    },
    customFields: {
      "preferred_shift": "nights",
      "years_of_service": 15,
    },
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2025-01-10T12:00:00Z",
  },
  {
    id: "person_2",
    email: "sarah.jones@fire.gov.uk",
    name: "Sarah Jones",
    role: "CC",
    watch: "Blue",
    phone: "+44 7700 900124",
    staffNumber: "FF-001235",
    niNumber: "CD789012E",
    rank: "CC",
    skills: ["BA", "Hazmat", "Technical Rescue"],
    driverPathway: {
      status: "awaiting_ERD",
      lgvPassedDate: "2024-09-20",
    },
    notes: "Strong leadership skills",
    customFields: {},
    isActive: true,
    createdAt: "2024-03-15T00:00:00Z",
    updatedAt: "2025-01-05T09:00:00Z",
  },
];

export const getMockPeople = api(
  { expose: true, method: "GET", path: "/api/people" },
  async (): Promise<{ data: MockPerson[] }> => {
    return { data: mockPeople };
  }
);

export const getMockPerson = api(
  { expose: true, method: "GET", path: "/api/people/:id" },
  async ({ id }: { id: string }): Promise<{ data: MockPerson | null }> => {
    const person = mockPeople.find((p) => p.id === id);
    return { data: person || null };
  }
);

export const updateMockPerson = api(
  { expose: true, method: "PUT", path: "/api/people/:id" },
  async ({
    id,
    ...updates
  }: { id: string } & Partial<MockPerson>): Promise<{ data: MockPerson }> => {
    const index = mockPeople.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error("Person not found");
    }

    mockPeople[index] = {
      ...mockPeople[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return { data: mockPeople[index] };
  }
);
