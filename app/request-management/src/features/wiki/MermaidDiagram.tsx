import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid with configuration
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'Inter, sans-serif',
});

interface MermaidDiagramProps {
    chart: string;
}

/**
 * Renders a Mermaid diagram from a chart definition string.
 */
export function MermaidDiagram({ chart }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [svg, setSvg] = useState<string>('');

    useEffect(() => {
        const renderDiagram = async () => {
            if (!containerRef.current || !chart.trim()) return;

            try {
                // Generate a unique ID for the diagram
                const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

                // Render the mermaid diagram
                const { svg } = await mermaid.render(id, chart.trim());
                setSvg(svg);
                setError(null);
            } catch (err) {
                console.error('Mermaid render error:', err);
                setError(err instanceof Error ? err.message : 'Failed to render diagram');
            }
        };

        renderDiagram();
    }, [chart]);

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                <p className="text-red-600 text-sm font-medium">Failed to render diagram</p>
                <pre className="text-red-500 text-xs mt-2 overflow-x-auto">{error}</pre>
                <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">Show source</summary>
                    <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">{chart}</pre>
                </details>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="my-4 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
