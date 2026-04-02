# Phase 0: Scaffold

Initialize the Next.js project with full folder structure, all dependencies, and configuration. No features yet — just a working foundation.

## Tasks

- [ ] Initialize Next.js 15 with TypeScript, Tailwind, App Router
- [ ] Install all dependencies (see list below)
- [ ] Configure `tsconfig.json` with path aliases
- [ ] Configure `next.config.ts` — mark Monaco and Excalidraw as client-only
- [ ] Set up `tailwind.config.ts` with design tokens
- [ ] Create `src/types/index.ts` — all domain types
- [ ] Create `src/lib/utils.ts` — `cn()`, `requireRole()`, `SUPPORTED_LANGUAGES`, helpers
- [ ] Create `src/lib/sheets/client.ts` — Sheets client + RANGES (9 tabs)
- [ ] Create `src/lib/auth/session.ts` — sign/verify `cg_session` with jose
- [ ] Create `src/lib/auth/external.ts` — call `EXTERNAL_AUTH_URL/auth/me/`
- [ ] Create folder structure for all routes (session/, staff/, management/, admin/)
- [ ] Create root layout with font and metadata
- [ ] Create placeholder pages for all routes
- [ ] Create `.env.example`
- [ ] Verify `npm run dev` starts without errors

## Key Files Created in This Phase

```
package.json
next.config.ts
tailwind.config.ts
tsconfig.json
.env.example
src/
  types/index.ts
  lib/utils.ts
  lib/auth/session.ts
  lib/auth/external.ts
  lib/sheets/client.ts
  app/layout.tsx
  app/page.tsx
  app/session/[id]/page.tsx
  app/(staff)/layout.tsx
  app/(staff)/dashboard/page.tsx
  app/(staff)/screening/[id]/page.tsx
  app/(management)/layout.tsx
  app/(management)/candidates/page.tsx
  app/(management)/candidates/[id]/page.tsx
  app/(admin)/layout.tsx
  app/(admin)/questions/page.tsx
  app/(admin)/users/page.tsx
  middleware.ts
```

## Dependencies

```json
{
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "googleapis": "^144.0.0",
    "jose": "^5.9.6",
    "zustand": "^5.0.0",
    "@monaco-editor/react": "^4.6.0",
    "@excalidraw/excalidraw": "^0.17.6",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-collapsible": "^1.1.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.468.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.3.0",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.1",
    "@tailwindcss/typography": "^0.5.15"
  }
}
```

**Removed from initial plan:** `next-auth` — replaced by custom jose-based session.

## next.config.ts Note

Monaco Editor and Excalidraw are bundled with browser-only APIs. Mark them as external in the server bundle:

```typescript
const config: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['googleapis'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent Monaco and Excalidraw from bundling server-side
      config.externals = [...(config.externals ?? []), '@monaco-editor/react', '@excalidraw/excalidraw']
    }
    return config
  },
}
```

Both are always used with `dynamic(() => import(...), { ssr: false })` — this config is a safety net.

## Acceptance Criteria

- `npm run dev` starts on port 3000
- No TypeScript errors (`npm run build`)
- All path aliases resolve (`@/lib/*`, `@/components/*`, `@/types`)
- `.env.example` documents all required variables
- No `next-auth` in dependencies
