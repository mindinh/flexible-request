import { Card, Input, TextArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from '../../../../components/ui';
import { PrincipalSelect, type Principal } from '../../../../components/shared/PrincipalSelect';
import { getPriorityOptions } from '../../../../config';
import type { FormData, FieldValue } from '../../../../types';

interface RequestInfoFormProps {
    formData: FormData;
    onFieldChange: (fieldId: string, value: FieldValue) => void;
    isNewRequest?: boolean;
}

/**
 * Request metadata form section
 * Contains title, priority, justification, and coordinator fields
 */
export function RequestInfoForm({ formData, onFieldChange, isNewRequest }: RequestInfoFormProps) {
    // Convert stored coordinator data to Principal format
    const coordinatorValue: Principal | null = formData.coordinatorId ? {
        id: formData.coordinatorId as string,
        type: (formData.coordinatorType as string) || 'USER',
        displayName: (formData.coordinatorName as string) || formData.coordinatorId as string,
    } : null;

    const handleCoordinatorChange = (principal: Principal | null) => {
        if (principal) {
            onFieldChange('coordinatorId', principal.id);
            onFieldChange('coordinatorType', principal.type);
            onFieldChange('coordinatorName', principal.displayName);
        } else {
            onFieldChange('coordinatorId', null);
            onFieldChange('coordinatorType', null);
            onFieldChange('coordinatorName', null);
        }
    };

    return (
        <Card className="p-6 border-t-4 border-t-primary">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100">
                Request Information
            </h2>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Request Title <span className="text-destructive">*</span>
                        </label>
                        <Input
                            placeholder="Enter a descriptive title"
                            value={formData.title || ''}
                            onChange={(e) => onFieldChange('title', e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Priority
                        </label>
                        <Select
                            value={formData.priority || 'MEDIUM'}
                            onValueChange={(val) => onFieldChange('priority', val)}
                        >
                            <SelectTrigger className="w-full bg-white">
                                <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                                {getPriorityOptions().map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        <Badge variant={opt.variant} className="mr-2">
                                            {opt.label}
                                        </Badge>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Coordinator Assignment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Coordinator
                        </label>
                        <PrincipalSelect
                            value={coordinatorValue}
                            onChange={handleCoordinatorChange}
                            placeholder="Assign a coordinator (optional)"
                            disabled={isNewRequest}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Person responsible for managing this request's workflow
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Justification
                    </label>
                    <TextArea
                        placeholder="Describe the business reason for this request..."
                        value={formData.description || ''}
                        onChange={(e) => onFieldChange('description', e.target.value)}
                        rows={3}
                        className="resize-none"
                    />
                </div>
            </div>
        </Card>
    );
}

