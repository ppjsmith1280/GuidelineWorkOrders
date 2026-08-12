# Guideline Asset Management - Work Order POC v0.1

This is a read-only proof-of-concept that loads the existing public ArcGIS Web Map directly and adds browser-local demo work orders.

## ArcGIS Web Map

`5e88ffc05f0f4bbb968e852d816e09a0`

No FeatureServer URLs are hard-coded. The application loads the complete Web Map and discovers FeatureLayers at runtime.

## What the POC does

- Loads the full public Guideline Work Order ArcGIS Web Map.
- Preserves the Web Map's existing ArcGIS layers and renderers.
- Provides an ArcGIS layer list.
- Clicks real ArcGIS assets and displays their attributes.
- Attempts to identify the asset ID automatically from fields such as Asset ID, Facility ID, Unique ID, etc.
- Searches visible FeatureLayers.
- Filters the map to HCMUD 71, FBLID 2, or all current clients based on layer names.
- Creates demo work orders linked to real selected assets.
- Draws a colored work-order overlay on the map.
- Filters demo WOs by Open, In Progress, Overdue, and Complete.
- Stores demo WOs only in the browser using localStorage.
- Does NOT edit ArcGIS.
- Does NOT require a database.
- Does NOT include authentication.

## GitHub Pages setup

1. Unzip this package.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the root of a GitHub repository.
3. In GitHub open **Settings > Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save.

The Web Map and every layer needed by the map must remain publicly readable for this GitHub Pages proof-of-concept.

## Important demo behavior

Work orders are fake/demo records. They are saved in the current browser only. Another computer will not see them, and clearing browser storage or pressing **Reset demo data** removes them.

This is intentional for v0.1 so the proof-of-concept cannot write to ArcGIS or a production database.

## Production migration plan

If the team approves the concept, the natural next architecture is:

- Private GitHub repository
- Cloudflare Pages/Workers
- User authentication
- Role, district, and asset permissions
- Cloudflare D1 work-order database
- Cloudflare R2 photos/documents
- Private ArcGIS services accessed securely through the production backend
- Nearmap Tile API/WMTS through a Cloudflare Worker
- Audit trail and real work-order lifecycle

## Notes

The asset-ID detection is intentionally generic because the Web Map contains many heterogeneous FeatureLayers. If a particular layer uses a nonstandard ID field, v0.2 can add a small field-mapping configuration so every asset type displays the exact preferred ID.
