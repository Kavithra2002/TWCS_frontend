import { WitherWeightChart } from '@/components/charts/WitherWeightChart';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadWitherRun } from '@/lib/moc-run';

export default function Dashboard2Page() {
  const points = loadWitherRun();

  return (
    <>
      <PageHeader
        title="Dashboard 2"
        description="14-hour wither. Surface moisture leaves quickly in the first 30% of the run, then moisture inside the leaf falls more slowly."
      />
      <WitherWeightChart points={points} />
    </>
  );
}
