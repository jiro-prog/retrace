import { create } from 'zustand';

type View = 'list' | 'create' | 'investigate';

interface CaseStore {
  view: View;
  currentCaseId: string | null;
  setView: (v: View) => void;
  openCase: (id: string) => void;
  backToList: () => void;
}

export const useCaseStore = create<CaseStore>((set) => ({
  view: 'list',
  currentCaseId: null,
  setView: (v) => set({ view: v }),
  openCase: (id) => set({ view: 'investigate', currentCaseId: id }),
  backToList: () => set({ view: 'list', currentCaseId: null }),
}));
