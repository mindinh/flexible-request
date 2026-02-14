/**
 * Centralized icon configuration for Request Types.
 * Maps icon identifiers (stored in DB) to Lucide React components and colors.
 * 60+ curated business icons organized by category.
 */
import {
    // Travel & Logistics
    Plane, Car, Train, Ship, Truck, MapPin, Globe, Navigation, Route, Compass,
    // Finance & Money
    DollarSign, CreditCard, Wallet, Receipt, Coins, Banknote, PiggyBank, TrendingUp, BarChart, PieChart,
    // Shopping & Commerce
    ShoppingCart, ShoppingBag, Package, Box, Gift, Tag, Store, Barcode,
    // People & Organization
    Users, User, UserCheck, UserPlus, Building2, Building, Landmark, Factory,
    // Time & Calendar
    Calendar, Clock, Timer, Hourglass, CalendarCheck, CalendarPlus,
    // Documents & Files
    FileText, Folder, FolderOpen, Clipboard, ClipboardCheck, FileSignature, FilePlus, FileCheck, Files,
    // Security & Access
    Key, Lock, Unlock, Shield, ShieldCheck, Eye, EyeOff, Fingerprint,
    // Communication
    Mail, MessageSquare, Phone, Video, Send, Bell, BellRing,
    // Equipment & IT
    Laptop, Monitor, Printer, Smartphone, Headphones, Server, Cpu, HardDrive, Wifi,
    // Tools & Work
    Wrench, Settings, Hammer, Briefcase, ClipboardList, CheckSquare, ListChecks,
    // Nature & Environment
    Leaf, Trees, Sun, Cloud, Zap,
    // Misc
    Heart, Star, Flag, Award, Target, Lightbulb, AlertTriangle, Info, HelpCircle,
    // Default
    Workflow,
    type LucideIcon
} from 'lucide-react';

export interface IconConfig {
    icon: LucideIcon;
    color: string;
    bgColor: string;
    label: string;
    category: IconCategory;
}

export type IconCategory =
    | 'travel'
    | 'finance'
    | 'shopping'
    | 'people'
    | 'time'
    | 'documents'
    | 'security'
    | 'communication'
    | 'equipment'
    | 'tools'
    | 'nature'
    | 'misc';

export const ICON_CATEGORIES: Record<IconCategory, { label: string; color: string }> = {
    travel: { label: 'Travel', color: 'text-blue-600' },
    finance: { label: 'Finance', color: 'text-green-600' },
    shopping: { label: 'Shopping', color: 'text-purple-600' },
    people: { label: 'People', color: 'text-orange-600' },
    time: { label: 'Time', color: 'text-teal-600' },
    documents: { label: 'Documents', color: 'text-gray-600' },
    security: { label: 'Security', color: 'text-red-600' },
    communication: { label: 'Communication', color: 'text-pink-600' },
    equipment: { label: 'Equipment', color: 'text-indigo-600' },
    tools: { label: 'Tools', color: 'text-amber-600' },
    nature: { label: 'Nature', color: 'text-emerald-600' },
    misc: { label: 'Other', color: 'text-slate-600' },
};

/**
 * 60+ curated business icons organized by category
 */
export const AVAILABLE_ICONS: Record<string, IconConfig> = {
    // === Travel & Logistics ===
    'plane': { icon: Plane, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Plane', category: 'travel' },
    'car': { icon: Car, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Car', category: 'travel' },
    'train': { icon: Train, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Train', category: 'travel' },
    'ship': { icon: Ship, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Ship', category: 'travel' },
    'truck': { icon: Truck, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Truck', category: 'travel' },
    'map-pin': { icon: MapPin, color: 'text-red-500', bgColor: 'bg-red-100', label: 'Location', category: 'travel' },
    'globe': { icon: Globe, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Globe', category: 'travel' },
    'navigation': { icon: Navigation, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Navigation', category: 'travel' },
    'route': { icon: Route, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Route', category: 'travel' },
    'compass': { icon: Compass, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Compass', category: 'travel' },

    // === Finance & Money ===
    'dollar-sign': { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Dollar', category: 'finance' },
    'credit-card': { icon: CreditCard, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Credit Card', category: 'finance' },
    'wallet': { icon: Wallet, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Wallet', category: 'finance' },
    'receipt': { icon: Receipt, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Receipt', category: 'finance' },
    'coins': { icon: Coins, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Coins', category: 'finance' },
    'banknote': { icon: Banknote, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Banknote', category: 'finance' },
    'piggy-bank': { icon: PiggyBank, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Savings', category: 'finance' },
    'trending-up': { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Trending Up', category: 'finance' },
    'bar-chart': { icon: BarChart, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Bar Chart', category: 'finance' },
    'pie-chart': { icon: PieChart, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Pie Chart', category: 'finance' },

    // === Shopping & Commerce ===
    'shopping-cart': { icon: ShoppingCart, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Cart', category: 'shopping' },
    'shopping-bag': { icon: ShoppingBag, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Shopping Bag', category: 'shopping' },
    'package': { icon: Package, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Package', category: 'shopping' },
    'box': { icon: Box, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Box', category: 'shopping' },
    'gift': { icon: Gift, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Gift', category: 'shopping' },
    'tag': { icon: Tag, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Tag', category: 'shopping' },
    'store': { icon: Store, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Store', category: 'shopping' },
    'barcode': { icon: Barcode, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Barcode', category: 'shopping' },

    // === People & Organization ===
    'users': { icon: Users, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Team', category: 'people' },
    'user': { icon: User, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Person', category: 'people' },
    'user-check': { icon: UserCheck, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Approved User', category: 'people' },
    'user-plus': { icon: UserPlus, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Add User', category: 'people' },
    'building': { icon: Building, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Building', category: 'people' },
    'building-2': { icon: Building2, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Office', category: 'people' },
    'landmark': { icon: Landmark, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Landmark', category: 'people' },
    'factory': { icon: Factory, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Factory', category: 'people' },

    // === Time & Calendar ===
    'calendar': { icon: Calendar, color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'Calendar', category: 'time' },
    'clock': { icon: Clock, color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'Clock', category: 'time' },
    'timer': { icon: Timer, color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'Timer', category: 'time' },
    'hourglass': { icon: Hourglass, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Hourglass', category: 'time' },
    'calendar-check': { icon: CalendarCheck, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Scheduled', category: 'time' },
    'calendar-plus': { icon: CalendarPlus, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Add Event', category: 'time' },

    // === Documents & Files ===
    'file-text': { icon: FileText, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Document', category: 'documents' },
    'folder': { icon: Folder, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Folder', category: 'documents' },
    'folder-open': { icon: FolderOpen, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Open Folder', category: 'documents' },
    'clipboard': { icon: Clipboard, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Clipboard', category: 'documents' },
    'clipboard-check': { icon: ClipboardCheck, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Checklist', category: 'documents' },
    'clipboard-list': { icon: ClipboardList, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Task List', category: 'documents' },
    'file-signature': { icon: FileSignature, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Signature', category: 'documents' },
    'file-plus': { icon: FilePlus, color: 'text-green-600', bgColor: 'bg-green-100', label: 'New File', category: 'documents' },
    'file-check': { icon: FileCheck, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Approved File', category: 'documents' },
    'files': { icon: Files, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Files', category: 'documents' },

    // === Security & Access ===
    'key': { icon: Key, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Key', category: 'security' },
    'lock': { icon: Lock, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Lock', category: 'security' },
    'unlock': { icon: Unlock, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Unlock', category: 'security' },
    'shield': { icon: Shield, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Shield', category: 'security' },
    'shield-check': { icon: ShieldCheck, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Verified', category: 'security' },
    'eye': { icon: Eye, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'View', category: 'security' },
    'eye-off': { icon: EyeOff, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Hidden', category: 'security' },
    'fingerprint': { icon: Fingerprint, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Biometric', category: 'security' },

    // === Communication ===
    'mail': { icon: Mail, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Email', category: 'communication' },
    'message-square': { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Message', category: 'communication' },
    'phone': { icon: Phone, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Phone', category: 'communication' },
    'video': { icon: Video, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Video', category: 'communication' },
    'send': { icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Send', category: 'communication' },
    'bell': { icon: Bell, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Notification', category: 'communication' },
    'bell-ring': { icon: BellRing, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Alert', category: 'communication' },

    // === Equipment & IT ===
    'laptop': { icon: Laptop, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Laptop', category: 'equipment' },
    'monitor': { icon: Monitor, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Monitor', category: 'equipment' },
    'printer': { icon: Printer, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Printer', category: 'equipment' },
    'smartphone': { icon: Smartphone, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Phone', category: 'equipment' },
    'headphones': { icon: Headphones, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Headphones', category: 'equipment' },
    'server': { icon: Server, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Server', category: 'equipment' },
    'cpu': { icon: Cpu, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'CPU', category: 'equipment' },
    'hard-drive': { icon: HardDrive, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Storage', category: 'equipment' },
    'wifi': { icon: Wifi, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'WiFi', category: 'equipment' },

    // === Tools & Work ===
    'wrench': { icon: Wrench, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Wrench', category: 'tools' },
    'settings': { icon: Settings, color: 'text-zinc-600', bgColor: 'bg-zinc-100', label: 'Settings', category: 'tools' },
    'hammer': { icon: Hammer, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Hammer', category: 'tools' },
    'briefcase': { icon: Briefcase, color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'Briefcase', category: 'tools' },
    'check-square': { icon: CheckSquare, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Checkbox', category: 'tools' },
    'list-checks': { icon: ListChecks, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Checklist', category: 'tools' },

    // === Nature & Environment ===
    'leaf': { icon: Leaf, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Leaf', category: 'nature' },
    'trees': { icon: Trees, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Forest', category: 'nature' },
    'sun': { icon: Sun, color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: 'Sun', category: 'nature' },
    'cloud': { icon: Cloud, color: 'text-sky-500', bgColor: 'bg-sky-100', label: 'Cloud', category: 'nature' },
    'zap': { icon: Zap, color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: 'Energy', category: 'nature' },

    // === Misc ===
    'heart': { icon: Heart, color: 'text-red-500', bgColor: 'bg-red-100', label: 'Heart', category: 'misc' },
    'star': { icon: Star, color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: 'Star', category: 'misc' },
    'flag': { icon: Flag, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Flag', category: 'misc' },
    'award': { icon: Award, color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: 'Award', category: 'misc' },
    'target': { icon: Target, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Target', category: 'misc' },
    'lightbulb': { icon: Lightbulb, color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: 'Idea', category: 'misc' },
    'alert-triangle': { icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Warning', category: 'misc' },
    'info': { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Info', category: 'misc' },
    'help-circle': { icon: HelpCircle, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Help', category: 'misc' },

    // === Default ===
    'workflow': { icon: Workflow, color: 'text-rose-600', bgColor: 'bg-rose-100', label: 'Workflow', category: 'misc' },
};

/**
 * Get icon config by identifier, with fallback to default
 */
export function getIconConfig(iconId: string | undefined): IconConfig {
    return AVAILABLE_ICONS[iconId || 'workflow'] || AVAILABLE_ICONS['workflow'];
}

/**
 * Get all available icons for icon picker
 */
export function getAllIcons(): Array<{ id: string } & IconConfig> {
    return Object.entries(AVAILABLE_ICONS).map(([id, config]) => ({
        id,
        ...config
    }));
}

/**
 * Get icons by category
 */
export function getIconsByCategory(category: IconCategory): Array<{ id: string } & IconConfig> {
    return getAllIcons().filter(icon => icon.category === category);
}

/**
 * Search icons by label (fuzzy match)
 */
export function searchIcons(query: string): Array<{ id: string } & IconConfig> {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return getAllIcons();

    return getAllIcons().filter(icon =>
        icon.label.toLowerCase().includes(lowerQuery) ||
        icon.id.toLowerCase().includes(lowerQuery) ||
        icon.category.toLowerCase().includes(lowerQuery)
    );
}
