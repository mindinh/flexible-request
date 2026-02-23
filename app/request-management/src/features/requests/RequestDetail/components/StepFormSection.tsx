import { motion } from 'framer-motion';
import { Hand, Lock } from 'lucide-react';
import { Card, Button } from '../../../../components/ui';
import { DynamicField } from '../../../../components/shared/DynamicField';
import { DynamicTableField } from '../../../../components/shared/DynamicTableField';
import { parseSchemaContent, type SchemaField, type SchemaSection, type SchemaTable } from '../../../../lib/schemaParser';
import { DisplayField } from './DisplayField';
import { DisplayTableField } from './DisplayTableField';
import type { Step, RequestTypeStep } from '../types';
import type { FormData, FieldValue } from '../../../../types';

interface StepFormSectionProps {
    step: Step;
    stepDefinition: RequestTypeStep;
    formData: FormData;
    isEditable: boolean;
    onFieldChange: (fieldId: string, value: FieldValue) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    /** If true, step is group-assigned but not yet claimed */
    claimRequired?: boolean;
    /** If true, step is claimed by someone else */
    claimedByOther?: boolean;
    /** Name of the user who claimed the step */
    claimedByName?: string;
}

/**
 * Dynamic step form section for displaying/editing step data
 */
export function StepFormSection({
    step,
    stepDefinition,
    formData,
    isEditable,
    onFieldChange,
    onSubmit,
    isSubmitting,
    claimRequired = false,
    claimedByOther = false,
    claimedByName
}: StepFormSectionProps) {
    const schemaItems = parseSchemaContent(stepDefinition.schemaContent);

    if (schemaItems.length === 0) {
        return null;
    }

    const isBlocked = claimRequired || claimedByOther;

    return (
        <motion.div
            key={step.ID}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <Card className={`p-6 ${step.status === 'STARTED' ? 'ring-2 ring-primary/20 border-primary' : ''}`}>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex justify-between items-center">
                    <span>{stepDefinition.stepName}</span>
                </h3>

                {/* Blocked State Banner */}
                {isBlocked && (
                    <div className={`mb-4 p-3 rounded-lg flex items-center gap-3 ${claimRequired ? 'bg-amber-50 border border-amber-200' : 'bg-slate-100 border border-slate-200'
                        }`}>
                        {claimRequired ? (
                            <Hand className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        ) : (
                            <Lock className="w-5 h-5 text-slate-500 flex-shrink-0" />
                        )}
                        <div>
                            <p className={`text-sm font-medium ${claimRequired ? 'text-amber-800' : 'text-slate-700'}`}>
                                {claimRequired
                                    ? 'Claim this step to edit'
                                    : `This step is being edited by ${claimedByName || 'another user'}`}
                            </p>
                            {claimRequired && (
                                <p className="text-xs text-amber-600 mt-0.5">
                                    Use the Claim panel in the sidebar to take ownership
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {schemaItems.map((item, index) => {
                        // Handle section type
                        if (item.type === 'section') {
                            const section = item as SchemaSection;
                            return (
                                <div key={section.id || index} className="space-y-4">
                                    {section.label && (
                                        <h4 className="font-medium text-slate-700 border-b border-slate-100 pb-2 mt-2">
                                            {section.label}
                                        </h4>
                                    )}
                                    <div className={`grid grid-cols-12 gap-4`}>
                                        {section.fields.map(field => {
                                            const raw = (field.colSpan as number) || 6;
                                            const span = raw === 1 ? 6 : raw === 2 ? 12 : raw;
                                            const spanMap: Record<number, string> = {
                                                3: 'col-span-12 md:col-span-3',
                                                6: 'col-span-12 md:col-span-6',
                                                9: 'col-span-12 md:col-span-9',
                                                12: 'col-span-12 md:col-span-12',
                                            };
                                            const spanClass = spanMap[span] || 'col-span-12 md:col-span-6';
                                            return (
                                                <div key={field.id} className={`min-w-0 ${spanClass}`}>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1 truncate">
                                                        {field.label}
                                                        {field.required && isEditable && <span className="text-red-500 ml-1">*</span>}
                                                    </label>
                                                    {isEditable ? (
                                                        <DynamicField
                                                            field={field}
                                                            value={formData[field.id]}
                                                            onChange={(val) => onFieldChange(field.id, val)}
                                                        />
                                                    ) : (
                                                        <DisplayField field={field} value={formData[field.id]} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }

                        // Handle table type
                        if (item.type === 'table') {
                            const table = item as SchemaTable;
                            return (
                                <div key={table.id || index} className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        {table.label}
                                    </label>
                                    {isEditable ? (
                                        <DynamicTableField
                                            tableId={table.id}
                                            label={table.label}
                                            columns={table.columns.map(col => ({
                                                ...col,
                                                controlType: col.controlType || col.type || 'text'
                                            }))}
                                            value={(formData[table.id] as any[]) || []}
                                            onChange={(rows) => onFieldChange(table.id, rows)}
                                        />
                                    ) : (
                                        <DisplayTableField
                                            columns={table.columns}
                                            rows={(formData[table.id] as any[]) || []}
                                        />
                                    )}
                                </div>
                            );
                        }

                        // Handle standalone field
                        const field = item as SchemaField;
                        return (
                            <div key={field.id}>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {field.label}
                                    {field.required && isEditable && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                {isEditable ? (
                                    <DynamicField
                                        field={field}
                                        value={formData[field.id]}
                                        onChange={(val) => onFieldChange(field.id, val)}
                                    />
                                ) : (
                                    <DisplayField field={field} value={formData[field.id]} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Action Buttons for Editable Steps */}
                {isEditable && step.status !== 'IN_CLARIFICATION' && (
                    <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end gap-3">
                        <Button
                            onClick={onSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Step'}
                        </Button>
                    </div>
                )}
            </Card>
        </motion.div>
    );
}

