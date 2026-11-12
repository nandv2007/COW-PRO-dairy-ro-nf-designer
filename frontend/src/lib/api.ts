import type {
  Membrane,
  PreferredUnits,
  ProjectDetail,
  ProjectSummary,
  UserProfile,
} from "@/types/cowpro";

function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return `https://${raw}`;
  }
  if (process.env.NODE_ENV === "test") {
    return "http://localhost:8000";
  }
  return "";
}

const API_BASE = resolveApiBase();

const TOKEN_KEY = "cowpro_access_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(TOKEN_KEY) ||
    window.sessionStorage.getItem(TOKEN_KEY)
  );
}

export function setStoredToken(token: string | null, remember = true) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
  if (token) {
    if (remember) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    }
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const json = await res.json();
      if (typeof json.detail === "string") {
        detail = json.detail;
      } else if (Array.isArray(json.detail) && json.detail[0]?.msg) {
        detail = json.detail[0].msg;
      }
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(detail, res.status);
  }

  return res.json() as Promise<T>;
}

async function downloadFile(path: string, method: "GET" | "POST", fallbackFilename: string) {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    let detail = `Download failed (${res.status})`;
    try {
      const json = await res.json();
      if (json.detail) detail = json.detail;
    } catch {
      // ignore
    }
    throw new ApiError(detail, res.status);
  }
  const blob = await res.blob();
  const disp = res.headers.get("content-disposition") || "";
  const match = disp.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  auth: {
    register: (data: {
      full_name: string;
      email: string;
      organization?: string;
      password: string;
      confirm_password: string;
    }) =>
      request<{ message: string; user: UserProfile; verification_token?: string }>(
        "/api/auth/register",
        { method: "POST", body: JSON.stringify(data) }
      ),
    verifyEmail: (token: string) =>
      request<{ message: string; email: string }>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    login: (data: { email: string; password: string; remember_me: boolean }) =>
      request<{
        access_token: string;
        token_type: string;
        remember_me: boolean;
        user: UserProfile;
      }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
    logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
    forgotPassword: (email: string) =>
      request<{ message: string; reset_token?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (data: {
      token: string;
      new_password: string;
      confirm_password: string;
    }) =>
      request<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<{ user: UserProfile }>("/api/auth/me"),
    updateMe: (data: {
      full_name?: string;
      organization?: string;
      preferred_units?: Partial<PreferredUnits>;
    }) =>
      request<{ user: UserProfile }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    changePassword: (data: {
      current_password: string;
      new_password: string;
      confirm_password: string;
    }) =>
      request<{ message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  membranes: {
    list: (params?: {
      process_type?: string;
      nominal_size?: string;
      min_area?: number;
      max_area?: number;
      model_query?: string;
      ash_supplied?: boolean;
    }) => {
      const qs = new URLSearchParams();
      if (params?.process_type) qs.set("process_type", params.process_type);
      if (params?.nominal_size) qs.set("nominal_size", params.nominal_size);
      if (params?.min_area !== undefined) qs.set("min_area", String(params.min_area));
      if (params?.max_area !== undefined) qs.set("max_area", String(params.max_area));
      if (params?.model_query) qs.set("model_query", params.model_query);
      if (params?.ash_supplied) qs.set("ash_supplied", "true");
      const query = qs.toString();
      return request<{
        membranes: Membrane[];
        ash_restriction_active: boolean;
        restriction_note: string | null;
      }>(`/api/membranes${query ? `?${query}` : ""}`);
    },
    get: (id: number) => request<{ membrane: Membrane }>(`/api/membranes/${id}`),
    compare: (ids: number[]) =>
      request<{ membranes: Membrane[] }>(`/api/membranes/compare?ids=${ids.join(",")}`),
    update: (id: number, data: Record<string, unknown>) =>
      request<{ membrane: Membrane }>(`/api/membranes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },
  projects: {
    dashboard: () =>
      request<{
        summary: {
          total_projects: number;
          completed_designs: number;
          draft_designs: number;
          recent_simulations: number;
        };
        recent_projects: ProjectSummary[];
      }>("/api/projects/dashboard/summary"),
    list: () => request<{ projects: ProjectSummary[] }>("/api/projects"),
    create: (data: Record<string, unknown>) =>
      request<{ project: ProjectDetail }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    loadDemo: () =>
      request<{ project: ProjectDetail }>("/api/projects/demo", { method: "POST" }),
    get: (id: string) => request<{ project: ProjectDetail }>(`/api/projects/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      request<{ project: ProjectDetail }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    duplicate: (id: string) =>
      request<{ project: ProjectDetail }>(`/api/projects/${id}/duplicate`, {
        method: "POST",
      }),
    delete: (id: string) =>
      request<{ message: string; id: string }>(`/api/projects/${id}`, {
        method: "DELETE",
      }),
    saveFeedAnalysis: (id: string, data: Record<string, unknown>) =>
      request<{
        project: ProjectDetail;
        composition: Record<string, unknown>;
        feed: Record<string, unknown>;
        concentration: Record<string, unknown>;
        loops: Record<string, unknown>;
        design: Record<string, unknown> | null;
      }>(`/api/projects/${id}/feed-analysis`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    saveEquipmentDesign: (id: string, data: Record<string, unknown>) =>
      request<{
        project: ProjectDetail;
        design: Record<string, unknown>;
      }>(`/api/projects/${id}/equipment-design`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    simulate: (id: string, simulation_level: "Level 1" | "Level 2") =>
      request<Record<string, unknown>>(`/api/projects/${id}/simulate`, {
        method: "POST",
        body: JSON.stringify({ simulation_level }),
      }),
    importJson: (data: unknown, project_name?: string) =>
      request<{ project: ProjectDetail }>("/api/projects/import/json", {
        method: "POST",
        body: JSON.stringify({ data, project_name }),
      }),
  },
  reports: {
    downloadPdf: (projectId: string, projectCode: string) =>
      downloadFile(
        `/api/reports/project/${projectId}/pdf`,
        "POST",
        `${projectCode}_Engineering_Report.pdf`
      ),
    downloadCsv: (projectId: string, projectCode: string) =>
      downloadFile(
        `/api/reports/project/${projectId}/csv`,
        "GET",
        `${projectCode}_Calculations.csv`
      ),
    downloadJson: (projectId: string, projectCode: string) =>
      downloadFile(
        `/api/reports/project/${projectId}/json`,
        "GET",
        `${projectCode}_Project.json`
      ),
  },
};
