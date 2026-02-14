import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AdminService } from '../../services/AdminService';
import type { ShadowGroup } from '../../types/IdentityEntities';
import { globalEvents, EVENT_TYPES } from '../../lib/events';

interface DeleteGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: ShadowGroup | null;
    onSuccess: () => void;
}

/**
 * DeleteGroupDialog - Confirmation dialog for deleting a group.
 * 
 * Shows warning about the action being permanent.
 * Backend will block deletion if group is used in active rules.
 */
export function DeleteGroupDialog({ open, onOpenChange, group, onSuccess }: DeleteGroupDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    async function handleDelete() {
        if (!group) return;

        try {
            setIsDeleting(true);
            await AdminService.deleteShadowGroup(group.ID);
            globalEvents.emit(EVENT_TYPES.SHOW_SUCCESS, `Group "${group.name}" deleted`);
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to delete group:', error);
            const errorMessage = error?.response?.data?.error?.message || 'Failed to delete group';
            globalEvents.emit(EVENT_TYPES.API_ERROR, errorMessage);
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <DialogTitle>Delete Group</DialogTitle>
                            <DialogDescription>
                                This action cannot be undone.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm text-slate-600">
                        Are you sure you want to delete <strong>"{group?.name}"</strong>?
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                        All members will be removed from this group. If this group is used in
                        any approval rules, the deletion will be blocked.
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Delete Group
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
