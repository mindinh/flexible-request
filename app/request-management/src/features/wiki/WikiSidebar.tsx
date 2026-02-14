import { NavLink } from 'react-router-dom';
import { ChevronRight, ChevronDown, FileText, Book, Folder } from 'lucide-react';
import { useState } from 'react';
import type { DocItem } from './wikiConfig';

interface WikiSidebarProps {
    docs: DocItem[];
    currentSlug?: string;
}

function NavItem({ item, depth = 0, currentSlug }: { item: DocItem; depth?: number; currentSlug?: string }) {
    const hasChildren = item.children && item.children.length > 0;
    const isCurrentOrChild = currentSlug === item.slug ||
        (item.children?.some(c => c.slug === currentSlug));
    const [isExpanded, setIsExpanded] = useState(isCurrentOrChild);

    const handleClick = (e: React.MouseEvent) => {
        if (hasChildren) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div>
            <NavLink
                to={item.path ? `/wiki/${item.slug}` : '#'}
                onClick={handleClick}
                className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${isActive && item.path
                        ? 'bg-red-50 text-red-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                }
                style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
                {hasChildren ? (
                    isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                ) : (
                    <FileText className="w-4 h-4" />
                )}
                <span className="truncate">{item.title}</span>
            </NavLink>
            {hasChildren && isExpanded && (
                <div>
                    {item.children!.map((child) => (
                        <NavItem key={child.slug} item={child} depth={depth + 1} currentSlug={currentSlug} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function WikiSidebar({ docs, currentSlug }: WikiSidebarProps) {
    return (
        <aside className="w-80 bg-white border-r border-gray-200 h-full overflow-y-auto flex-shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <Book className="w-5 h-5 text-red-600" />
                    <h2 className="font-semibold text-gray-900">Documentation</h2>
                </div>
            </div>

            {/* Navigation */}
            <nav className="p-2">
                {docs.map((item) => (
                    <NavItem key={item.slug} item={item} currentSlug={currentSlug} />
                ))}
            </nav>
        </aside>
    );
}
