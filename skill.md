# UI/UX Pro Max Design Intelligence Rules for Freebuff

You are equipped with the UI/UX Pro Max framework guidelines. Follow these rules strictly when implementing, refactoring, or reviewing any frontend code (React, Next.js, Vue, Svelte, Tailwind CSS, shadcn/ui, etc.).

## 1. Core Visual Styles Matrix
When building or modifying UI layouts, select from these core professional design tracks instead of relying on default/generic setups:
- **Soft UI Evolution:** Soft shadows, subtle organic shapes, premium/calming feel. (Best for: Wellness, lifestyle, premium services).
- **Minimalism & Bento Grid:** Crisp borders, structured grid layouts, high whitespace, strict structural data encapsulation. (Best for: SaaS, Dashboards, Developer Tools).
- **Glassmorphism / Claymorphism:** Matte translucency or 3D pastel depths, utilizing backdrop-filters (`backdrop-blur`). Use sparingly for headers/modals.
- **Brutalism / Neo-brutalism:** High-contrast thick borders (`border-4 border-black`), solid drop shadows without blur, vibrant block colors.

## 2. Product-Specific Color Palettes & Moods
Align your color choices strictly with the industry sector:
- **Tech & SaaS:** Deep slates, cool grays, clear blues, vibrant accents (e.g., `#0F172A`, `#3B82F6`).
- **Finance & Fintech:** Professional deep greens, rich navies, trustworthy neutrals. 
- **Healthcare & Wellness:** Soft pinks, calming sage greens, warm creams (e.g., Primary `#E8B4B8`, Secondary `#A8D5BA`).
- **E-Commerce & Luxury:** High-contrast monochrome, elegant gold accents, minimal canvas backgrounds.

## 3. Strict Anti-Patterns (WHAT NOT TO DO)
- ❌ **NO AI Gradients:** Avoid generic, overly saturated neon purple-to-pink gradients unless explicitly requested for an AI-native feature.
- ❌ **NO Emojis as Icons:** Do not use regular text emojis for UI navigation or action indicators. Always use clean, functional SVG or icon library components (e.g., Lucide React, Heroicons).
- ❌ **NO Missing States:** Never omit `cursor-pointer` on interactive items. Always define `:hover`, `:focus-visible`, and interactive transition times (typically `duration-200` to `duration-300`).

## 4. Accessibility & Quality Checklist (WCAG AA)
- **Contrast:** Ensure all text passes a minimum 4.5:1 contrast ratio (3:1 for large text).
- **Interactive Elements:** Ensure focus rings are highly visible (`focus-visible:ring-2`).
- **Icon Buttons:** Always include descriptive `aria-label` or `aria-hidden` attributes on icon-only buttons.
- **Responsive & Dynamic Scaling:** Keep elements flexible; ensure layouts don't break or truncate when text sizes dynamically scale.

## 5. Implementation Workflow
When requested to build a new view or component:
1. **Analyze Requirements:** Match the project archetype to the specific style guidelines above.
2. **Draft Tokens:** Define clean Tailwind configurations or design token variables before writing markup.
3. **Check Safety:** Before finishing, review the layout against the anti-patterns listed in Section 3.