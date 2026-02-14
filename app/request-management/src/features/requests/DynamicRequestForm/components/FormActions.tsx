import { motion } from 'framer-motion';
import { Loader2, Send, Save, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/ui';

interface FormActionsProps {
    isEditMode: boolean;
    isDraft: boolean;
    isLoading: boolean;
    isSaving: boolean;
    isSubmitting: boolean;
    isDeleting: boolean;
    onSave: () => void;
    onCancel: () => void;
    onDiscard: () => void;
}

/**
 * Form action buttons: Cancel, Save Draft, Submit, and optionally Discard
 */
export function FormActions({
    isEditMode,
    isDraft,
    isLoading,
    isSaving,
    isSubmitting,
    isDeleting,
    onSave,
    onCancel,
    onDiscard
}: FormActionsProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-end gap-3 pt-4 border-t border-slate-100"
        >
            {isEditMode && isDraft && (
                <Button
                    variant="destructive"
                    type="button"
                    onClick={onDiscard}
                    disabled={isLoading || isDeleting}
                    className="gap-2 mr-auto"
                >
                    {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Trash2 className="w-4 h-4" />
                    )}
                    Discard
                </Button>
            )}

            <Button
                variant="outline"
                type="button"
                onClick={onCancel}
                disabled={isLoading}
            >
                Cancel
            </Button>
            <Button
                variant="outline"
                type="button"
                onClick={onSave}
                disabled={isLoading}
                className="gap-2"
            >
                {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Save className="w-4 h-4" />
                )}
                Save Draft
            </Button>
            <Button
                type="submit"
                disabled={isLoading}
                className="gap-2"
            >
                {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Send className="w-4 h-4" />
                )}
                Submit Request
            </Button>
        </motion.div>
    );
}
