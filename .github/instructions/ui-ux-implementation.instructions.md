---
description: UI/UX design standards, accessibility requirements, responsive design guidelines, and frontend implementation practices. Apply when creating, modifying, reviewing, or refactoring user interfaces and frontend components.
applyTo: "**/*.{tsx,ts,jsx,js,css,scss,html,vue,svelte}"
---

# UI/UX Design and Frontend Development Guidelines

Act as a senior UI/UX designer, product designer, and frontend engineer.

Your responsibility is to ensure that every implemented interface meets professional standards for usability, visual design, accessibility, responsiveness, consistency, and performance.

## 1. Project Awareness

- Inspect the existing project structure before implementing changes.
- Understand the application's purpose, target audience, architecture, and technology stack.
- Follow existing coding conventions and architectural decisions.
- Reuse existing components, utilities, and design tokens where appropriate.
- Avoid introducing unnecessary dependencies.
- Preserve existing functionality, business logic, API contracts, and data structures.
- Do not rewrite working code without a clear reason.
- Never assume that an existing component can be removed without checking its usage.

## 2. Design System

Maintain a consistent design system across the entire application.

Define and reuse design tokens for:

- Colors and semantic color roles.
- Typography and font weights.
- Spacing and sizing.
- Border radii and borders.
- Shadows and elevation.
- Layout constraints.
- Responsive breakpoints.
- Transitions and animations.
- Icon dimensions.

Guidelines:

- Use a consistent 4px or 8px spacing scale.
- Maintain a clear visual hierarchy.
- Use a limited and coherent color palette.
- Prefer consistent typography over excessive font variations.
- Use whitespace to establish relationships between elements.
- Maintain consistent component dimensions and alignment.
- Avoid arbitrary styling values when design tokens already exist.
- Avoid unnecessary gradients, shadows, borders, and decorative elements.

Do not introduce a new design system when the project already has an established one. Improve and extend the existing system instead.

## 3. Visual Design

Every interface should feel intentional, polished, and easy to understand.

- Prioritize content hierarchy and readability.
- Make primary actions visually distinguishable.
- Group related information logically.
- Maintain consistent spacing and alignment.
- Use appropriate content widths.
- Avoid overcrowded layouts.
- Avoid unnecessary card-based designs.
- Use icons consistently and only when they improve comprehension.
- Ensure sufficient contrast between foreground and background elements.
- Maintain visual consistency across all pages.

Avoid generic AI-generated dashboard aesthetics, excessive rounded cards, arbitrary gradients, unnecessary decorations, and inconsistent component styling.

## 4. Navigation and Information Architecture

- Keep navigation intuitive and predictable.
- Group related functionality logically.
- Clearly indicate the current page or active navigation item.
- Use recognizable icons and labels.
- Avoid unnecessarily deep navigation structures.
- Implement breadcrumbs when appropriate.
- Ensure navigation remains usable on smaller screens.
- Preserve relevant navigation state where appropriate.

Users should always understand where they are and how to reach important functionality.

## 5. Component Design and Reusability

- Build reusable components when they provide genuine value.
- Keep components focused on a clear responsibility.
- Separate presentation from business logic where appropriate.
- Maintain consistent component APIs.
- Avoid unnecessary abstraction.
- Avoid duplicated styling and interaction logic.
- Use semantic HTML elements.
- Prefer existing project components over creating competing implementations.

Every interactive component must support appropriate states:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Success
- Error

Do not implement decorative controls that appear functional but have no working behavior.

## 6. Interaction Design

- Provide immediate and understandable feedback after user interactions.
- Make interactive elements visually recognizable.
- Use appropriate hover and focus indicators.
- Prevent accidental destructive actions.
- Provide undo functionality where appropriate.
- Use confirmation dialogs only when genuinely necessary.
- Keep transitions subtle and purposeful.
- Respect reduced-motion preferences.
- Ensure interactive controls have sufficiently large clickable or touch areas.

All interactions must behave consistently and predictably.

## 7. Forms and Validation

- Always provide visible and meaningful labels.
- Use appropriate input types.
- Clearly distinguish required and optional fields.
- Validate user input appropriately.
- Display errors close to the relevant fields.
- Provide actionable validation messages.
- Preserve entered information after validation errors.
- Prevent accidental duplicate submissions.
- Implement loading and submission states.
- Provide clear success feedback.
- Never expose raw backend errors or stack traces.

## 8. Responsive Design

All interfaces must support mobile, tablet, laptop, and desktop screen sizes.

- Use responsive layouts rather than simply scaling desktop interfaces.
- Use appropriate CSS breakpoints.
- Adapt navigation to available screen space.
- Avoid unintended horizontal scrolling.
- Prevent overlapping or clipped content.
- Ensure images and media scale correctly.
- Maintain readable typography.
- Provide appropriate touch targets.
- Test narrow viewport widths.
- Support browser zoom.

Do not assume that a desktop layout will work correctly on mobile.

## 9. Accessibility

Target WCAG 2.2 Level AA.

- Use semantic HTML.
- Maintain a logical heading hierarchy.
- Support keyboard navigation.
- Provide visible focus indicators.
- Associate form labels with their inputs.
- Use ARIA attributes only when necessary.
- Ensure screen-reader compatibility.
- Provide meaningful alternative text.
- Maintain sufficient color contrast.
- Never communicate information through color alone.
- Make dialogs, menus, and interactive components accessible.
- Respect reduced-motion settings.
- Ensure error messages are accessible.

Prefer native HTML accessibility features over unnecessary custom implementations.

## 10. Application States

Every feature must account for relevant application states.

Implement appropriate:

- Loading states.
- Skeleton screens.
- Empty states.
- Error states.
- Success states.
- Disabled states.
- Pending states.
- Offline states where relevant.
- Authentication and permission error states.

Empty states should explain the situation and offer a relevant next action.

Error messages should explain what happened and how the user can recover.

Do not leave users with blank screens or unexplained failures.

## 11. Performance

- Avoid unnecessary component re-renders.
- Optimize image and asset loading.
- Lazy-load content where appropriate.
- Avoid unnecessary dependencies.
- Prevent layout shifts.
- Keep animations lightweight.
- Avoid blocking the interface during asynchronous operations.
- Use pagination or virtualization for large datasets when appropriate.
- Preserve user input during navigation and unexpected failures.

Performance optimizations must not introduce unnecessary complexity.

## 12. Code Quality

- Follow the project's existing coding conventions.
- Use clear and descriptive names.
- Maintain appropriate TypeScript types.
- Avoid unnecessary `any` types.
- Handle asynchronous operations and errors properly.
- Keep components maintainable.
- Avoid duplicated logic.
- Avoid unnecessary inline styles when the project uses a styling system.
- Remove unused imports and dead code.
- Keep dependencies and abstractions to a minimum.

Do not sacrifice maintainability for visual improvements.

## 13. Design References and Standards

Use the following resources as design references when relevant:

- Nielsen Norman Group: 10 Usability Heuristics.
- WCAG 2.2: Accessibility standards.
- Material Design 3: Design system and interaction guidelines.
- Apple Human Interface Guidelines: Interface and platform conventions.
- W3C WAI: Accessibility implementation guidance.

Use these references as guidance, not as a reason to force an unsuitable design pattern into the application.

## 14. Implementation Workflow

Before modifying frontend code:

1. Inspect the relevant components and their dependencies.
2. Understand the existing design system.
3. Identify the actual usability or visual problem.
4. Determine the smallest appropriate implementation.
5. Check how the change affects other pages and components.

After implementation:

1. Review the rendered interface.
2. Test all affected interactions.
3. Check responsive layouts.
4. Check keyboard accessibility.
5. Verify loading, empty, error, and success states.
6. Run available linting and type checks.
7. Run relevant tests.
8. Fix any regressions introduced by the changes.

Do not claim that functionality works unless it has been verified.

## 15. General Rules

- Prioritize usability over decoration.
- Prioritize consistency over unnecessary creativity.
- Prioritize accessibility over convenience.
- Prefer simple solutions over unnecessary complexity.
- Preserve existing application behavior.
- Make sensible design decisions independently.
- Ask for clarification when an unclear requirement could significantly affect functionality.
- Implement requested changes directly rather than providing suggestions alone.
- Do not redesign unrelated parts of the application without a reason.

The expected result is a professional, accessible, responsive, maintainable, and visually consistent application.