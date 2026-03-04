import { useState, createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/studio.css';

// Context for collapsed state
interface StudioLayoutContextType {
  isLeftCollapsed: boolean;
}

const StudioLayoutContext = createContext<StudioLayoutContextType>({ isLeftCollapsed: false });

export const useStudioLayoutContext = () => useContext(StudioLayoutContext);

interface StudioLayoutProps {
  /** Header content - typically contains title and action buttons */
  header: ReactNode;
  /** Left navigation panel render function - receives collapsed state. If omitted, left panel is hidden. */
  leftPanel?: (collapsed: boolean) => ReactNode;
  /** Tab bar content */
  tabs: ReactNode;
  /** Main content area - filled by active tab */
  children: ReactNode;
  /** Optional right panel - slides in contextually */
  rightPanel?: ReactNode;
}

/**
 * StudioLayout - The framework shell for Request Type Studio
 * 
 * This is a "content slot" architecture:
 * - Header: Fixed at top
 * - Left Panel: Collapsible navigation (2-letter abbreviations when collapsed)
 * - Tabs: Full-width tab bar below header
 * - Main Area: Filled by active tab content
 * - Right Panel: Optional contextual panel that slides in when needed
 */
export function StudioLayout({
  header,
  leftPanel,
  tabs,
  children,
  rightPanel,
}: StudioLayoutProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  return (
    <StudioLayoutContext.Provider value={{ isLeftCollapsed: leftCollapsed }}>
      <div className="studio-layout-v2">
        {/* Header - Full width */}
        <header className="studio-header-v2">
          {header}
        </header>

        {/* Body - Left panel + Main area */}
        <div className="studio-body">
          {/* Left Panel */}
          {leftPanel && (
            <motion.aside
              className="studio-left-v2"
              animate={{ width: leftCollapsed ? 64 : 250 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {/* Collapse Toggle */}
              <button
                onClick={() => setLeftCollapsed(!leftCollapsed)}
                className="studio-collapse-btn"
                aria-label={leftCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                {leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>

              {/* Panel Content */}
              <div className="studio-left-content">
                {leftPanel(leftCollapsed)}
              </div>
            </motion.aside>
          )}

          {/* Main Content Area */}
          <div className="studio-main-v2">
            {/* Tab Bar */}
            <nav className="studio-tabs-v2">
              {tabs}
            </nav>

            {/* Content + Optional Right Panel */}
            <div className="studio-content-area">
              {/* Main Content Slot */}
              <motion.main
                className="studio-content-v2"
                layout
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.main>

              {/* Right Panel - Slides in when content provided */}
              <AnimatePresence>
                {rightPanel}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </StudioLayoutContext.Provider>
  );
}
