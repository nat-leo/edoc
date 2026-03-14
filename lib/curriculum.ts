export type Curriculum = {
  name: string;
  totalProblems: number;
  progress: number;
  content: string;
};

type ApiCurriculumItem = Partial<Curriculum> & Record<string, unknown>;
type ApiCurriculumResponse = {
  items?: unknown;
  error?: unknown;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapCurriculumItem(item: ApiCurriculumItem): Curriculum {
  return {
    name: readString(item.name, "Untitled"),
    totalProblems: readNumber(item.totalProblems),
    progress: readNumber(item.progress),
    content: readString(item.content),
  };
}

export async function loadCurriculums(options?: { signal?: AbortSignal }) {
  const res = await fetch("/api/curriculum", {
    method: "GET",
    cache: "no-store",
    signal: options?.signal,
  });

  const data = (await res.json().catch(() => ({}))) as ApiCurriculumResponse;
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error : `Failed to fetch curriculum (${res.status})`;
    throw new Error(message);
  }

  const items: ApiCurriculumItem[] = Array.isArray(data.items) ? data.items : [];
  return items.map(mapCurriculumItem);
}
