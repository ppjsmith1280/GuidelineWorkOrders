# Guideline Asset Management – Work Order POC v0.1.5

GitHub Pages proof-of-concept using the existing public ArcGIS Web Map:

`5e88ffc05f0f4bbb968e852d816e09a0`

## v0.1.5 changes

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
2. Upload the **contents** of the `Guideline_WO_POC_v0.1.5` folder to the repository root.
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


## v0.1.5 corrective fixes

This release corrects three issues found during live Web Map testing:

1. **Client filtering no longer hides basemap content**
   - v0.1.1 used `webmap.allLayers`, which includes basemap/reference layers.
   - v0.1.5 discovers FeatureLayers from `webmap.layers` (operational layers) only.

2. **ArcGIS popup is fully removed**
   - `MapView.popupEnabled` is false.
   - `MapView.popup` is explicitly set to `null`.
   - Asset clicks are handled exclusively by the Guideline side panel.

3. **Basemap switching uses the WebMap basemap property directly**
   - Well-known ArcGIS basemap IDs are assigned directly.
   - The original Web Map basemap is cloned and can be restored.

Asset selection also now resolves hit-test layers more defensively using the result layer, graphic layer, source layer, layer id, service URL, and title.


## v0.1.5 asset-selection fix

v0.1.5 keeps all v0.1.2 fixes and changes mapped asset selection to a two-stage process:

1. ArcGIS `hitTest()` is used first for fast selection.
2. If the returned display graphic cannot be resolved to an operational FeatureLayer, the app queries a small map extent around the click against the currently visible operational asset layers.

This fallback is intended to handle Web Map layers whose displayed hit-test graphic is not the same JavaScript layer object as the source FeatureLayer.

The right-side panel is explicitly opened after a successful selection. ArcGIS remains read-only.


## v0.1.5 side-panel selection correction

v0.1.5 removes `hitTest()` as a dependency for mapped asset selection.

For every map click, the application now:

1. converts approximately 12 screen pixels around the click into a real ArcGIS `Extent`,
2. queries the currently visible operational FeatureLayers with `queryFeatures`,
3. chooses the returned feature closest to the click,
4. creates the Guideline asset-selection object,
5. renders the side panel immediately,
6. then attempts the visual selection highlight separately.

The side panel also uses explicit `display` state in addition to the HTML `hidden` attribute so a CSS/hidden-state mismatch cannot leave the empty panel visible after a successful selection.

ArcGIS remains read-only.


## v0.1.5 direct ArcGIS-selection bridge

v0.1.5 simplifies mapped asset selection.

The app no longer performs a second spatial search after a click. Instead:

1. ArcGIS `MapView.hitTest()` identifies the graphic actually clicked.
2. The app takes that graphic's raw attributes and source/layer information.
3. The right-side Guideline asset panel is shown **immediately**.
4. Asset ID detection is attempted afterward and cannot block panel rendering.
5. Work-order lookup and selection highlighting are also non-blocking.

This means a valid ArcGIS feature should still populate the side panel even when its asset-ID field does not match the current heuristic.

The ArcGIS popup remains disabled and ArcGIS remains read-only.
