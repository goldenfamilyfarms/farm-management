import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Expense,
  ExpenseCategory,
  CreateExpenseDto,
  EXPENSE_CATEGORIES,
  useCreateExpense,
  useUpdateExpense,
} from '@/hooks/use-expenses';
import { useFields } from '@/hooks/use-map-data';
import { Loader2 } from 'lucide-react';

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
}

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORIES).map(([value, { label }]) => ({
  value: value as ExpenseCategory,
  label,
}));

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const isEditing = !!expense;
  const { data: fields } = useFields();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const [formData, setFormData] = useState<{
    category: ExpenseCategory;
    amount: string;
    date: string;
    description: string;
    fieldId: string;
    cropType: string;
    vendor: string;
  }>({
    category: 'other',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    fieldId: '',
    cropType: '',
    vendor: '',
  });

  // Reset form when dialog opens/closes or expense changes
  useEffect(() => {
    if (open) {
      if (expense) {
        setFormData({
          category: expense.category,
          amount: expense.amount.toString(),
          date: expense.date.split('T')[0],
          description: expense.description || '',
          fieldId: expense.fieldId || '',
          cropType: expense.cropType || '',
          vendor: expense.vendor || '',
        });
      } else {
        setFormData({
          category: 'other',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          description: '',
          fieldId: '',
          cropType: '',
          vendor: '',
        });
      }
    }
  }, [open, expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dto: CreateExpenseDto = {
      category: formData.category,
      amount: parseFloat(formData.amount),
      date: formData.date,
      description: formData.description || undefined,
      fieldId: formData.fieldId || undefined,
      cropType: formData.cropType || undefined,
      vendor: formData.vendor || undefined,
    };

    try {
      if (isEditing && expense) {
        await updateExpense.mutateAsync({ id: expense.id, dto });
      } else {
        await createExpense.mutateAsync(dto);
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = createExpense.isPending || updateExpense.isPending;
  const isValid = formData.amount && parseFloat(formData.amount) > 0 && formData.date && 
    (formData.fieldId || formData.cropType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the expense details below.'
              : 'Enter the details for the new expense.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: ExpenseCategory) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                placeholder="Enter vendor name"
                value={formData.vendor}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, vendor: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fieldId">Field</Label>
              <Select
                value={formData.fieldId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, fieldId: value }))
                }
              >
                <SelectTrigger id="fieldId">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {fields?.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cropType">Crop Type</Label>
              <Input
                id="cropType"
                placeholder="e.g., Corn, Wheat"
                value={formData.cropType}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cropType: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Enter description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <p className="text-xs text-muted-foreground">
            * Required. At least one of Field or Crop Type must be specified.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isValid}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
