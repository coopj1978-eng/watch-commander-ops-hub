import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { logActivity } from "../logging/logger";
import type { AskPolicyRequest, AskPolicyResponse, Citation, PolicyQuery } from "./types";

const GUARDRAIL_PROMPT = `You are a helpful assistant that answers questions based ONLY on the provided policy documents. 

CRITICAL RULES:
1. If the answer is not found in the provided documents, you MUST respond EXACTLY with: "Not specified in uploaded docs."
2. Do NOT use external knowledge or make assumptions
3. Only cite information that is explicitly stated in the documents
4. When citing, provide the document title and page number
5. Be concise and direct in your answers

Documents context will be provided below. Answer the user's question based only on this context.`;

export const ask = api(
  { expose: true, method: "POST", path: "/policies/ask", auth: true },
  async ({ query }: AskPolicyRequest): Promise<AskPolicyResponse> => {
    const auth = getAuthData()!;
    const user_id = auth.userID;
    const policies = await db.rawQueryAll<{
      id: number;
      title: string;
      vector_id: string | null;
      total_pages: number | null;
    }>(`
      SELECT id, title, vector_id, total_pages
      FROM policy_docs
      WHERE vector_id IS NOT NULL
      ORDER BY uploaded_at DESC
    `);

    if (policies.length === 0) {
      const noDocsAnswer = "Not specified in uploaded docs.";
      
      await db.rawQuery(`
        INSERT INTO policy_queries (asked_by_user_id, question, answer, citations, confidence)
        VALUES ($1, $2, $3, $4, $5)
      `, user_id, query, noDocsAnswer, JSON.stringify([]), 0);

      await logActivity({
        user_id: user_id,
        action: "ask_policy_question",
        entity_type: "policy_query",
        entity_id: null,
        details: { query: query.substring(0, 100), answer: "no_docs" },
      });

      return {
        answer: noDocsAnswer,
        citations: [],
        confidence: 0,
      };
    }

    const contextDocs = policies.map(p => 
      `[${p.id}] Document: "${p.title}" | Pages: ${p.total_pages || "unknown"} | Vector ID: ${p.vector_id}`
    ).join("\n");
    
    const fullPrompt = `${GUARDRAIL_PROMPT}

Available Documents:
${contextDocs}

User Question: ${query}

Instructions:
1. Search through the document context for relevant information
2. If found, provide a clear answer citing document title and page number
3. If NOT found, respond EXACTLY with: "Not specified in uploaded docs."
4. Format citations as: [Document Title, Page X]

Answer:`;

    let answer: string;
    let citations: Citation[] = [];
    let confidence: number = 0;

    const lowercaseQuery = query.toLowerCase();
    const queryTerms = lowercaseQuery.split(/\s+/).filter(t => t.length > 3);
    
    let relevantPolicies = policies.filter(p => {
      const titleLower = p.title.toLowerCase();
      return queryTerms.some(term => titleLower.includes(term)) ||
             lowercaseQuery.includes(titleLower);
    });

    if (relevantPolicies.length === 0 && policies.length > 0) {
      relevantPolicies = [policies[0]];
    }

    if (relevantPolicies.length > 0) {
      const topPolicy = relevantPolicies[0];
      const maxPages = topPolicy.total_pages || 10;
      const estimatedPage = Math.ceil(Math.random() * maxPages);
      
      answer = `Based on the policy documents, I found relevant information in "${topPolicy.title}".\n\n`;
      answer += `**Important:** This is a simulated RAG response. In production, this would:\n`;
      answer += `1. Use OpenAI embeddings to create vector representations of policy content\n`;
      answer += `2. Perform semantic search to find relevant document sections\n`;
      answer += `3. Use GPT-4 to generate accurate answers with precise citations\n`;
      answer += `4. Return confidence scores based on retrieval quality\n\n`;
      answer += `For the question "${query}", the system would search pages ${estimatedPage}-${Math.min(estimatedPage + 2, maxPages)} of "${topPolicy.title}" and provide specific excerpts with citations.`;
      
      citations = [
        {
          doc_title: topPolicy.title,
          page: estimatedPage,
        }
      ];
      
      if (relevantPolicies.length > 1) {
        citations.push({
          doc_title: relevantPolicies[1].title,
          page: 1,
        });
      }
      
      confidence = 0.7;
    } else {
      answer = "Not specified in uploaded docs.";
      confidence = 0;
    }

    await db.rawQuery(`
      INSERT INTO policy_queries (asked_by_user_id, question, answer, citations, confidence)
      VALUES ($1, $2, $3, $4, $5)
    `, user_id, query, answer, JSON.stringify(citations), confidence);

    await logActivity({
      user_id: user_id,
      action: "ask_policy_question",
      entity_type: "policy_query",
      entity_id: null,
      details: { 
        query: query.substring(0, 100),
        has_answer: !answer.includes("Not specified"),
        citations_count: citations.length,
      },
    });

    return {
      answer,
      citations,
      confidence,
    };
  }
);
