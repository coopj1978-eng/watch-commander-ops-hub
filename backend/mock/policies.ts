import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import type { PolicyDoc, PolicyQuery } from "../policy/types";
import { mockPolicyDocs, mockPolicyQueries } from "./data";

interface GetMockPolicyDocsRequest {
  category?: Query<string>;
}

interface GetMockPolicyDocsResponse {
  docs: PolicyDoc[];
  total: number;
}

export const getMockPolicyDocs = api<GetMockPolicyDocsRequest, GetMockPolicyDocsResponse>(
  { expose: true, method: "GET", path: "/api/mock/policies/docs" },
  async (req) => {
    let docs = mockPolicyDocs;
    
    if (req.category) {
      docs = docs.filter(d => d.category === req.category);
    }

    return {
      docs,
      total: docs.length,
    };
  }
);

interface GetMockPolicyQueriesRequest {
  user_id?: Query<string>;
}

interface GetMockPolicyQueriesResponse {
  queries: PolicyQuery[];
  total: number;
}

export const getMockPolicyQueries = api<GetMockPolicyQueriesRequest, GetMockPolicyQueriesResponse>(
  { expose: true, method: "GET", path: "/api/mock/policies/queries" },
  async (req) => {
    let queries = mockPolicyQueries;
    
    if (req.user_id) {
      queries = queries.filter(q => q.asked_by_user_id === req.user_id);
    }

    return {
      queries,
      total: queries.length,
    };
  }
);

interface MockAskPolicyRequest {
  question: string;
}

interface MockAskPolicyResponse {
  answer: string;
  citations: { doc_title: string; page: number }[];
  confidence: number;
}

export const mockAskPolicy = api<MockAskPolicyRequest, MockAskPolicyResponse>(
  { expose: true, method: "POST", path: "/api/mock/policies/ask" },
  async ({ question }) => {
    return {
      answer: `This is a mock answer to your question: "${question}". In a production environment, this would use a vector database and AI to provide accurate answers from policy documents.`,
      citations: [
        { doc_title: "Operational Procedures Manual", page: 42 },
        { doc_title: "Health & Safety Policy", page: 15 },
      ],
      confidence: 0.85,
    };
  }
);
