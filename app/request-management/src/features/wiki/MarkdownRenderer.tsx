import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownRendererProps {
    content: string;
}

/**
 * Renders Markdown content with GitHub Flavored Markdown support.
 * Supports tables, strikethrough, task lists, auto-links, and Mermaid diagrams.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <div className="prose prose-slate max-w-none prose-code:before:content-none prose-code:after:content-none prose-code:bg-transparent prose-code:p-0 prose-code:font-normal">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom heading styles
                    h1: ({ children }) => (
                        <h1 className="text-3xl font-bold text-gray-900 border-b pb-2 mb-4">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-3">
                            {children}
                        </h3>
                    ),
                    // Table styling - clean and minimal
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                            <table className="min-w-full divide-y divide-gray-200">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-gray-50">
                            {children}
                        </thead>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                            {children}
                        </td>
                    ),
                    // Code blocks with Mermaid support
                    code: ({ inline, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';

                        // Render Mermaid diagrams
                        if (!inline && language === 'mermaid') {
                            return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
                        }

                        if (inline) {
                            return (
                                <code className="text-blue-600 font-medium" {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Links
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className="text-blue-600 hover:text-blue-800 underline"
                            target={href?.startsWith('http') ? '_blank' : undefined}
                            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                            {children}
                        </a>
                    ),
                    // Blockquotes (for callouts)
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 py-2 my-4 text-gray-700">
                            {children}
                        </blockquote>
                    ),
                    // Lists
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 my-2">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 my-2">
                            {children}
                        </ol>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
