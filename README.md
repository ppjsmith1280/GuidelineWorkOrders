# Guideline Asset Management – Work Order POC v0.1.8

GitHub Pages proof-of-concept using the existing public ArcGIS Web Map:

`5e88ffc05f0f4bbb968e852d816e09a0`

## v0.1.8 changes

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
2. Upload the **contents** of the `Guideline_WO_POC_v0.1.8` folder to the repository root.
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


## v0.1.8 corrective fixes

This release corrects three issues found during live Web Map testing:

1. **Client filtering no longer hides basemap content**
   - v0.1.1 used `webmap.allLayers`, which includes basemap/reference layers.
   - v0.1.8 discovers FeatureLayers from `webmap.layers` (operational layers) only.

2. **ArcGIS popup is fully removed**
   - `MapView.popupEnabled` is false.
   - `MapView.popup` is explicitly set to `null`.
   - Asset clicks are handled exclusively by the Guideline side panel.

3. **Basemap switching uses the WebMap basemap property directly**
   - Well-known ArcGIS basemap IDs are assigned directly.
   - The original Web Map basemap is cloned and can be restored.

Asset selection also now resolves hit-test layers more defensively using the result layer, graphic layer, source layer, layer id, service URL, and title.


## v0.1.8 asset-selection fix

v0.1.8 keeps all v0.1.2 fixes and changes mapped asset selection to a two-stage process:

1. ArcGIS `hitTest()` is used first for fast selection.
2. If the returned display graphic cannot be resolved to an operational FeatureLayer, the app queries a small map extent around the click against the currently visible operational asset layers.

This fallback is intended to handle Web Map layers whose displayed hit-test graphic is not the same JavaScript layer object as the source FeatureLayer.

The right-side panel is explicitly opened after a successful selection. ArcGIS remains read-only.


## v0.1.8 side-panel selection correction

v0.1.8 removes `hitTest()` as a dependency for mapped asset selection.

For every map click, the application now:

1. converts approximately 12 screen pixels around the click into a real ArcGIS `Extent`,
2. queries the currently visible operational FeatureLayers with `queryFeatures`,
3. chooses the returned feature closest to the click,
4. creates the Guideline asset-selection object,
5. renders the side panel immediately,
6. then attempts the visual selection highlight separately.

The side panel also uses explicit `display` state in addition to the HTML `hidden` attribute so a CSS/hidden-state mismatch cannot leave the empty panel visible after a successful selection.

ArcGIS remains read-only.


## v0.1.8 selection-to-panel bridge

v0.1.8 is intentionally based on v0.1.4 because that release successfully:

- selected real assets,
- highlighted the selected feature,
- identified the correct ArcGIS layer.

The change in v0.1.8 is only the bridge from that working selection into the custom right panel.

After the v0.1.4 spatial selection returns `{ layer, graphic }`, the app now:

1. stores only the raw ArcGIS layer, graphic, geometry, and attributes,
2. immediately hides the "Select an asset" placeholder,
3. immediately shows the custom selected-asset panel,
4. renders raw ArcGIS attributes,
5. only then attempts Asset ID/title detection,
6. only then performs demo WO lookup,
7. applies the highlight separately and non-blockingly.

Therefore Asset ID heuristics, field formatting, or WO lookup cannot prevent a valid selected ArcGIS feature from appearing in the panel.

ArcGIS remains read-only.


## v0.1.8 nested layer tree and work-order layers

- Replaces the stock ArcGIS LayerList with a custom Guideline layer tree.
- Layers are automatically grouped under HCMUD 71 and FBLID 2.
- Each client has:
  - a collapse/expand control,
  - a master visibility eye,
  - nested asset layers,
  - a `[Client] Work Orders` pseudo-layer.
- Single-symbol ArcGIS layers show the actual ArcGIS symbol immediately left of the layer label.
- Multi-symbol ArcGIS layers show an expand arrow in that position. Expanding reveals every renderer category with its ArcGIS symbol and an individual visibility eye.
- Unique-value/class-break category visibility is applied through the ArcGIS LayerView filter when a SQL clause can be derived from the renderer.
- Work orders now store the client key derived from the selected ArcGIS layer.
- Each client's Work Orders layer can be hidden/shown independently.
- Expanding a Work Orders layer reveals Open, In Progress, Overdue, and Complete status symbols, each with its own visibility control.
- Client dropdown filtering, layer visibility, and work-order-layer visibility work together without changing the basemap.

ArcGIS remains read-only. Demo work orders remain browser-local.


## v0.1.8 layer-pane hierarchy revision

- Client Work Orders are now separate parent groups from client Assets.
- Parent structure:
  - HCMUD 71 Assets
  - HCMUD 71 Work Orders
  - FBLID 2 Assets
  - FBLID 2 Work Orders
- Visibility controls are on the far right.
- Single-symbol asset rows: ArcGIS symbol → label → eye.
- Multi-symbol asset rows: expand/collapse arrow → label → eye.
- Expanded categories: symbol → category label → eye.
- Work-order status rows: status symbol → status label → eye.

ArcGIS remains read-only. Demo work orders remain browser-local.
