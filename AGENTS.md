<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:apple-hig-rules -->
# Apple Design Guidelines

Follow these rules whenever building or reviewing UI. Based on Apple's Human
Interface Guidelines (HIG).

## 0. Scope limit

- Do NOT change colors, palettes, or overall visual design without being explicitly asked.
- Do NOT make large/structural design changes (layout overhauls, rebranding, new visual style) on your own initiative.
- Apply these rules only to the specific component/screen being worked on — don't "fix" unrelated UI while in there.
- If you notice a violation elsewhere, flag it in a note; don't change it unprompted.

## 1. Layout & Spacing

- Use consistent spacing units: 4, 8, 12, 16, 24, 32px (multiples of 4).
- Minimum tap target: 44x44pt for any interactive element.
- Respect safe areas / notches — never place content under system bars.
- Use generous whitespace; avoid cramming content edge-to-edge.

## 2. Typography

- System font first: SF Pro (iOS/macOS) or the platform's native font stack.
- Use Dynamic Type / relative sizing — never hardcode pixel font sizes that ignore accessibility settings.
- Type scale: Large Title 34, Title 28/22, Headline 17 (semibold), Body 17, Caption 12.
- Line height ~1.2–1.4x font size for readability.

## 3. Color

- Keep the existing color scheme as-is. Don't introduce new colors or alter the palette.
- Maintain WCAG AA contrast (4.5:1 for body text) within the current palette.

## 4. Navigation

- Standard patterns: tab bar (3–5 items max) for primary navigation, nav stack for drill-down.
- Back button always top-left, consistent placement.
- Avoid custom gestures that conflict with system gestures (edge swipe = back).
- Modals for short, focused tasks; push/drill-down for browsing hierarchies.

## 5. Components

- Buttons: clear primary/secondary/destructive hierarchy. Destructive actions in red, require confirmation.
- Use native-feeling controls (switches, segmented controls, pickers) over custom reinvented ones.
- Forms: inline validation, clear error states, labels always visible (not just placeholder text).
- Loading states: skeleton screens or spinners, never a blank frozen screen.

## 6. Motion

- Animations should be fast (200–350ms) and purposeful — ease-in-out, not linear.
- Use motion to show relationships (e.g., where a modal came from), not just decoration.
- Respect "reduce motion" accessibility setting.

## 7. Accessibility

- Every interactive element needs an accessible label.
- Don't rely on color alone to convey meaning (pair with icon/text).
- Support VoiceOver navigation order matching visual order.
- Ensure focus states are visible for keyboard/switch control users.

## 8. Content & Tone

- Clear, concise copy. Sentence case for buttons/labels (not ALL CAPS or Title Case).
- Confirm destructive actions with a specific, human sentence ("Delete this listing?" not "Are you sure?").
- Empty states should guide the user to the next action, not just say "No data."

## 9. Platform Consistency

- Don't port Android/Material patterns (FABs, bottom sheets used Android-style) without adapting to iOS conventions.
- Icons: use SF Symbols where possible for a native feel.
- Respect platform-specific conventions for alerts, action sheets, and share sheets.

## 10. When to apply these

- Apply automatically to any UI/component work (React, SwiftUI, HTML/CSS) unless the user specifies a different design system.
- Flag violations proactively (e.g., "this button is 32px tall, under the 44pt tap target minimum") rather than silently fixing them.
- If a request conflicts with these rules (e.g., a non-standard gesture), implement it but note the tradeoff.

## Known violations in this codebase

The app predates these rules and breaks several of them systemically. These are
recorded so they are not rediscovered on every task, and are NOT a standing
mandate to refactor — rule 0 applies. Fix one only when asked, or when already
working in that component.

- **Tap targets under 44pt.** `h-8 w-8` (32px) in 9 files, `h-9 w-9` (36px) in
  11, including `wishlist-button.tsx`, `carzbot-chat.tsx` send/mic, and the icon
  size in `liquid-glass-button.tsx`. The feed's Search/Account buttons are 40px.
- **Hardcoded font sizes.** ~98 uses of `text-[13px]` and ~56 of `text-[11px]`,
  plus 10px and 9px. These ignore Dynamic Type, and most body copy sits at 13px
  against a Body scale of 17. Fixing this is a token change in `globals.css`,
  not a per-component edit.
- **ALL CAPS labels.** `.util-label` is `text-transform: uppercase` at 11px and
  is used throughout, against rule 8's sentence case.
- **Primary nav is 6 targets** — five items plus the menu, over rule 4's max
  of five.

Already compliant, so don't spend effort re-checking: reduce-motion is handled
in `globals.css`, `web-gl-shader.tsx`, `siri-wave.tsx`, `reveal-observer.tsx`
and `animated-countdown.tsx`; account deletion is red and double-confirmed; the
legal readers have visible focus rings.
<!-- END:apple-hig-rules -->
