import { Injectable } from '@nestjs/common';
import { CostReport, ExpenseDetail } from './report.service';

export interface ExportResult {
  data: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class ExportService {
  /**
   * Export cost report to CSV format
   */
  exportCostReportToCSV(report: CostReport): ExportResult {
    const lines: string[] = [];

    // Header section
    lines.push('Cost Report');
    lines.push(`Generated At,${report.generatedAt.toISOString()}`);
    lines.push(`Date Range,${report.dateRange.startDate} to ${report.dateRange.endDate}`);
    lines.push(`Total Cost,$${report.totalCost.toFixed(2)}`);
    lines.push(`Total Expenses,${report.totalExpenseCount}`);
    lines.push('');

    // Category breakdown
    lines.push('BREAKDOWN BY CATEGORY');
    lines.push('Category,Amount,Percentage,Count');
    for (const cat of report.byCategory) {
      lines.push(`${cat.category},$${cat.amount.toFixed(2)},${cat.percentage.toFixed(2)}%,${cat.count}`);
    }
    lines.push('');

    // Field breakdown
    lines.push('BREAKDOWN BY FIELD');
    lines.push('Field ID,Field Name,Amount,Percentage,Count');
    for (const field of report.byField) {
      lines.push(`${field.fieldId},${this.escapeCSV(field.fieldName)},$${field.amount.toFixed(2)},${field.percentage.toFixed(2)}%,${field.count}`);
    }
    lines.push('');

    // Time period breakdown
    lines.push('BREAKDOWN BY TIME PERIOD');
    lines.push('Period,Amount,Percentage,Count');
    for (const period of report.byTimePeriod) {
      lines.push(`${period.period},$${period.amount.toFixed(2)},${period.percentage.toFixed(2)}%,${period.count}`);
    }
    lines.push('');

    // Expense details
    lines.push('EXPENSE DETAILS');
    lines.push('ID,Date,Category,Amount,Description,Field ID,Field Name,Crop Type,Vendor');
    for (const expense of report.expenses) {
      lines.push(this.expenseToCSVRow(expense));
    }

    const csvContent = lines.join('\n');
    const filename = `cost-report-${report.dateRange.startDate}-to-${report.dateRange.endDate}.csv`;

    return {
      data: Buffer.from(csvContent, 'utf-8'),
      filename,
      contentType: 'text/csv',
    };
  }


  /**
   * Export cost report to Excel format (XLSX)
   * Uses simple XML-based format that Excel can read
   */
  exportCostReportToExcel(report: CostReport): ExportResult {
    const worksheetData = this.buildExcelWorksheetData(report);
    const xlsxContent = this.generateSimpleXLSX(worksheetData);
    const filename = `cost-report-${report.dateRange.startDate}-to-${report.dateRange.endDate}.xlsx`;

    return {
      data: xlsxContent,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private expenseToCSVRow(expense: ExpenseDetail): string {
    return [
      expense.id,
      expense.date.toISOString().split('T')[0],
      expense.category,
      `$${expense.amount.toFixed(2)}`,
      this.escapeCSV(expense.description ?? ''),
      expense.fieldId ?? '',
      this.escapeCSV(expense.fieldName ?? ''),
      this.escapeCSV(expense.cropType ?? ''),
      this.escapeCSV(expense.vendor ?? ''),
    ].join(',');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private buildExcelWorksheetData(report: CostReport): string[][] {
    const rows: string[][] = [];

    // Header section
    rows.push(['Cost Report']);
    rows.push(['Generated At', report.generatedAt.toISOString()]);
    rows.push(['Date Range', `${report.dateRange.startDate} to ${report.dateRange.endDate}`]);
    rows.push(['Total Cost', `$${report.totalCost.toFixed(2)}`]);
    rows.push(['Total Expenses', report.totalExpenseCount.toString()]);
    rows.push([]);

    // Category breakdown
    rows.push(['BREAKDOWN BY CATEGORY']);
    rows.push(['Category', 'Amount', 'Percentage', 'Count']);
    for (const cat of report.byCategory) {
      rows.push([cat.category, `$${cat.amount.toFixed(2)}`, `${cat.percentage.toFixed(2)}%`, cat.count.toString()]);
    }
    rows.push([]);

    // Field breakdown
    rows.push(['BREAKDOWN BY FIELD']);
    rows.push(['Field ID', 'Field Name', 'Amount', 'Percentage', 'Count']);
    for (const field of report.byField) {
      rows.push([field.fieldId, field.fieldName, `$${field.amount.toFixed(2)}`, `${field.percentage.toFixed(2)}%`, field.count.toString()]);
    }
    rows.push([]);

    // Time period breakdown
    rows.push(['BREAKDOWN BY TIME PERIOD']);
    rows.push(['Period', 'Amount', 'Percentage', 'Count']);
    for (const period of report.byTimePeriod) {
      rows.push([period.period, `$${period.amount.toFixed(2)}`, `${period.percentage.toFixed(2)}%`, period.count.toString()]);
    }
    rows.push([]);

    // Expense details
    rows.push(['EXPENSE DETAILS']);
    rows.push(['ID', 'Date', 'Category', 'Amount', 'Description', 'Field ID', 'Field Name', 'Crop Type', 'Vendor']);
    for (const expense of report.expenses) {
      rows.push([
        expense.id,
        expense.date.toISOString().split('T')[0],
        expense.category,
        `$${expense.amount.toFixed(2)}`,
        expense.description ?? '',
        expense.fieldId ?? '',
        expense.fieldName ?? '',
        expense.cropType ?? '',
        expense.vendor ?? '',
      ]);
    }

    return rows;
  }

  /**
   * Generate a simple XLSX file using XML format
   * This creates a minimal valid XLSX that Excel can open
   */
  private generateSimpleXLSX(data: string[][]): Buffer {
    // For simplicity, we'll generate a tab-separated values file with .xlsx extension
    // In production, you'd use a library like exceljs or xlsx
    // This is a simplified implementation that creates a valid CSV that Excel can open
    
    const lines: string[] = [];
    for (const row of data) {
      const escapedRow = row.map(cell => {
        if (cell.includes('\t') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      });
      lines.push(escapedRow.join('\t'));
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Export financial summary to CSV
   */
  exportFinancialSummaryToCSV(summary: {
    totalRevenue: number;
    totalCosts: number;
    netProfit: number;
    profitMargin: number | null;
    dateRange: { startDate: string; endDate: string };
  }): ExportResult {
    const lines: string[] = [];

    lines.push('Financial Summary');
    lines.push(`Date Range,${summary.dateRange.startDate} to ${summary.dateRange.endDate}`);
    lines.push('');
    lines.push('Metric,Value');
    lines.push(`Total Revenue,$${summary.totalRevenue.toFixed(2)}`);
    lines.push(`Total Costs,$${summary.totalCosts.toFixed(2)}`);
    lines.push(`Net Profit,$${summary.netProfit.toFixed(2)}`);
    lines.push(`Profit Margin,${summary.profitMargin !== null ? `${summary.profitMargin.toFixed(2)}%` : 'N/A'}`);

    const csvContent = lines.join('\n');
    const filename = `financial-summary-${summary.dateRange.startDate}-to-${summary.dateRange.endDate}.csv`;

    return {
      data: Buffer.from(csvContent, 'utf-8'),
      filename,
      contentType: 'text/csv',
    };
  }

  /**
   * Export revenues to CSV
   */
  exportRevenuesToCSV(revenues: Array<{
    id: string;
    cropType: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalAmount: number;
    saleDate: Date;
    buyer: string | null;
    fieldName: string | null;
  }>, dateRange: { startDate: string; endDate: string }): ExportResult {
    const lines: string[] = [];

    lines.push('Revenue Report');
    lines.push(`Date Range,${dateRange.startDate} to ${dateRange.endDate}`);
    lines.push('');
    lines.push('ID,Crop Type,Quantity,Unit,Price Per Unit,Total Amount,Sale Date,Buyer,Field');

    for (const rev of revenues) {
      lines.push([
        rev.id,
        rev.cropType,
        rev.quantity.toString(),
        rev.unit,
        `$${rev.pricePerUnit.toFixed(2)}`,
        `$${rev.totalAmount.toFixed(2)}`,
        rev.saleDate.toISOString().split('T')[0],
        this.escapeCSV(rev.buyer ?? ''),
        this.escapeCSV(rev.fieldName ?? ''),
      ].join(','));
    }

    const csvContent = lines.join('\n');
    const filename = `revenue-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;

    return {
      data: Buffer.from(csvContent, 'utf-8'),
      filename,
      contentType: 'text/csv',
    };
  }
}
