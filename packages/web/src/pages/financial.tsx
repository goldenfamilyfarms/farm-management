import {
  ExpenseList,
  CategoryBreakdownChart,
  RevenueChart,
  ProfitLossSummary,
  ROIByZoneChart,
  ReportExportDialog,
} from '@/components/financial';

export function FinancialPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial</h1>
          <p className="text-muted-foreground">
            Track expenses, revenue, and analyze profitability
          </p>
        </div>
        <ReportExportDialog />
      </div>

      {/* Profit/Loss Summary - Full Width */}
      <ProfitLossSummary />

      {/* Revenue and Expense Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="lg:col-span-1">
          <RevenueChart />
        </div>

        {/* Category Breakdown Chart */}
        <div className="lg:col-span-1">
          <CategoryBreakdownChart />
        </div>
      </div>

      {/* ROI by Zone - Full Width */}
      <ROIByZoneChart />

      {/* Expense List - Full Width */}
      <ExpenseList />
    </div>
  );
}
