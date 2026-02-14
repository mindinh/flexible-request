import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge, Button } from '../../../../components/ui';
import { getRequestStatusConfig, getIconConfig } from '../../../../config';
import type { RequestDetailData } from '../types';

interface RequestDetailHeaderProps {
    request: RequestDetailData;
    onBack: () => void;
}

/**
 * Request detail page header with back button, icon, title, and status
 */
export function RequestDetailHeader({ request, onBack }: RequestDetailHeaderProps) {
    const statusInfo = getRequestStatusConfig(request.status);
    const iconConfig = getIconConfig(request.requestType?.icon);

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
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900">{request.title}</h1>
                        <Badge variant={statusInfo.variant} dot>{statusInfo.label}</Badge>
                    </div>
                    <p className="text-slate-500 mt-1">
                        {request.requestType?.title} • Created {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
