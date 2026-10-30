# Tailwind CSS v4 to v3 Downgrade Todo List

This document tracks the progress of downgrading Tailwind CSS from v4 to v3 to ensure compatibility with older browsers (such as Chrome 86).

## Phase 1: Dependencies Update
- [x] Uninstall Tailwind v4 (`tailwindcss`, `@tailwindcss/vite`)
- [x] Install Tailwind v3 (`tailwindcss@^3.4.17`, `postcss`, `autoprefixer`)

## Phase 2: Configuration Setup
- [x] Create `tailwind.config.ts` with theme configurations, color tokens, and content paths (`./index.html`, `./src/**/*.{ts,tsx,js,jsx}`)
- [x] Create `postcss.config.js` configured with `tailwindcss` and `autoprefixer`

## Phase 3: Style & CSS Refactoring (`src/styles.css`)
- [x] Replace `@import "tailwindcss";` with Tailwind v3 directives (`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`)
- [x] Convert `@theme inline` block into Tailwind v3 `theme.extend` configuration inside `tailwind.config.ts`
- [x] Verify font imports, custom font-faces, and CSS variables

## Phase 4: Vite Configuration Update (`vite.config.ts`)
- [x] Remove `@tailwindcss/vite` import and plugin from Vite plugins array

## Phase 5: Verification & Testing
- [x] Run project build (`npm run build`) to ensure zero build errors
- [x] Run linter & type check (`npm run lint`, `tsc`)
- [x] Verify UI rendering and layout correctness
