🎨 Color System Overview
Role	Hex	Description
Background (App canvas)	#F3F2F1	Warm, neutral gray base used for the full page background. Keeps the layout calm and soft.
Card (Darker tone)	#EDECEA	Used for secondary containers or section backgrounds. Creates visual separation from the main background.
Card (Lighter tone)	#FEFEFE	Main surface color for cards, panels, or modals. Ensures contrast against the outer background.
Main Accent (Lime Green)	#D8F9B8	Brand-defining color. Used for CTAs, active states, highlights, and positive feedback elements.
Light Accent / Tint	#EAFBDD	Used for soft backgrounds of accent elements, icon fills, or hover states of lime buttons.
Primary Text & Icon Color	#2B2D2D	Used for all major text, icons, and primary buttons. Slightly softened black to feel modern and readable.
Subtle Lime Gray	#F3F7EF	Used as a neutral supportive tone — backgrounds for input fields, empty states, or gentle section dividers.
🧭 Usage Guidelines
1. Background & Surfaces

App background: #F3F2F1
→ Always visible around main cards. Sets the “canvas tone” and prevents stark contrast.

Cards / Sections:

Use #FEFEFE for primary content cards (e.g., dashboard panels, tables).

Use #EDECEA for secondary blocks (e.g., sidebars, grouped settings).

Nested sections or hover areas: add a light elevation via background shift, not shadows.

2. Accent Usage
#d8f9b8
Primary accent (#D8F9B8):

Buttons (main CTAs, “Start for free” etc.)

Highlights on graphs or active menu icons

Tags, positive states, confirmation feedback

Light accent (#EAFBDD):

Background for accent icons

Secondary highlight zones or alert boxes

Hover backgrounds for primary accent elements

→ Keep accent usage minimal — use only where attention or interaction is needed.

3. Text & Interaction Colors

Primary text (#2B2D2D):

Used universally for headings, body text, and form labels.

Muted text (opacity ~0.7 of #2B2D2D):

For secondary or descriptive content.

On accent / inverted:

Use white text on dark or strong accent surfaces.

4. Border & Divider System

Borders should be subtle — 1px lines using either:

#EDECEA between sections, or

#F3F7EF for light dividers on white surfaces.

Keep corners rounded at 12px–16px to match the soft color theme.

📐 Layout & Spacing System
Token	Value	Typical Usage
--space-xs	4px	Icon padding, micro gaps
--space-sm	8px	Label spacing, compact buttons
--space-md	16px	Standard inner card padding
--space-lg	24px	Section padding inside cards
--space-xl	40–64px	Spacing between cards or major sections

Rules:

Maintain generous vertical spacing — it reinforces the soft, airy aesthetic.

Use consistent horizontal gutters (~32px) in your grid.

Prefer padding-based separation over heavy borders or shadows.

🪞 Visual Hierarchy Principles

Contrast through tone, not saturation:
The design relies on soft neutrals; use light/dark shifts instead of harsh lines.

Depth via layering:
Outer background (#F3F2F1) → secondary (#EDECEA) → primary (#FEFEFE).

Accent restraint:
Lime (#D8F9B8) should appear in <10% of the screen area at any time.

Minimal shadowing:
Use subtle ambient shadows only for modals or floating elements.

✳️ Brand Feel Summary
Trait	Description
Tone	Warm minimalism — tech-forward yet friendly.
Color Personality	Neutral + refreshing lime hints.
Purpose	Financial or productivity contexts emphasizing calm clarity and trust.