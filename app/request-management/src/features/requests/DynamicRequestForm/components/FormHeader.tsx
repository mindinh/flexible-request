import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge, Button } from '../../../../components/ui';
import { getIconConfig, REQUEST_STATUS_CONFIG } from '../../../../config';

interface FormHeaderProps {
    requestType: {
        title: string;
        description?: string;
        icon?: string;
    };
    status: string;
    onBack: () => void;
}

/**
 * Header component for the dynamic request form
 * Shows request type icon, title, description, and status badge
 */
export function FormHeader({ requestType, status, onBack }: FormHeaderProps) {
    const iconConfig = getIconConfig(requestType.icon);
    const statusConfig = REQUEST_STATUS_CONFIG[status] || REQUEST_STATUS_CONFIG.DRAFT;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
        >
            <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                aria-label="Go back to requests"
            >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${iconConfig.bgColor}`}>
                    <iconConfig.icon className={`w-6 h-6 ${iconConfig.color}`} />
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-slate-900">{requestType.title}</h1>
                        <Badge variant={statusConfig.variant} className="inline-flex items-center gap-1.5">
                            {statusConfig.icon}
                            {statusConfig.label}
                        </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                        {requestType.description || 'Fill in the details below'}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
