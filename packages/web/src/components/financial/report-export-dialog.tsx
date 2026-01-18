import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

export type ReportType = 'costs' | 'financial-summary' | 'revenue';
export type ExportFormat = 'csv' | 'excel';

interface ReportExportDialogProps {
  trigger?: React.ReactNode;
}

// Get default date range (current year)
function getDefaultDateRange() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1);
  const endDate = now;
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function ReportExportDialog({ trigger }: ReportExportDialogProps) {
  const defaultRange = getDefaultDateRange();
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('costs');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const handleExport = async (format: ExportFormat) => {
    if (!startDate || !endDate) {
      toast({
        title: 'Missing dates',
        description: 'Please select both start and end dates.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      const endpoint = getExportEndpoint(reportType, format, startDate, endDate);
      const response = await fetch(`/api${endpoint}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${reportType}-report-${startDate}-to-${endDate}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export successful',
        description: `Your ${getReportTypeLabel(reportType)} has been downloaded.`,
      });

      setOpen(false);
    } catch {
      toast({
        title: 'Export failed',
        description: 'There was an error exporting the report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Financial Report</DialogTitle>
          <DialogDescription>
            Configure and download financial reports in CSV or Excel format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type</Label>
            <Select
              value={reportType}
              onValueChange={(value) => setReportType(value as ReportType)}
            >
              <SelectTrigger id="report-type">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="costs">Cost Report</SelectItem>
                <SelectItem value="financial-summary">Financial Summary</SelectItem>
                <SelectItem value="revenue">Revenue Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleExport('excel')}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Export Excel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getExportEndpoint(
  reportType: ReportType,
  format: ExportFormat,
  startDate: string,
  endDate: string
): string {
  const formatPath = format === 'excel' ? 'excel' : 'csv';
  const dateParams = `startDate=${startDate}&endDate=${endDate}`;

  switch (reportType) {
    case 'costs':
      return `/reports/costs/export/${formatPath}?${dateParams}`;
    case 'financial-summary':
      return `/reports/costs/export/${formatPath}?${dateParams}`;
    case 'revenue':
      return `/reports/costs/export/${formatPath}?${dateParams}`;
    default:
      return `/reports/costs/export/${formatPath}?${dateParams}`;
  }
}

function getReportTypeLabel(reportType: ReportType): string {
  switch (reportType) {
    case 'costs':
      return 'Cost Report';
    case 'financial-summary':
      return 'Financial Summary';
    case 'revenue':
      return 'Revenue Report';
    default:
      return 'Report';
  }
}
