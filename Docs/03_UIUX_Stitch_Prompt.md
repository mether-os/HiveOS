# HiveOS — UI Generation Prompt (Stitch / V0 / Lovable)

---

## Master Prompt

Design a dark-mode web application called **HiveOS** — an AI-powered collaborative operating system for developer teams. The aesthetic is: **deep space infrastructure meets living organism**. Think the illegible-but-beautiful depth of a neural network visualization crossed with the information density of a Vercel dashboard and the collaboration energy of Figma's presence system. Not Discord. Not Notion. Something that feels like it was built in 2028.

---

## Design System

**Color Palette**
- Background primary: `#080A0F` (near-void black with a blue undertone)
- Background secondary: `#0E1117` (cards, panels)
- Background elevated: `#141920` (modals, dropdowns)
- Accent primary: `#F5A623` (amber/honey — the "hive" color, used sparingly)
- Accent secondary: `#3B82F6` (electric blue — AI interactions, links)
- Success: `#22C55E`
- Warning: `#F59E0B`
- Error: `#EF4444`
- Text primary: `#F1F5F9`
- Text secondary: `#64748B`
- Text muted: `#334155`
- Border subtle: `#1E2533`
- Glow amber: `rgba(245, 166, 35, 0.15)`
- Glow blue: `rgba(59, 130, 246, 0.12)`

**Typography**
- Display / Headings: `Space Grotesk` — geometric, modern, slightly technical
- Body: `Inter` — clean, readable
- Monospace / Code / Logs: `JetBrains Mono` — for terminal outputs, log viewers, code snippets
- All text: sentence case, no ALL CAPS headings

**Border Radius**
- Cards/panels: `12px`
- Buttons: `8px`
- Tags/badges: `4px`
- Avatar: `50%`

**Spacing**: 8px base grid

**Motion**
- Page transitions: 200ms ease
- Panel slides: 300ms cubic-bezier(0.16, 1, 0.3, 1)
- AI thinking: pulsing amber glow animation
- Presence dots: soft breathing animation
- Canvas nodes: spring physics on drag

**Signature Element**: Amber hexagonal patterns — subtle, at low opacity in backgrounds, in loading states, and as decorative accents. The hex pattern references hive cells without being literal. It should feel like infrastructure diagrams.

---

## Pages to Design

---

### Page 1: Landing / Auth Page

**Layout**: Full-screen, centered

**Elements**
- Background: Pure `#080A0F` with a very faint hex grid overlay at 3% opacity
- Ambient light: subtle amber radial glow in top-right, blue in bottom-left
- Center: HiveOS wordmark — `Space Grotesk`, weight 700, size 48px, white
- Below wordmark: `The operating system for teams that build.` in text-secondary
- Two auth buttons stacked:
  - "Continue with GitHub" — dark filled button with GitHub logo
  - "Continue with Google" — dark filled button with Google logo
- Buttons: `#141920` background, `#1E2533` border, white text, 48px height, full-width but max 360px
- Bottom footnote: "Join 0 teams building with HiveOS" in text-muted

---

### Page 2: Dashboard / Hive List

**Layout**: Minimal centered layout, max-width 900px

**Elements**
- Top bar: HiveOS logo left, user avatar right
- Section header: "Your Hives" with "+ New Hive" button (amber accent)
- Hive cards in a 2-column grid:
  - Card: `#0E1117` background, `#1E2533` border, 12px radius
  - Card content: Hive name (large, Space Grotesk), project one-liner, member avatars (stacked, max 5 shown), last active time, status badge (Active / Idle / Needs Attention)
  - Hover: amber glow border `rgba(245, 166, 35, 0.3)`
  - "Needs Attention" badge: amber background, dark text — shown when AI has health flags
- Empty state: hexagonal illustration, "Create your first Hive" CTA

---

### Page 3: Hive Workspace (Main App)

**Layout**: Three-panel layout

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar (56px)                                          │
├────────┬────────────────────────────────┬───────────────┤
│        │                                │               │
│ Left   │     Main Content Area          │  Right Panel  │
│ Sidebar│     (Canvas / Tasks / Docs)    │  (AI / Chat)  │
│ (64px) │                                │  (320px)      │
│        │                                │               │
└────────┴────────────────────────────────┴───────────────┘
```

**Top Bar**
- Left: Hive name + chevron (workspace switcher)
- Center: Tab navigation — Canvas | Tasks | Documents | Activity
- Right: Member presence avatars (with green dot if online), GitHub status indicator, notification bell, user avatar

**Left Sidebar (icon-only)**
- Icons for: Canvas, Tasks, Documents, GitHub, Settings
- Active state: amber left border + amber icon tint
- Tooltip on hover

**Main Content: Canvas View (default)**
- Infinite canvas with pan/zoom (React Flow)
- Background: `#080A0F` with subtle dot grid
- Floating node cards (see Node Design below)
- Minimap in bottom-right corner
- Toolbar bottom-center: Add Node, Connect, Select, Pan, Fit View
- When AI is generating canvas: nodes animate in with a blue glow spawn effect

**Node Design**
```
┌─────────────────────┐
│ 🎯  Feature         │  ← icon + type label in amber
├─────────────────────┤
│ User Authentication │  ← title
│                     │
│ OAuth, JWT, sessions│  ← content/tags
└─────────────────────┘
```
- Node background: `#0E1117`
- Node border: `#1E2533` default, amber when selected
- Drop shadow: `0 0 20px rgba(245,166,35,0.1)` when selected
- Connected nodes: animated edge with directional arrow, `#3B82F6` color

**Right Panel: HiveMind AI**
- Header: "HiveMind" with a pulsing amber hex icon
- AI status: "Analyzing project..." / "Up to date" / "3 flags detected"
- Chat interface:
  - Message bubbles: user right-aligned dark, AI left-aligned with blue-left-border
  - AI messages: rendered markdown
  - Input: bottom of panel, placeholder "Ask anything about your project..."
  - AI thinking state: typing indicator with amber pulse dots
- Quick actions above input:
  - "Generate canvas"
  - "Health report"
  - "Today's missions"
  - "Create standup"

---

### Page 4: Task Board

**Layout**: Kanban columns inside main content area

**Columns**: Todo | In Progress | Review | Done | Blocked

**Column headers**
- Column name + count badge
- "+ Add task" at bottom of each column

**Task Cards**
```
┌─────────────────────────────┐
│ [CRITICAL]  Due: Tomorrow   │
│ Build auth endpoints        │
│ ─────────────────────────── │
│ 👤 Mayank   🔗 PR #14       │
└─────────────────────────────┘
```
- Priority badge colors: Critical=red, High=amber, Normal=blue, Low=gray
- Assignee avatar
- Linked PR badge (if connected)
- AI-generated tasks: small amber ✦ in corner

**Filters bar**: by assignee, priority, status, AI-generated only

---

### Page 5: Presence Panel (Sidebar Panel or Bottom Sheet)

**Design**: Slide-in panel from right, overlays canvas partially

**Title**: "Who's in the Hive"

**Member rows**
```
● Mayank        In Progress: Auth endpoints
○ Rahul         Last seen 2h ago
● Priya         Reviewing PR #14
● AI (HiveMind) Monitoring...
```
- Green filled dot = online
- Grey dot = offline
- Activity text: text-secondary, italic
- HiveMind always shows at bottom with amber pulsing dot

---

### Page 6: Onboarding Flow

**Step 1: Create Hive**
- Full-screen modal, dark
- "Name your Hive" input (large, Space Grotesk)
- "One line about your project" input
- Next →

**Step 2: AI Asks**
- HiveMind avatar (amber hexagon icon) appears
- Chat bubble: "Got it. Tell me more — what problem does this project solve?"
- User types → AI responds with structured canvas generation in real-time
- Animated nodes appear on canvas in background

**Step 3: Invite Team**
- Copy invite link button
- Email invite input
- "Skip for now" option

**Step 4: Upload Resumes (optional)**
- Drag and drop area per member
- "HiveMind will use this to assign tasks to the right people"

**Step 5: Canvas Ready**
- Fade transition to main Canvas view
- AI nodes already populated
- Toast: "HiveMind has mapped your project ✦"

---

### Page 7: Logs / Activity Feed

**Layout**: Terminal-inspired

- Background: `#080A0F`
- Monospace font (JetBrains Mono)
- Each log line: timestamp left in text-muted, actor name in amber, event description in text-primary
```
10:24:33  Mayank         pushed 3 commits to feat/auth
10:26:01  HiveMind ✦     flagged: PR #14 has no reviewer assigned
10:31:44  Priya          created task: "Review PR #14"
10:45:00  HiveMind ✦     daily missions generated for all members
```
- AI events: `✦` indicator, slightly brighter
- Filter by: member, event type, date range
- Search bar at top

---

## Component Library

**Primary Button**: Amber background (#F5A623), dark text, 8px radius, 40px height
**Secondary Button**: `#141920` background, `#1E2533` border, white text
**Ghost Button**: No background, text-secondary, hover shows border
**Badge/Tag**: 4px radius, 6px horizontal padding, small monospace font
**Avatar**: Circle, initials or image, with presence ring (green/grey)
**Input**: `#0E1117` background, `#1E2533` border, focus = amber border, placeholder = text-muted
**Card**: `#0E1117` background, `#1E2533` border, 12px radius, 20px padding
**Modal**: `#141920` background, backdrop blur overlay, 16px radius
**Toast**: Slides from top-right, `#141920` background, left border = status color

---

## Loading States

- **Skeleton**: Dark shimmer in same shape as content — `#0E1117` → `#141920` animation
- **AI Thinking**: Three amber dots with staggered pulse
- **Canvas Loading**: Hex grid draws itself in from center outward
- **Page Transition**: Fade + very subtle upward slide

---

## Empty States

- Empty Canvas: "Drop your first idea here, or ask HiveMind to get started" with arrow pointing to AI panel
- No Tasks: "HiveMind hasn't generated tasks yet. Describe your project first."
- No Documents: standard drag-to-upload area

---

## Mobile Responsiveness

Not primary focus for V1, but:
- Dashboard (hive list): single column below 768px
- Workspace: stack panels, canvas becomes scrollable
- AI panel: bottom sheet on mobile

---

## Inspirations to Reference

- Vercel dashboard (density, dark, clean)
- Linear (information architecture, keyboard-first feel)
- Figma (canvas, presence avatars)
- GitHub Actions (log viewer)
- Datadog (activity feeds, status indicators)
- Framer (animation quality, premium dark aesthetic)
