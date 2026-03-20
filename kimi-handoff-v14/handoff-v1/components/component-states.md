# Component States Specification

## Button Component

### Primary Button

| State | Visual | CSS |
|-------|--------|-----|
| **Default** | BG: `--color-brand-primary`, Text: white | `background: #E85A3C; color: #FFF;` |
| **Hover** | BG: `--color-brand-primary-hover`, translateY: -1px | `background: #D14A2E; transform: translateY(-1px);` |
| **Focus** | Ring: `--color-focus-ring`, offset: 2px | `outline: 3px solid rgba(232,90,60,0.4);` |
| **Active** | BG: `--color-brand-primary-active`, scale: 0.98 | `background: #B83D24; transform: scale(0.98);` |
| **Disabled** | Opacity: 0.5, cursor: not-allowed | `opacity: 0.5; cursor: not-allowed;` |
| **Loading** | Spinner overlay, disabled interactions | See loading spinner spec |

### Secondary Button

| State | Visual | CSS |
|-------|--------|-----|
| **Default** | Border: `--color-border-strong`, BG: transparent | `border: 1px solid rgba(26,26,26,0.2);` |
| **Hover** | Border: `--color-brand-primary`, text: brand | `border-color: #E85A3C; color: #E85A3C;` |
| **Focus** | Same as primary | - |
| **Active** | BG: `--color-brand-primary`/10 | `background: rgba(232,90,60,0.1);` |
| **Disabled** | Opacity: 0.5 | - |

## Input Component

| State | Visual | CSS |
|-------|--------|-----|
| **Default** | Border: `--color-border-default`, BG: `--color-bg-secondary` | `border: 1px solid rgba(26,26,26,0.12);` |
| **Hover** | Border: `--color-border-strong` | `border-color: rgba(26,26,26,0.2);` |
| **Focus** | Border: `--color-brand-primary`, shadow: focus | `border-color: #E85A3C; box-shadow: 0 0 0 3px rgba(232,90,60,0.4);` |
| **Error** | Border: `--color-error`, icon: error | `border-color: #C53030;` |
| **Disabled** | BG: `--color-bg-tertiary`, opacity: 0.6 | `background: #F0EDE6; opacity: 0.6;` |
| **Loading** | Spinner right, disabled | - |

## Card Component

| State | Visual | CSS |
|-------|--------|-----|
| **Default** | Border: `--color-border-default`, BG: `--color-bg-secondary` | - |
| **Hover** | Border: `--color-brand-primary`, shadow: md, translateY: -2px | `border-color: #E85A3C; box-shadow: 0 4px 6px rgba(0,0,0,0.07); transform: translateY(-2px);` |
| **Focus** | Ring: focus, within card | `outline: 3px solid rgba(232,90,60,0.4);` |
| **Active** | Scale: 0.99 | `transform: scale(0.99);` |
| **Selected** | Border: brand, BG: brand/5 | `border-color: #E85A3C; background: rgba(232,90,60,0.05);` |

## Navigation Link

| State | Visual | CSS |
|-------|--------|-----|
| **Default** | Text: `--color-text-secondary` | `color: #5C5954;` |
| **Hover** | Text: `--color-brand-primary`, underline animates | `color: #E85A3C;` |
| **Focus** | Ring: focus | - |
| **Active** | Text: `--color-brand-primary`, underline visible | - |
| **Current** | Text: `--color-text-primary`, underline visible | - |

## Tab Component

| State | Visual | CSS |
|-------|--------|-----|
| **Default** | BG: `--color-bg-secondary`, text: muted | - |
| **Hover** | BG: `--color-bg-tertiary` | - |
| **Focus** | Ring: focus | - |
| **Selected** | BG: `--color-brand-primary`, text: white | `background: #E85A3C; color: #FFF;` |
| **Disabled** | Opacity: 0.4 | - |

## Loading States

### Button Loading
```
[ Spinner ] Loading...
- Spinner: 16px, rotates 360deg
- Text: "Loading..." or action-specific
- Disabled: true
```

### Card Loading (Skeleton)
```
- BG: linear-gradient(90deg, #F0EDE6 25%, #F8F6F1 50%, #F0EDE6 75%)
- Animation: shimmer 1.5s infinite
- Border-radius: inherit
```

### Page Loading
```
- Full-screen overlay: rgba(248, 246, 241, 0.8)
- Centered spinner: 48px
- Optional: progress bar at top
```

## Error States

### Input Error
```
- Border: --color-error (#C53030)
- Error message below: 12px, error color
- Error icon: right side
- Aria: aria-invalid="true", aria-describedby="error-id"
```

### Card Error
```
- Border: --color-error
- Error banner at top
- Retry action available
```

### Page Error
```
- Centered error message
- Icon: AlertTriangle
- Title: "Something went wrong"
- Description: specific error
- CTA: "Try again" or "Go home"
```

## Empty States

### Generic Empty
```
- Icon: relevant to content (48px, muted)
- Title: "No [items] yet"
- Description: helpful context
- CTA: primary action button
```

### Search Empty
```
- Icon: SearchX
- Title: "No results for '[query]'"
- Suggestions: popular searches
- CTA: "Clear search"
```

## Focus Order Specification

### Global Focus Order
1. Skip link
2. Logo
3. Navigation links (left to right)
4. Utility actions (search, cart, theme)
5. Main content sections
6. Footer links
7. Social links

### Modal/Overlay Focus Trap
1. Close button
2. Content (top to bottom)
3. Primary action
4. Secondary action
5. Back to close button

### Keyboard Shortcuts
- `Tab`: Next focusable element
- `Shift+Tab`: Previous focusable element
- `Enter`: Activate button/link
- `Space`: Toggle checkbox/expand
- `Escape`: Close modal/overlay
- `Arrow keys`: Navigate within component
