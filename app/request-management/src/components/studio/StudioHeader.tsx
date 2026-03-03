import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Pencil, Check, X, ChevronDown, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getIconConfig, getAllIcons, searchIcons, ICON_CATEGORIES, type IconCategory } from '../../config/iconConfig';

interface StudioHeaderProps {
    title: string;
    description?: string;
    isActive?: boolean;
    icon?: string;
    backLink?: string;
    onTitleChange?: (title: string) => void;
    onDescriptionChange?: (description: string) => void;
    onActiveChange?: (isActive: boolean) => void;
    onIconChange?: (icon: string) => void;
    onDiscard?: () => void;
    onBack?: () => void;
    actions?: React.ReactNode;
    isDirty?: boolean;
}

export function StudioHeader({
    title,
    description,
    isActive = true,
    icon = 'workflow',
    backLink = '/studio',
    onTitleChange,
    onDescriptionChange,
    onActiveChange,
    onIconChange,
    onDiscard,
    onBack,
    actions,
    isDirty = false,
}: StudioHeaderProps) {
    const navigate = useNavigate();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState(title);
    const [editDescValue, setEditDescValue] = useState(description || '');
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [iconSearch, setIconSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<IconCategory | 'all'>('all');
    const iconPickerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Get current icon config
    const iconConfig = getIconConfig(icon);
    const IconComponent = iconConfig.icon;

    // Filter icons based on search and category
    const filteredIcons = useMemo(() => {
        let icons = iconSearch.trim() ? searchIcons(iconSearch) : getAllIcons();
        if (activeCategory !== 'all') {
            icons = icons.filter(i => i.category === activeCategory);
        }
        return icons;
    }, [iconSearch, activeCategory]);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
                setShowIconPicker(false);
                setIconSearch('');
                setActiveCategory('all');
            }
        };
        if (showIconPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            // Focus search input when picker opens
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showIconPicker]);

    const handleSaveTitle = () => {
        if (editTitleValue.trim() && onTitleChange) {
            onTitleChange(editTitleValue.trim());
        }
        setIsEditingTitle(false);
    };

    const handleSaveDesc = () => {
        if (onDescriptionChange) {
            onDescriptionChange(editDescValue.trim());
        }
        setIsEditingDesc(false);
    };

    const handleIconSelect = (iconId: string) => {
        if (onIconChange) {
            onIconChange(iconId);
        }
        setShowIconPicker(false);
        setIconSearch('');
        setActiveCategory('all');
    };

    const categoryList: Array<{ id: IconCategory | 'all'; label: string }> = [
        { id: 'all', label: 'All' },
        ...Object.entries(ICON_CATEGORIES).map(([id, { label }]) => ({ id: id as IconCategory, label }))
    ];

    return (
        <motion.div
            className="flex items-center justify-between w-full min-w-0"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Left Side: Back + Icon + Title + Description + Status */}
            <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                <button
                    onClick={() => onBack ? onBack() : navigate(backLink)}
                    className="flex items-center gap-2 text-slate-500 hover:text-[#b10e10] transition-colors text-sm flex-shrink-0 bg-transparent border-none cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </button>
                <div className="h-8 w-px bg-slate-200 flex-shrink-0" />

                {/* Icon Picker */}
                <div className="relative flex-shrink-0" ref={iconPickerRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onIconChange && setShowIconPicker(!showIconPicker)}
                        className={`w-12 h-12 rounded-xl ${iconConfig.bgColor} ${onIconChange ? 'hover:ring-2 hover:ring-offset-2 hover:ring-[#b10e10]/30' : ''}`}
                        title={onIconChange ? 'Click to change icon' : iconConfig.label}
                        disabled={!onIconChange}
                    >
                        <IconComponent size={24} className={iconConfig.color} />
                        {onIconChange && (
                            <ChevronDown size={10} className="absolute bottom-1 right-1 text-slate-400" />
                        )}
                    </Button>

                    {/* Icon Picker Dropdown */}
                    <AnimatePresence>
                        {showIconPicker && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-14 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-[360px]"
                            >
                                {/* Search Input */}
                                <div className="relative mb-3">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                                    <Input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search icons..."
                                        value={iconSearch}
                                        onChange={(e) => setIconSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>

                                {/* Category Tabs */}
                                <div className="flex flex-wrap gap-1 mb-3 pb-2 border-b border-slate-100">
                                    {categoryList.map(cat => (
                                        <Button
                                            key={cat.id}
                                            variant={activeCategory === cat.id ? 'default' : 'secondary'}
                                            size="sm"
                                            onClick={() => setActiveCategory(cat.id)}
                                            className="h-7 px-2 text-xs"
                                        >
                                            {cat.label}
                                        </Button>
                                    ))}
                                </div>

                                {/* Icons Grid */}
                                <div className="grid grid-cols-8 gap-1.5 max-h-[240px] overflow-y-auto">
                                    {filteredIcons.map((item) => {
                                        const ItemIcon = item.icon;
                                        const isSelected = item.id === icon;
                                        return (
                                            <Button
                                                key={item.id}
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleIconSelect(item.id)}
                                                className={`w-9 h-9 rounded-lg ${item.bgColor} ${isSelected ? 'ring-2 ring-[#b10e10] ring-offset-1' : 'hover:ring-2 hover:ring-slate-300'}`}
                                                title={item.label}
                                            >
                                                <ItemIcon size={16} className={item.color} />
                                            </Button>
                                        );
                                    })}
                                </div>

                                {filteredIcons.length === 0 && (
                                    <p className="text-center text-sm text-slate-400 py-4">No icons found</p>
                                )}

                                {/* Icon Count */}
                                <p className="text-xs text-slate-400 mt-2 text-center">
                                    {filteredIcons.length} icons
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Title + Description Block */}
                <div className="flex flex-col min-w-0">
                    {/* Title Row */}
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2">
                            <Input
                                type="text"
                                value={editTitleValue}
                                onChange={(e) => setEditTitleValue(e.target.value)}
                                className="text-xl font-semibold"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') { setEditTitleValue(title); setIsEditingTitle(false); }
                                }}
                            />
                            <Button size="icon" onClick={handleSaveTitle} className="h-8 w-8">
                                <Check size={14} />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => { setEditTitleValue(title); setIsEditingTitle(false); }} className="h-8 w-8">
                                <X size={14} />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group">
                            <h1 className="text-xl font-semibold text-slate-900 truncate">{title}</h1>
                            {onTitleChange && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditTitleValue(title); setIsEditingTitle(true); }}
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#b10e10] hover:bg-red-50"
                                >
                                    <Pencil size={14} />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Description Row */}
                    {isEditingDesc ? (
                        <div className="flex items-center gap-2 mt-1">
                            <Input
                                type="text"
                                value={editDescValue}
                                onChange={(e) => setEditDescValue(e.target.value)}
                                className="text-sm min-w-[300px]"
                                placeholder="Enter description..."
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveDesc();
                                    if (e.key === 'Escape') { setEditDescValue(description || ''); setIsEditingDesc(false); }
                                }}
                            />
                            <Button size="icon" onClick={handleSaveDesc} className="h-7 w-7">
                                <Check size={12} />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => { setEditDescValue(description || ''); setIsEditingDesc(false); }} className="h-7 w-7">
                                <X size={12} />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group mt-0.5 min-w-0">
                            <p
                                className="text-xs text-slate-500 truncate max-w-[600px]"
                                title={description}
                            >
                                {description || 'No description'}
                            </p>
                            {onDescriptionChange && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditDescValue(description || ''); setIsEditingDesc(true); }}
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#b10e10] hover:bg-red-50"
                                >
                                    <Pencil size={10} />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Status Badge */}
                {onActiveChange && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onActiveChange(!isActive)}
                        className={`ml-4 rounded-full ${isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        {isActive ? '● Active' : '○ Inactive'}
                    </Button>
                )}
            </div>

            {/* Right Side: Discard + Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
                {isDirty && onDiscard && (
                    <Button
                        variant="outline"
                        onClick={onDiscard}
                    >
                        Discard
                    </Button>
                )}
                {actions}
            </div>
        </motion.div>
    );
}
