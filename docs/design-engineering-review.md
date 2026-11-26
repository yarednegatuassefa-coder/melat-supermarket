# Design-engineering review — Emil Kowalski skills

## Scope
Source-level review of the React POS and operational stylesheet, using `emil-design-eng`, `mobile-native`, and `break-ui` principles.

## Applied
- Explicitly kept high-frequency POS, tender and operational button actions free of press transforms.
- Disabled hover lift/shadow effects on touch/coarse-pointer devices.
- Raised mobile operational form controls to a 44px minimum target and 16px text for touch ergonomics and iOS zoom behavior.
- Preserved the existing green/neutral system and visible keyboard focus treatment.

## Guardrails
No changes to sale calculations, tax, payment settlement, inventory, accounting, cash sessions or permissions. Financial and stock correctness take precedence over animation.

## Not verified
No build, tests, keyboard walkthrough, receipt flow, touch hardware test or visual comparison was run here. Store-PC and tablet acceptance remains mandatory before merge.
