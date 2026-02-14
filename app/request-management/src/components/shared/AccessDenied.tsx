import { ShieldX, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AccessDeniedProps {
    title?: string;
    message?: string;
    showBackLink?: boolean;
}

/**
 * Access Denied component for displaying when user lacks permissions.
 * Shows a friendly message instead of blank pages or console errors.
 */
export function AccessDenied({
    title = 'Access Denied',
    message = 'You do not have permission to access this page. Please contact your administrator if you believe this is an error.',
    showBackLink = true
}: AccessDeniedProps) {
    return (
        <div className="min-h-full flex items-center justify-center p-8">
            <div className="max-w-md text-center">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
                    <ShieldX className="w-8 h-8 text-red-600" />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-semibold text-slate-900 mb-3">
                    {title}
                </h1>

                {/* Message */}
                <p className="text-slate-600 mb-6 leading-relaxed">
                    {message}
                </p>

                {/* Back Link */}
                {showBackLink && (
                    <Link
                        to="/requests"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go to My Requests
                    </Link>
                )}
            </div>
        </div>
    );
}
