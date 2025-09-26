export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://svc-01k6400s2fbrvn8a8ngpr6h8jv.01k3973ws804nrh2fzmcqjcsvq.lmapp.run";

export interface QueryResponse {
  success: boolean;
  transcription?: string;
  sql?: string;
  results?: any[];
  executionTime?: string;
  sessionId?: string;
  error?: string;
  imagePrompt?: string;
  generatedImageUrl?: string;
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy" | string;
  components: {
    voiceProcessor: { status: string; responseTime: number };
    databaseManager: { status: string; responseTime: number };
  };
  timestamp: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export type QueryResponseExtended = QueryResponse & {
  httpStatus?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  raw?: string;
};

export async function submitVoiceQuery(audioFile: File): Promise<QueryResponseExtended> {
  const formData = new FormData();
  formData.append("audio", audioFile);

  const res = await fetch(`${API_BASE_URL}/query`, {
    method: "POST",
    body: formData,
  });
  const httpStatus = res.status;
  const statusText = res.statusText;
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => { responseHeaders[key] = value; });
  try {
    const data = (await res.json()) as QueryResponse;
    return { ...data, httpStatus, statusText, responseHeaders };
  } catch (e) {
    // Non-JSON response
    const raw = await res.text();
    return { success: false, error: "Non-JSON response", httpStatus, statusText, responseHeaders, raw } as QueryResponseExtended;
  }
}
