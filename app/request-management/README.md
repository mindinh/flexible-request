# Flexible Request Management System

A modern, highly flexible Request Management application built with **React**, **TypeScript**, and **Vite**. This application focuses on maintainability, scalability, and adherence to DRY principles.

## 🚀 Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn/UI
- **Data Fetching**: TanStack Query (React Query)
- **Icons**: Lucide React
- **Routing**: React Router DOM

## 📂 Project Structure

The project follows a **Feature-Based Architecture**, ensuring that related logic is colocated while shared utilities are strictly centralized.

```bash
src/
├── components/          # Shared UI components
│   ├── ui/              # Reusable atoms (Buttons, Inputs, etc.)
│   └── shared/          # Global widgets (Validation, Toasts)
├── config/              # Centralized Configurations
│   ├── statusConfig.tsx # Status mappings (colors, icons, labels)
│   └── priorityConfig.ts 
├── features/            # Feature Modules (Pages + Logic)
│   ├── requests/        # Request Management (List, Create, Detail)
│   ├── inbox/           # Approval Inbox
│   └── studio/          # Process Configurator
├── layouts/             # App Shell (Sidebar, Header)
├── lib/                 # Core Utilities
│   ├── api.ts           # Centralized Axios Instance
│   └── events.ts        # Global Event Bus
├── services/            # Service Layer (API Encapsulation)
│   └── RequestService.ts
└── types/               # Centralized TypeScript Definitions
```

## 🏗️ Architectural Patterns (9.5/10 Code Quality)

We enforce strict architectural guidelines to maintain code quality:

### 1. Service Layer Pattern
All API calls are encapsulated in dedicated Service modules (e.g., `RequestService.ts`).
- **Forbidden**: Inline `axios.get()` or `api.get()` calls in components.
- **Allowed**: `queryFn: RequestService.getRequests`

### 2. Centralized Configuration
Hardcoded strings or switch-cases for UI logic (badges, colors, icons) are banned from components.
- **Pattern**: Use configuration files in `src/config/`.
- **Usage**:
  ```tsx
  import { getRequestStatusConfig } from '../../config';
  const { label, variant } = getRequestStatusConfig(status);
  ```

### 3. Feature Encapsulation & Barrel Exports
Each feature folder (e.g., `features/requests`) must have an `index.ts` file to expose its public API.
- **Benefit**: cleaner imports `import { RequestList } from '@/features/requests'`

### 4. Consolidated Utilities
- All pure functions live in `src/lib/`.
- **`lib/api.ts`**: The single source of truth for HTTP requests (interceptors, auth).
- **`utils/`**: ❌ Removed. Use `lib/` instead.

### 5. Type Safety
- All shared types (Entities, Enums) are in `src/types/index.ts`.
- Components should import types from `@/types` rather than defining local interfaces for domain objects.

## 🛠️ Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```
