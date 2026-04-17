import type {
  Case,
  CaseDetail,
  CaseListItem,
  CaseStatus,
  CheckSuspectRequest,
  CheckSuspectResponse,
  CreateCaseRequest,
  SolveCaseRequest,
} from '@retrace/types';

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  createCase: (body: CreateCaseRequest): Promise<Case> =>
    http('/api/cases', { method: 'POST', body: JSON.stringify(body) }),
  listCases: (status?: CaseStatus): Promise<CaseListItem[]> => {
    const q = status ? `?status=${status}` : '';
    return http(`/api/cases${q}`);
  },
  getCase: (id: string): Promise<CaseDetail> => http(`/api/cases/${id}`),
  solveCase: (id: string, body: SolveCaseRequest): Promise<Case> =>
    http(`/api/cases/${id}/solve`, { method: 'PATCH', body: JSON.stringify(body) }),
  coldCase: (id: string): Promise<Case> =>
    http(`/api/cases/${id}/cold`, { method: 'PATCH' }),
  checkSuspect: (id: string, body: CheckSuspectRequest): Promise<CheckSuspectResponse> =>
    http(`/api/cases/${id}/check-suspect`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
