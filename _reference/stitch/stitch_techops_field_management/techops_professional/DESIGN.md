---
name: TechOps Professional
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
  code-brand:
    fontFamily: DM Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 16px
---

## Brand & Style

The design system is engineered for the high-stakes environment of TechOps management, where clarity, reliability, and speed of information processing are paramount. It adopts a **Corporate / Modern** aesthetic, utilizing a clean "white card" metaphor to isolate complex data into digestible modules. 

The brand personality is authoritative yet accessible, evoking a sense of operational control. By leveraging heavy whitespace and a sophisticated light-wash background, the UI reduces cognitive load, allowing technical users to focus on critical system statuses and performance metrics. The visual language balances the utility of a professional tool with the slickness of modern SaaS interfaces.

## Colors

The palette is anchored by a high-energy **Primary Blue** (#2563EB), signaling trust and technical competence. The **Background** (#F0F4FF) provides a cool, light blue-gray foundation that makes white surfaces pop, creating distinct visual depth without relying on heavy borders.

**Accent Amber** (#F59E0B) is reserved for warnings and moderate-priority items, while **Success Green** and **Danger Red** provide immediate semantic feedback for system health. Neutral tones should be derived from the background hue to maintain a cohesive, cool-toned environment, avoiding muddy grays in favor of blue-tinted slates.

## Typography

The typography system prioritizes legibility and data density. **Inter** is utilized for all functional UI elements, providing a neutral, systematic feel that performs exceptionally well in data-heavy layouts. Its high x-height ensures that technical labels remain readable even at small scales.

For branding and logo applications, **DM Mono** introduces a technical, "code-adjacent" character that resonates with the TechOps audience. This monospaced touch should be used sparingly, primarily for the logo and perhaps for specific technical ID strings or terminal outputs to reinforce the "Ops" identity.

## Layout & Spacing

The design system employs a **fluid grid** model optimized for dashboard environments. A 4px base unit governs all spacing decisions, creating a strict rhythmic alignment. 

Margins and gutters are set to a standard 16px to ensure breathable separation between data modules. In mobile views, cards should span the full width of the viewport minus the side margins. In desktop views, the layout expands into a multi-column format where cards can be grouped into logical functional zones (e.g., a 2/3 main view and 1/3 sidebar).

## Elevation & Depth

This design system utilizes **ambient shadows** and **tonal layering** to create hierarchy. Since the primary background is a light blue-gray (#F0F4FF), white cards (#FFFFFF) naturally advance toward the user.

Depth is reinforced by a single, soft global shadow style: `0 4px 16px rgba(0,0,0,0.08)`. This shadow should be applied only to primary content cards and floating elements like the bottom navigation bar. Interactive elements like buttons do not use shadows; instead, they rely on solid color fills to indicate their interactive state. Avoid using heavy borders or multiple shadow levels to maintain a clean, modern aesthetic.

## Shapes

The shape language is defined by a consistent **16px (1rem)** corner radius for all primary containers (cards, modals). This significant roundedness softens the technical nature of the app, making the professional tool feel modern and user-friendly.

Smaller components like buttons follow this rounded theme but may use a slightly tighter radius or a full "pill" shape where appropriate. Status indicators and badges must always be pill-shaped to distinguish them from interactive buttons and static containers.

## Components

### Cards
White surfaces with a 16px border-radius and soft global shadow. Cards are the primary container for all data visualizations and lists.

### Buttons
Fully rounded (pill-shaped) or 8px rounded corners with solid primary color fills. Labels are centered, using `label-md` or `body-md` bold typography. 

### Pill Badges
Used for status and priority. These are small, pill-shaped containers with low-opacity background tints (10-15%) of the semantic color (Success, Danger, Accent) and high-contrast text of the same hue.

### Bottom Navigation Bar
A floating white container at the bottom of the screen with the global shadow. It contains 4-5 icons with active states indicated by the Primary Blue color.

### Avatars
Circular containers using a palette of various muted professional colors. Initials are centered in white `label-md` typography.

### Input Fields
White backgrounds with a subtle 1px border in a light slate tone. On focus, the border transitions to Primary Blue with a subtle glow.

### Lists
Clean, borderless lists within cards, separated by light 1px horizontal dividers (#E2E8F0). Each list item should have ample vertical padding (12px-16px).