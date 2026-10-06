import { WitherRunTable } from '@/components/charts/WitherRunTable';
import { WitherWeightChart } from '@/components/charts/WitherWeightChart';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadWitherRun } from '@/lib/moc-run';

export default function Dashboard2Page() {
  const { points, surfaceEndHour } = loadWitherRun();

  return (
    <>
      <PageHeader
        title="Dashboard 2"
        description="Waltrim trough 16, 23–24 Jul 2025. Weight is starting weight times current wither standard. The marker is SMR done / IMR1 start."
      />
      <WitherWeightChart points={points} surfaceEndHour={surfaceEndHour} />
      <WitherRunTable points={points} surfaceEndHour={surfaceEndHour} />
    </>
  );
}
