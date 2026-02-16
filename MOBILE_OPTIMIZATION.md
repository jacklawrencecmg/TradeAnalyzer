# Mobile & iOS Optimization Guide

This document outlines the mobile and iOS optimizations implemented in Fantasy Draft Pros.

## Key Features Implemented

### 1. iOS Safe Area Support
The app now supports iOS safe areas (notches, home indicators) on iPhone X and newer devices.

**Utility Classes:**
- `.safe-top` - Adds padding for top safe area
- `.safe-bottom` - Adds padding for bottom safe area
- `.safe-left` - Adds padding for left safe area
- `.safe-right` - Adds padding for right safe area
- `.safe-x` - Adds padding for left and right safe areas
- `.safe-y` - Adds padding for top and bottom safe areas
- `.safe-all` - Adds padding for all safe areas

### 2. Viewport Height Fixes
iOS Safari has issues with `100vh` due to the dynamic address bar. We've implemented multiple solutions:

**Utility Classes:**
- `.h-screen-safe` - Full height with iOS fixes
- `.min-h-screen-safe` - Minimum full height with iOS fixes
- `.h-screen-mobile` - Dynamic viewport height using custom --vh variable
- `.min-h-screen-mobile` - Dynamic minimum viewport height

**JavaScript Solution:**
A script in `index.html` dynamically calculates the viewport height and updates a CSS variable `--vh` when the window resizes or orientation changes.

### 3. Touch Optimizations
- **44px minimum tap targets** on mobile for better accessibility
- **Touch action manipulation** to prevent double-tap zoom
- **Smooth momentum scrolling** for iOS with `-webkit-overflow-scrolling: touch`
- **Bounce scroll prevention** on body (while allowing in scrollable containers)
- **Tap highlight removal** with transparent `-webkit-tap-highlight-color`
- **Active state feedback** on buttons and links (opacity change)

### 4. Input Optimizations
- **16px minimum font size** on inputs to prevent iOS zoom on focus
- **Desktop override** restores normal font sizes on larger screens
- **No zoom on input focus** via viewport meta tag settings

### 5. Viewport Meta Tags
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="format-detection" content="telephone=no" />
```

- **viewport-fit=cover** - Extends content into safe areas
- **apple-mobile-web-app-capable** - Enables full-screen mode when added to home screen
- **apple-mobile-web-app-status-bar-style** - Sets status bar appearance
- **format-detection** - Prevents automatic phone number linking

### 6. Overflow Prevention
- **Hidden horizontal overflow** on body and root to prevent horizontal scrolling
- **Proper scrollable containers** with overflow-y-auto or overflow-y-scroll

### 7. Text Rendering
- **Antialiased fonts** for smoother text on mobile
- **Optimized legibility** with `text-rendering: optimizeLegibility`
- **No text size adjust** to prevent iOS from changing font sizes

### 8. Selection Behavior
- **Disabled callout** on long press for interactive elements
- **Text selection allowed** for content (p, h1-h6, span, div)
- **No selection** on buttons and links for better UX

## Usage Examples

### Using Safe Area Classes
```jsx
// Header with safe area top
<header className="bg-white safe-top">
  <h1>My Header</h1>
</header>

// Fixed bottom navigation with safe area bottom
<nav className="fixed bottom-0 left-0 right-0 bg-white safe-bottom">
  <button>Home</button>
</nav>
```

### Using Viewport Height Classes
```jsx
// Full screen hero section
<section className="h-screen-safe bg-gradient-to-br from-blue-500 to-purple-600">
  <h1>Welcome</h1>
</section>

// Minimum full screen with safe areas
<div className="min-h-screen-safe safe-all">
  <YourContent />
</div>
```

### Scrollable Containers
```jsx
// Properly scrollable list with iOS momentum
<div className="overflow-y-auto max-h-screen" data-scrollable="true">
  {items.map(item => <Item key={item.id} {...item} />)}
</div>
```

## Testing Checklist

When testing mobile responsiveness:

- [ ] Test on iPhone X or newer (notch devices)
- [ ] Test on iPad (various orientations)
- [ ] Test on Android devices (various sizes)
- [ ] Verify no horizontal scrolling
- [ ] Check safe areas on notched devices
- [ ] Test input focus (no unwanted zoom)
- [ ] Verify smooth scrolling in lists
- [ ] Check tap target sizes (minimum 44px)
- [ ] Test orientation changes
- [ ] Verify viewport height behavior when address bar appears/disappears
- [ ] Check modal/overlay positioning
- [ ] Test touch interactions (no lag, proper feedback)

## Desktop Compatibility

All mobile optimizations gracefully degrade on desktop:
- Safe area insets default to 0 on non-iOS devices
- Minimum tap target sizes only apply below 768px width
- Input font size overrides restore normal sizes on desktop
- Touch-specific styles don't affect mouse interactions

## Browser Support

- ✅ iOS Safari 11+
- ✅ Chrome Mobile
- ✅ Firefox Mobile
- ✅ Safari Desktop
- ✅ Chrome Desktop
- ✅ Firefox Desktop
- ✅ Edge

## Notes

- The `--vh` CSS variable is dynamically updated via JavaScript for accurate viewport height
- Safe area insets automatically work on devices with notches/home indicators
- All optimizations are progressive enhancements and don't break older browsers
