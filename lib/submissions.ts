export const SUBMISSIONS_COLLECTION = "submissions";

export type SubmissionStatus =
  | "queued"
  | "running"
  | "completed"
  | "compile_error"
  | "runtime_error"
  | "failed";

type Judge0Status = {
  id?: number;
  description?: string;
};

export type SubmissionRecord = {
  id: string;
  judge0Token: string;
  userId: string;
  problemId: string;
  languageId: number;
  code: string;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  judge0Response: Record<string, unknown> | null;
};

function normalizeStatusDescription(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function mapJudge0StatusToSubmissionStatus(
  judge0Status: Judge0Status | null | undefined
): SubmissionStatus {
  const id = Number(judge0Status?.id ?? NaN);
  if (id === 1) return "queued";
  if (id === 2) return "running";
  if (id === 3) return "completed";
  if (id === 6) return "compile_error";
  if (id >= 7 && id <= 12) return "runtime_error";
  if (id >= 4 && Number.isFinite(id)) return "failed";

  const description = normalizeStatusDescription(judge0Status?.description);
  if (description.includes("queue")) return "queued";
  if (description.includes("process") || description.includes("running")) return "running";
  if (description.includes("accepted")) return "completed";
  if (description.includes("compile")) return "compile_error";
  if (description.includes("runtime")) return "runtime_error";
  return "failed";
}

export function isTerminalSubmissionStatus(status: SubmissionStatus) {
  return status !== "queued" && status !== "running";
}

export function buildSubmissionRecord(input: {
  id: string;
  judge0Token: string;
  userId: string;
  problemId: string;
  languageId: number;
  code: string;
  status: SubmissionStatus;
}): SubmissionRecord {
  const now = new Date().toISOString();
  return {
    id: input.id,
    judge0Token: input.judge0Token,
    userId: input.userId,
    problemId: input.problemId,
    languageId: input.languageId,
    code: input.code,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    judge0Response: null,
  };
}
