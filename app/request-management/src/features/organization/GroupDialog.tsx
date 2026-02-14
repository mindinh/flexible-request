import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Textarea } from '../../components/ui/TextArea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/Select';
import { Loader2 } from 'lucide-react';
import { AdminService } from '../../services/AdminService';
import type { ShadowGroup, SupportType } from '../../types/IdentityEntities';
import { globalEvents, EVENT_TYPES } from '../../lib/events';

interface GroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group?: ShadowGroup | null; // null = create mode, defined = edit mode
    onSuccess: () => void;
}

/**
 * GroupDialog - Create or Edit a Shadow Group.
 * 
 * In create mode, shows empty form with type selection.
 * In edit mode, pre-fills form with existing group data.
 */
export function GroupDialog({ open, onOpenChange, group, onSuccess }: GroupDialogProps) {
    const isEditMode = !!group;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [typeId, setTypeId] = useState('');
    const [supportTypes, setSupportTypes] = useState<SupportType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingTypes, setIsLoadingTypes] = useState(true);

    // Load support types when dialog opens
    useEffect(() => {
        if (open) {
            loadSupportTypes();
            if (group) {
                setName(group.name);
                setDescription(group.description || '');
                setTypeId(group.type_ID);
            } else {
                // Reset form for create mode
                setName('');
                setDescription('');
                setTypeId('');
            }
        }
    }, [open, group]);

    async function loadSupportTypes() {
        try {
            setIsLoadingTypes(true);
            const types = await AdminService.getSupportTypes();
            // Filter to only enabled types that are GROUP-like (not USER or POSITION)
            const groupTypes = types.filter(t =>
                t.isEnabled &&
                t.code !== 'USER' &&
                t.code !== 'POSITION'
            );
            setSupportTypes(groupTypes);

            // Default to first available type if creating
            if (!group && groupTypes.length > 0 && !typeId) {
                setTypeId(groupTypes[0].ID);
            }
        } catch (error) {
            console.error('Failed to load support types:', error);
            globalEvents.emit(EVENT_TYPES.API_ERROR, 'Failed to load group types');
        } finally {
            setIsLoadingTypes(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!name.trim()) {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Group name is required');
            return;
        }

        if (!typeId) {
            globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Please select a group type');
            return;
        }

        try {
            setIsLoading(true);

            if (isEditMode && group) {
                await AdminService.updateShadowGroup(group.ID, {
                    name: name.trim(),
                    description: description.trim() || undefined
                });
                globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, `Group "${name}" updated`);
            } else {
                await AdminService.createShadowGroup({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    type_ID: typeId
                });
                globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, `Group "${name}" created`);
            }

            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to save group:', error);
            const errorMessage = error?.response?.data?.error?.message || 'Failed to save group';
            globalEvents.emit(EVENT_TYPES.API_ERROR, errorMessage);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEditMode ? 'Edit Group' : 'Create Group'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? 'Update the group name and description.'
                            : 'Create a new group for workflow assignment.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Group Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Finance Team"
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>

                    {/* Group Type (only for create mode) */}
                    {!isEditMode && (
                        <div className="space-y-2">
                            <Label htmlFor="type">Type *</Label>
                            <Select
                                value={typeId}
                                onValueChange={setTypeId}
                                disabled={isLoading || isLoadingTypes}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingTypes ? 'Loading...' : 'Select type'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {supportTypes.map(type => (
                                        <SelectItem key={type.ID} value={type.ID}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                                Type cannot be changed after creation
                            </p>
                        </div>
                    )}

                    {/* Show type as read-only in edit mode */}
                    {isEditMode && group?.type && (
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <div className="px-3 py-2 bg-slate-50 rounded-md text-sm text-slate-600">
                                {group.type.name || group.type.code}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description for this group"
                            rows={3}
                            disabled={isLoading}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isEditMode ? 'Save Changes' : 'Create Group'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
