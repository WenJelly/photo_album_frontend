# Photo exhibition redesign

- Date: 2026-04-18
- Status: Approved for planning
- Project: `photo`
- Positioning: High-end curated photo exhibition
- Direction: OpenAI-style information restraint + Apple-style whitespace and surface refinement

## 1. Background

The current project is a single-page photo gallery built with `React 19 + Vite + Tailwind 4`. Core filtering and lightbox behavior already exist, and the gallery uses a row-based equal-height layout.

The current problems are:

- The visual language is still close to a starter template and component-library defaults.
- Page structure is too flat and does not establish a clear exhibition tone.
- Filtering, hover states, and lightbox lack a unified hierarchy and rhythm.
- The existing gallery row-building algorithm is heuristic and not stable enough during container changes, edge cases, and final-row handling.
- There is leftover template CSS and some component-level code quality issues.

The redesign should preserve the current technical stack and core interaction model, but elevate the product into a restrained, premium online exhibition rather than a generic image list.

## 2. Goals

This redesign must achieve the following:

1. Turn the page into a curated exhibition homepage with a calm, premium tone.
2. Keep the photo wall as the core experience and improve its layout quality.
3. Preserve category filtering and image preview, while making both feel lighter and more intentional.
4. Redesign the preview experience so the right-side information panel is visually equal in height to the image area on desktop.
5. Replace the current photo layout heuristic with a more rigorous equal-height justified gallery algorithm.
6. Improve code organization, remove template leftovers, and make future extension easier.

## 3. Non-goals

- No framework migration.
- No backend, CMS, login, upload, or persistence features.
- No heavy visual effects that overpower the images.
- No shift to a Pinterest-style staggered masonry layout. The target is an equal-height justified gallery.
- No dark-theme-first design. The default experience is a refined light interface.

## 4. Experience principles

The redesign should follow these principles:

- Images stay primary. UI should frame the work, not compete with it.
- The interface should feel quiet, precise, and editorial rather than promotional.
- Surface styling should be subtle. Use spacing, typography, and low-contrast structure before using heavy cards or shadows.
- Interactions should be calm and readable. Motion should support orientation, not spectacle.
- Information should appear in layers. Core view first, metadata second, controls third.

## 5. Page architecture

The page will remain a single-page experience, but its structure will be expanded from a flat gallery into a paced exhibition layout.

### 5.1 Top-level sections

The page should be composed of:

1. `Header`
2. `HeroIntro`
3. `GallerySummary`
4. `GallerySection`
5. `Lightbox`
6. `Footer`

### 5.2 Section intent

`Header`

- Lightweight sticky header
- Brand title on the left
- Category control and a low-emphasis utility action on the right
- Transparent or near-transparent at page start, slightly more defined after scroll

`HeroIntro`

- Short exhibition label or issue marker
- Large restrained headline
- Two to three lines of curatorial copy
- One primary action that leads into the gallery
- No oversized hero image that competes with the gallery

`GallerySummary`

- A small summary block between intro and gallery
- Shows total works, category count, and current browsing mode
- Gives users a sense of entering a curated collection instead of a feed

`GallerySection`

- Contains the category segmented control
- Contains the equal-height justified gallery
- Handles empty-state presentation

`Lightbox`

- Full reading view for a selected work
- Desktop uses a two-column composition with a media area and metadata panel inside one shared-height container
- Mobile collapses to a vertical reading flow

`Footer`

- Minimal closing section
- Copyright, source note, and return-to-top action
- No multi-column marketing footer

## 6. Visual language

### 6.1 Color

The palette should be restrained and warm:

- Background: warm off-white or paper-like neutral
- Primary text: graphite or near-black, not pure black
- Secondary text: stable neutral gray
- Border and dividers: low-contrast warm gray
- Accent: one low-saturation highlight color used sparingly for active states, focus, and a few key controls

The design must avoid:

- Blue-purple AI gradients
- Pure black and pure white contrast as the default look
- Multiple accent colors competing for attention

### 6.2 Typography

Typography will use `Geist Variable` as the primary typeface.

Rules:

- Headline scale should be stronger and more compact than the current page.
- Headline tracking should be slightly tighter.
- Body copy width should be limited for readability.
- Labels, counters, and metadata should be lighter in weight and lower in contrast.
- Numeric metadata should feel stable and aligned.

The tone should be closer to editorial product writing than to marketing copy.

### 6.3 Surfaces and spacing

- Prefer open layouts over boxed sections.
- Use thin separators, subtle tonal surfaces, and careful spacing instead of strong card treatments.
- Increase vertical rhythm significantly compared with the current implementation.
- Let key areas breathe, especially the intro and gallery transition.

### 6.4 Motion

Motion should be subtle and hardware-friendly:

- Most interactions: `180ms - 280ms`
- Use `opacity`, `transform`, and light blur changes where useful
- Avoid oversized scaling, harsh easing, or theatrical transitions

## 7. Core components

### 7.1 Header

The header should feel like an exhibition frame rather than a product navbar.

Requirements:

- Sticky positioning
- Thin visual footprint
- Slight blur and surface definition only when useful
- Brand label remains calm and left-aligned
- Right side includes category access and one low-emphasis utility action such as random browse or jump to featured works

### 7.2 Hero intro

The intro is not a marketing hero. It is the curatorial opening of the exhibition.

Required content:

- Small exhibition tag
- Short headline
- Short explanatory copy
- One primary action

The headline should be concise. The copy should explain the purpose of the collection without sounding promotional.

### 7.3 Gallery summary

This section acts like a quiet orientation card.

Required information:

- Total photo count
- Total category count
- Current view description

It should be visually lighter than the hero and lighter than the gallery itself.

### 7.4 Category filter

The current button list should become a segmented control with a quieter tone.

Requirements:

- Horizontal segmented layout on desktop
- Horizontal scroll on mobile instead of wrapped multi-line buttons
- Selected state feels gently lifted or filled
- Unselected states remain low-contrast
- Focus visibility remains clear for keyboard users
- Empty results should offer a clear action to reset back to `all`

### 7.5 Photo grid

The gallery remains the center of the product and should continue using an equal-height justified layout.

The target behavior is:

- Each row has a shared visual height
- Photos keep their native aspect ratio
- Cropping is avoided; images scale proportionally
- Row rhythm should look balanced as viewport width changes
- Final row should end naturally and not feel stretched

#### Algorithm redesign

The existing greedy heuristic should be replaced with a more stable row-partitioning strategy.

Inputs:

- `containerWidth`
- `gap`
- `targetRowHeight`
- `minRowHeight`
- `maxRowHeight`
- ordered list of photo aspect ratios

Proposed strategy:

1. Convert every photo into an aspect ratio `r = width / height`.
2. For each possible row start index, evaluate a bounded set of possible row endings.
3. For each candidate row, compute the fitted height:

   `rowHeight = (containerWidth - gap * (itemCount - 1)) / sum(ratios)`

4. Score each candidate row with a weighted cost function.

Candidate cost must include:

- Deviation from target row height
- Penalty if row height is outside preferred range
- Penalty for rows that are too dense or too sparse
- Penalty for leaving an awkward orphan at the end
- Reduced penalty for the final row so it can end more naturally

5. Use dynamic programming to minimize total cost from the first photo to the last.
6. Reconstruct row breaks from the chosen path.

This approach is preferred over a pure greedy method because it gives a globally better partition, especially when image aspect ratios vary sharply.

#### Final row rules

- The final row should not be forced to fill the full container width.
- It may render at or below the target height to preserve a natural ending.
- The last row should remain visually aligned with the gallery rhythm and should avoid a single giant leftover image on desktop unless the data makes that unavoidable.

#### Responsive behavior

- Large screens can support more images per row and slightly tighter row-height variance.
- Medium screens should keep the same model with fewer items per row.
- Small screens should allow one or two items per row depending on aspect ratios and width.
- The algorithm should recalculate on resize using `ResizeObserver`.

### 7.6 Photo card

Photo cards should feel lighter and less like interactive marketing tiles.

Requirements:

- No heavy border or shadow framing
- Rounded corners should be present but restrained
- Loading state should use a calm placeholder and fade-in, not a spinner
- Hover state should be subtle: small scale shift, small overlay change, metadata reveal
- Focus state must remain obvious and accessible
- Metadata should appear in a fixed pattern and not jump around per image

Displayed metadata on interaction:

- Title
- Photographer
- Category or collection label if helpful

### 7.7 Lightbox

The lightbox becomes a reading view for a selected work.

Desktop requirements:

- One shared-height container
- Left side: image display area
- Right side: information panel
- The right information panel must be equal in height to the image area by virtue of both living in the same bounded container
- The image remains centered and contained within its area
- The information panel can scroll internally if content exceeds available height

Mobile requirements:

- Vertical layout
- Image first
- Information follows below
- Navigation remains reachable without crowding the image

Required metadata in the information panel:

- Title
- Photographer
- Category
- Dimensions
- Current position within the filtered set
- Short curatorial description
- Previous and next controls

Interaction requirements:

- Close action
- Previous and next navigation
- Keyboard support: `Escape`, `ArrowLeft`, `ArrowRight`
- Click-outside to close on desktop
- Scroll locking while open

The visual tone should avoid a harsh black-box viewer. The overlay can be darkened, but the composition should still feel refined and readable.

### 7.8 Empty state

The empty state should be treated as part of the product rather than a plain line of text.

It should:

- Explain that the current category has no matching works
- Offer a clear reset action
- Maintain the same restrained tone as the rest of the page

### 7.9 Footer

The footer should be minimal and quiet.

Suggested content:

- Copyright
- Image source note
- Back to top action

## 8. Responsive strategy

The responsive model should be intentional rather than compressed desktop UI.

Desktop:

- Large whitespace
- Full intro composition
- Shared-height desktop lightbox
- Comfortable row-based gallery

Tablet:

- Reduced intro width
- Filter remains scrollable if needed
- Gallery keeps equal-height rows with adjusted target height

Mobile:

- Condensed intro copy
- Horizontally scrollable category control
- Gallery rows become simpler, often one or two images
- Lightbox switches to vertical reading layout
- Controls stay reachable by thumb

## 9. Accessibility

The redesign must preserve and improve accessibility.

Requirements:

- Semantic landmarks: `header`, `main`, `section`, `footer`
- Clear focus styles across filter, cards, and lightbox controls
- Meaningful `alt` text stays intact
- Keyboard navigation works through the gallery and preview
- Contrast remains sufficient despite the softer palette
- Motion should respect user comfort and remain restrained

## 10. Code structure plan

The implementation should separate page sections and keep responsibilities small.

Planned structure:

- `App` orchestrates state and page composition
- `Header` handles top navigation and utility action
- `HeroIntro` handles exhibition framing copy and entry action
- `GallerySummary` presents collection statistics
- `CategoryFilter` becomes the segmented control
- `PhotoGrid` owns layout calculation and row rendering
- `PhotoCard` owns per-image interaction and loading display
- `Lightbox` owns preview composition and keyboard handling

Cleanup work included in scope:

- Remove starter-template CSS leftovers from `src/App.css`
- Consolidate visual tokens and base rules into `src/index.css`
- Remove unused imports and duplicated empty-state behavior
- Tighten types around category and photo metadata

## 11. Testing and verification expectations

Implementation will be considered complete only if the following are verified:

- Build passes
- Lint passes
- Desktop layout works across wide and medium widths
- Mobile layout remains readable and usable
- Gallery algorithm behaves predictably when filtering changes the dataset size
- Final row behavior remains graceful across categories
- Lightbox desktop panel stays visually equal in height to the image area
- Keyboard navigation and close behavior work reliably

## 12. Final decision

The approved direction is a curated exhibition homepage with:

- restrained premium visual language
- larger whitespace and calmer hierarchy
- an equal-height justified gallery with a redesigned layout algorithm
- a shared-height desktop lightbox with a right-side information panel
- code cleanup focused on clarity, reuse, and maintainability

This spec is intentionally limited to the existing product scope and is sized for one focused implementation plan.
