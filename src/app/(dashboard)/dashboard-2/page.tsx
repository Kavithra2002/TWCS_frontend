import { WitheringSessionPanel } from '@/components/charts/WitheringSessionPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadTimeSeriesPoints, loadWitherRun } from '@/lib/moc-run';

export default function Dashboard2Page() {
  const { points, surfaceEndHour } = loadWitherRun();
  const timeSeriesPoints = loadTimeSeriesPoints();

  return (
    <>
      <PageHeader
        title="Dashboard 2"
        description="Waltrim trough 16, 23–24 Jul 2025. Weight is starting weight times current wither standard. The marker is SMR done / IMR1 start."
      />
      <WitheringSessionPanel
        timeSeriesPoints={timeSeriesPoints}
        chartPoints={points}
        surfaceEndHour={surfaceEndHour}
      />
    </>
  );
}
