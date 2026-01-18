import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  EXPENSE_CATEGORIES,
  useExpenses,
  useDeleteExpense,
  formatCurrency,
  formatDate,
} from '@/hooks/use-expenses';
import { useFields } from '@/hooks/use-map-data';
import { ExpenseFormDialog } from './expense-form-dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  X,
  Loader2,
  DollarSign,
  Calendar,
  Building2,
  Wheat,
} from 'lucide-react';

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORIES).map(([value, { label }]) => ({
  value: value as ExpenseCategory,
  label,
}));

export function ExpenseList() {
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const { data: expenses, isLoading } = useExpenses(filters);
  const { data: fields } = useFields();
  const deleteExpense = useDeleteExpense();

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setDialogOpen(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense.mutateAsync(expense.id);
    }
  };

  const handleAddNew = () => {
    setSelectedExpense(null);
    setDialogOpen(true);
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v);

  // Calculate totals
  const totalAmount = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Expenses
              </CardTitle>
              <CardDescription>
                Track and manage farm expenses
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1">
                    Active
                  </Badge>
                )}
              </Button>
              <Button size="sm" onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-1" />
                Add Expense
              </Button>
            </div>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Category</label>
                  <Select
                    value={filters.category || ''}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: value as ExpenseCategory || undefined,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Field</label>
                  <Select
                    value={filters.fieldId || ''}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        fieldId: value || undefined,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All fields" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All fields</SelectItem>
                      {fields?.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        startDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">End Date</label>
                  <Input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        endDate: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : expenses && expenses.length > 0 ? (
            <>
              {/* Summary */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                </span>
                <span className="font-semibold">
                  Total: {formatCurrency(totalAmount)}
                </span>
              </div>

              {/* Expense List */}
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isDeleting={deleteExpense.isPending}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No expenses found</p>
              <p className="text-sm">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Click "Add Expense" to record your first expense'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={selectedExpense}
      />
    </>
  );
}

interface ExpenseRowProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  isDeleting: boolean;
}

function ExpenseRow({ expense, onEdit, onDelete, isDeleting }: ExpenseRowProps) {
  const categoryInfo = EXPENSE_CATEGORIES[expense.category];

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: categoryInfo.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {categoryInfo.label}
            </Badge>
            {expense.field && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {expense.field.name}
              </span>
            )}
            {expense.cropType && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Wheat className="h-3 w-3" />
                {expense.cropType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(expense.date)}
            {expense.vendor && <span>• {expense.vendor}</span>}
            {expense.description && (
              <span className="truncate">• {expense.description}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-semibold whitespace-nowrap">
          {formatCurrency(expense.amount, expense.currency)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(expense)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(expense)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
