import { Component, ReactNode, type ErrorInfo } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                    <Card className="max-w-md w-full">
                        <CardHeader
                            title="Something went wrong"
                            subtitle="The application encountered an unexpected error"
                        />
                        <div className="p-6 pt-0 space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                <p className="text-sm text-red-700 font-mono break-all">
                                    {this.state.error?.message || 'Unknown error'}
                                </p>
                            </div>
                            <Button onClick={this.handleReload} className="w-full">
                                Reload Application
                            </Button>
                        </div>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
