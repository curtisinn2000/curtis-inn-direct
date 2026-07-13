import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download } from 'lucide-react';

const ReportCard = ({ title, value, change }: { title: string; value: string; change: string }) => (
  <Card className="p-5">
    <p className="text-xs text-muted-foreground mb-1">{title}</p>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-success mt-1">{change}</p>
  </Card>
);

export default function AdminReportsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">Reports</h1>
          <p className="text-sm text-muted-foreground">Analytics and performance data</p>
        </div>
        <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList className="mb-6">
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <ReportCard title="Total Bookings" value="156" change="+12% vs last month" />
            <ReportCard title="Direct Bookings" value="142" change="91% of total" />
            <ReportCard title="Avg. Stay" value="2.8 nights" change="+0.3 nights" />
            <ReportCard title="Avg. Lead Time" value="5.2 days" change="-1.1 days" />
          </div>
          <Card className="p-8 text-center text-muted-foreground">
            <p>Chart placeholder for bookings over time</p>
            <p className="text-xs mt-1">Connect backend for real data visualization</p>
          </Card>
        </TabsContent>

        <TabsContent value="occupancy">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <ReportCard title="Current Occupancy" value="72%" change="+5% vs last week" />
            <ReportCard title="Avg. Occupancy (Month)" value="68%" change="+8% vs last month" />
            <ReportCard title="RevPAR" value="$76.50" change="+$4.20" />
            <ReportCard title="ADR" value="$106.25" change="+$2.80" />
          </div>
          <Card className="p-8 text-center text-muted-foreground">
            <p>Chart placeholder for occupancy trends</p>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <ReportCard title="Revenue (Month)" value="$28,450" change="+15% vs last month" />
            <ReportCard title="Revenue (YTD)" value="$312,800" change="+22% vs last year" />
            <ReportCard title="Avg. Booking Value" value="$182.37" change="+$8.40" />
            <ReportCard title="Outstanding" value="$2,340" change="4 unpaid" />
          </div>
          <Card className="p-8 text-center text-muted-foreground">
            <p>Chart placeholder for revenue trends</p>
          </Card>
        </TabsContent>

        <TabsContent value="cancellations">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <ReportCard title="Cancellations (Month)" value="8" change="-3 vs last month" />
            <ReportCard title="Cancellation Rate" value="5.1%" change="-1.2%" />
            <ReportCard title="No-Shows (Month)" value="2" change="-1" />
            <ReportCard title="Revenue Lost" value="$1,245" change="-$520" />
          </div>
          <Card className="p-8 text-center text-muted-foreground">
            <p>Chart placeholder for cancellation trends</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
