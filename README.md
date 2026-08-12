# Guideline Asset Management – Work Order POC v0.1.1

GitHub Pages proof-of-concept using the existing public ArcGIS Web Map:

`5e88ffc05f0f4bbb968e852d816e09a0`

## v0.1.1 changes

- ArcGIS stock popups are disabled.
- Clicking a mapped FeatureLayer asset now opens the custom in-app Asset / Work Order panel.
- Selected assets are highlighted on the map.
- `Create Demo WO` is enabled from the selected real ArcGIS asset.
- Client filtering now affects only operational FeatureLayers and does not modify the basemap.
- Added a Basemap selector:
  - Web Map Default
  - Navigation Streets
  - Streets
  - Topographic
  - Light Gray Canvas
  - Dark Gray Canvas
  - Imagery
  - Imagery Hybrid
- Search queries visible/current-client layers in parallel and prioritizes likely Asset ID / name fields, improving the v0.1 live ArcGIS search.
- Demo work orders remain browser-local only (`localStorage`).
- No ArcGIS edits are performed.

## GitHub Pages

1. Unzip this package.
2. Upload the **contents** of the `Guideline_WO_POC_v0.1.1` folder to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save.

## Proof-of-concept architecture

- ArcGIS Web Map: authoritative map/assets
- GitHub Pages: application shell
- localStorage: temporary demo work orders
- ArcGIS remains read-only

## Future Cloudflare production direction

The production app can replace live multi-layer ArcGIS searching with a D1 asset index, while ArcGIS remains the source of truth for geometry and authoritative asset attributes. A scheduled synchronization job can discover newly added/updated ArcGIS assets and update the search index.
