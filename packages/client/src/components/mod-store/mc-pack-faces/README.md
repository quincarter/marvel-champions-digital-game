# mc-pack-faces

The pictures that lead a pack's page: the cover, the featured card's faces (hover and Inspect through `watchCard`), or one square slot. Faces that do not fit beside the title fold away whole.

Properties are declared in `mc-pack-faces.types.ts`; the element holds no game state and computes nothing. Registered by its parent (`import ".../mc-pack-faces/mc-pack-faces.js"`), once. Tests: `__tests__/`.
