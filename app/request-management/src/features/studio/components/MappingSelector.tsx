import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Label } from '@/components/ui/label';
import { Database, PencilLine } from 'lucide-react';

interface MappingSource {
    stepId: string;
    stepName: string;
    fieldId: string;
    fieldName: string;
}

interface MappingSelectorProps {
    availableSources: MappingSource[];
    value?: { sourceStepId: string; sourceFieldId: string };
    onChange: (value: { sourceStepId: string; sourceFieldId: string } | undefined) => void;
    label?: string;
}

export function MappingSelector({ availableSources, value, onChange, label }: MappingSelectorProps) {
    const selectedSource = availableSources.find(
        s => s.stepId === value?.sourceStepId && s.fieldId === value?.sourceFieldId
    );

    return (
        <div className="space-y-1.5">
            {label && <Label className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{label}</Label>}
            <Select
                value={selectedSource ? `${selectedSource.stepId}#${selectedSource.fieldId}` : 'none'}
                onValueChange={(val) => {
                    if (val === 'none') {
                        onChange(undefined);
                    } else {
                        const [stepId, fieldId] = val.split('#');
                        onChange({ sourceStepId: stepId, sourceFieldId: fieldId });
                    }
                }}
            >
                <SelectTrigger className="w-full h-9 text-xs bg-slate-50/50 hover:bg-slate-100/50 border-slate-200 transition-colors">
                    <SelectValue placeholder="Select source field..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none" className="text-xs italic text-slate-400">
                        <div className="flex items-center gap-2">
                            <PencilLine size={12} />
                            No Mapping (Manual Entry)
                        </div>
                    </SelectItem>
                    {availableSources.map((source) => (
                        <SelectItem
                            key={`${source.stepId}#${source.fieldId}`}
                            value={`${source.stepId}#${source.fieldId}`}
                            className="text-xs"
                        >
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-700">{source.fieldName}</span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Database size={10} />
                                    From: {source.stepName}
                                </span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
