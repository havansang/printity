Color-specific mockup assets for `basic-tshirt`.

Expected structure:

- `white/front/base.png`
- `white/back/base.png`
- `white/neck-label-inner/base.png`
- `<color-key>/front/base.png`
- `<color-key>/back/base.png`
- `<color-key>/neck-label-inner/base.png`

The preview renderer resolves `base.png` by `colorKey` from `manifest.json`.
If a color-specific file is missing, the backend falls back to the default color and then to the surface `render.baseImageUrl`.
