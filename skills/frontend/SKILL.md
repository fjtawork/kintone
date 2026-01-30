---
name: Frontend Development (Next.js)
description: Best practices and guidelines for developing the frontend of the kintone clone.
---

# Frontend Development Skill

When working in the `frontend/` directory, follow these guidelines.

## Tech Stack
- **Framework**: Next.js (App Router)
- **UI Component**: Shadcn UI (Tailwind CSS)
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod

## Rules

### 1. Component Structure
Use **Atomic Design** principles adapted for Next.js:
- `components/ui`: Primitive components (Buttons, Inputs) - *Do not edit manually if installed via Shadcn*.
- `components/common`: Shared composite components.
- `features/[feature-name]/components`: Feature-specific components (e.g., `features/app-builder/FieldEditor.tsx`).

### 2. Branding & Styling
- Use **Tailwind CSS** for styling.
- Avoid inline styles.
- Maintain a "Premium" look: use subtle shadows, rounded corners, and smooth transitions `transition-all duration-200`.

### 3. Data Fetching
- **Server Components**: Use `await fetch()` or direct DB calls (via Server Actions) for initial data.
- **Client Components**: Use `useQuery` (TanStack Query) for dynamic data.
- **Mutations**: Use Server Actions validated with **Zod** schema.

### 4. Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `kebab-case.ts`
