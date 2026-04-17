import { CaseCreate } from './components/CaseCreate.js';
import { CaseInvestigate } from './components/CaseInvestigate.js';
import { CaseList } from './components/CaseList.js';
import { useCaseStore } from './stores/caseStore.js';

export default function App(): JSX.Element {
  const view = useCaseStore((s) => s.view);
  const currentCaseId = useCaseStore((s) => s.currentCaseId);

  return (
    <div className="h-full flex flex-col">
      {view === 'list' && <CaseList />}
      {view === 'create' && <CaseCreate />}
      {view === 'investigate' && currentCaseId && (
        <CaseInvestigate caseId={currentCaseId} />
      )}
    </div>
  );
}
