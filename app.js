(() => {
  const WEBMAP_ID = "5e88ffc05f0f4bbb968e852d816e09a0";
  const STORAGE_KEY = "guideline-wo-poc-v01";

  const statusColors = {
    "Open": "#c9891b",
    "In Progress": "#2f78b7",
    "Overdue": "#c84b42",
    "Complete": "#2f845a"
  };

  const state = {
    view: null,
    webmap: null,
    layerList: null,
    featureLayers: [],
    selected: null,
    workOrders: loadWorkOrders(),
    woFilter: "all",
    searchGraphics: [],
    woGraphicsLayer: null,
    selectionLayer: null
  };

  const els = {};

  function $(id) { return document.getElementById(id); }
  function safeText(v) {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—";
    return String(v);
  }
  function slugStatus(status) { return String(status || "Open").replace(/\s+/g, "-"); }
  function escapeHtml(value) {
    return safeText(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function loadWorkOrders() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function saveWorkOrders() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workOrders));
  }

  function initDom() {
    [
      "loadingOverlay", "districtSelect", "assetSearch", "assetSearchBtn", "searchStatus", "searchResults",
      "woCountBadge", "workOrderList", "layerList", "toggleLayerPanelBtn", "detailPanel", "detailEmpty",
      "assetDetail", "assetLayerTitle", "assetTitle", "assetIdValue", "attributeTable", "assetWorkOrders",
      "createWoBtn", "woDialog", "woForm", "dialogAssetLabel", "woType", "woDescription", "woPriority",
      "woStatus", "woAssigned", "saveWoBtn", "resetDemoBtn", "mobileSidebarBtn", "sidebar"
    ].forEach(id => els[id] = $(id));

    els.assetSearchBtn.addEventListener("click", runAssetSearch);
    els.assetSearch.addEventListener("keydown", e => { if (e.key === "Enter") runAssetSearch(); });
    els.districtSelect.addEventListener("change", applyDistrictFilter);
    els.createWoBtn.addEventListener("click", openWoDialog);
    els.saveWoBtn.addEventListener("click", createWorkOrder);
    els.resetDemoBtn.addEventListener("click", resetDemoData);
    els.toggleLayerPanelBtn.addEventListener("click", toggleLayerPanel);
    els.mobileSidebarBtn.addEventListener("click", () => els.sidebar.classList.toggle("open"));
    document.querySelectorAll(".filter-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.woFilter = btn.dataset.status;
        renderWorkOrders();
        renderWorkOrderGraphics();
      });
    });
  }

  function statusPill(status) {
    return `<span class="status-pill status-${slugStatus(status)}">${escapeHtml(status)}</span>`;
  }

  function renderWorkOrders() {
    let items = state.workOrders;
    if (state.woFilter !== "all") items = items.filter(w => w.status === state.woFilter);
    els.woCountBadge.textContent = String(state.workOrders.length);
    if (!items.length) {
      els.workOrderList.innerHTML = `<div class="empty-mini">No demo work orders yet. Select an asset and create one.</div>`;
    } else {
      els.workOrderList.innerHTML = items
        .slice()
        .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
        .map(w => `
          <div class="wo-card" data-wo-id="${escapeHtml(w.id)}">
            <div class="wo-top">
              <span class="wo-number">${escapeHtml(w.number)}</span>
              ${statusPill(w.status)}
            </div>
            <div class="wo-desc">${escapeHtml(w.description)}</div>
            <div class="wo-meta">${escapeHtml(w.layerTitle)} · ${escapeHtml(w.assetId)}</div>
          </div>`).join("");
      els.workOrderList.querySelectorAll(".wo-card").forEach(card => {
        card.addEventListener("click", () => focusWorkOrder(card.dataset.woId));
      });
    }
    renderAssetWorkOrders();
  }

  function renderAssetWorkOrders() {
    if (!state.selected) return;
    const list = state.workOrders.filter(w => w.assetKey === state.selected.assetKey);
    if (!list.length) {
      els.assetWorkOrders.innerHTML = `<div class="empty-mini">No work orders for this asset.</div>`;
      return;
    }
    els.assetWorkOrders.innerHTML = list.map(w => `
      <div class="wo-card" data-wo-id="${escapeHtml(w.id)}">
        <div class="wo-top"><span class="wo-number">${escapeHtml(w.number)}</span>${statusPill(w.status)}</div>
        <div class="wo-desc">${escapeHtml(w.description)}</div>
        <div class="wo-meta">${escapeHtml(w.type)} · ${escapeHtml(w.priority)} priority${w.assigned ? ` · ${escapeHtml(w.assigned)}` : ""}</div>
      </div>`).join("");
  }

  function nextWoNumber() {
    const n = state.workOrders.reduce((m,w) => {
      const match = String(w.number || "").match(/(\d+)$/);
      return Math.max(m, match ? Number(match[1]) : 0);
    }, 0) + 1;
    return `WO-DEMO-${String(n).padStart(4,"0")}`;
  }

  function openWoDialog() {
    if (!state.selected) return;
    els.dialogAssetLabel.textContent = `${state.selected.layerTitle} · ${state.selected.assetId}`;
    els.woDescription.value = "";
    els.woPriority.value = "Normal";
    els.woStatus.value = "Open";
    els.woAssigned.value = "";
    if (typeof els.woDialog.showModal === "function") els.woDialog.showModal();
  }

  function createWorkOrder() {
    if (!state.selected) return;
    const description = els.woDescription.value.trim();
    if (!description) {
      els.woDescription.focus();
      return;
    }
    const wo = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      number: nextWoNumber(),
      assetKey: state.selected.assetKey,
      assetId: state.selected.assetId,
      layerTitle: state.selected.layerTitle,
      layerId: state.selected.layerId,
      objectId: state.selected.objectId,
      type: els.woType.value,
      description,
      priority: els.woPriority.value,
      status: els.woStatus.value,
      assigned: els.woAssigned.value.trim(),
      createdAt: new Date().toISOString(),
      geometry: state.selected.geometry ? state.selected.geometry.toJSON() : null,
      geometryType: state.selected.geometry ? state.selected.geometry.type : null
    };
    state.workOrders.push(wo);
    saveWorkOrders();
    els.woDialog.close();
    renderWorkOrders();
    renderWorkOrderGraphics();
  }

  function resetDemoData() {
    if (!confirm("Delete all demo work orders saved in this browser? ArcGIS data will not be affected.")) return;
    state.workOrders = [];
    saveWorkOrders();
    renderWorkOrders();
    renderWorkOrderGraphics();
  }

  function toggleLayerPanel() {
    const el = els.layerList;
    const hidden = el.style.display === "none";
    el.style.display = hidden ? "block" : "none";
    els.toggleLayerPanelBtn.textContent = hidden ? "Hide" : "Show";
  }

  function applyDistrictFilter() {
    const val = els.districtSelect.value;
    const allLayers = state.webmap?.allLayers?.toArray?.() || [];
    allLayers.forEach(layer => {
      if (!layer || layer.type === "graphics") return;
      const title = String(layer.title || "").toUpperCase().replaceAll(" ", "").replaceAll("_", "");
      if (val === "all") {
        if (layer.__guidelineOriginalVisible !== undefined) layer.visible = layer.__guidelineOriginalVisible;
        return;
      }
      if (layer.__guidelineOriginalVisible === undefined) layer.__guidelineOriginalVisible = layer.visible;
      if (val === "HCMUD71") layer.visible = title.includes("HCMUD71") || title.includes("HCMUD071");
      if (val === "FBLID2") layer.visible = title.includes("FBLID2") || title.includes("FBLID02");
    });
  }

  function getCandidateIdField(layer, attributes) {
    const fields = (layer.fields || []).filter(f => attributes[f.name] !== undefined && attributes[f.name] !== null && attributes[f.name] !== "");
    const scored = fields.map(f => {
      const n = `${f.name} ${f.alias || ""}`.toLowerCase();
      let score = 0;
      if (/asset.?id/.test(n)) score += 100;
      if (/facility.?id/.test(n)) score += 90;
      if (/cityworks/.test(n) && /id/.test(n)) score += 80;
      if (/unique.?id/.test(n)) score += 75;
      if (/(^|\W)asset(\W|$)/.test(n)) score += 65;
      if (/(^|_)id$/.test(f.name.toLowerCase())) score += 45;
      if (/globalid/.test(n)) score += 35;
      if (/objectid|object.?id|fid|shape/.test(n)) score -= 30;
      const v = String(attributes[f.name]);
      if (v.length > 1 && v.length < 60) score += 5;
      return { field: f, score };
    }).sort((a,b) => b.score-a.score);
    return scored[0]?.score > 0 ? scored[0].field : null;
  }

  function getDisplayField(layer, attributes) {
    const preferred = [layer.displayField, "Name", "NAME", "AssetName", "ASSETNAME", "Description", "DESCRIPTION"].filter(Boolean);
    for (const f of preferred) if (attributes[f] !== undefined && attributes[f] !== null && attributes[f] !== "") return f;
    return null;
  }

  function getObjectId(layer, attributes) {
    const f = layer.objectIdField || Object.keys(attributes).find(k => /objectid/i.test(k));
    return f ? attributes[f] : null;
  }

  function makeAssetSelection(layer, graphic) {
    const attrs = graphic.attributes || {};
    const idField = getCandidateIdField(layer, attrs);
    const objectId = getObjectId(layer, attrs);
    const assetId = idField ? safeText(attrs[idField.name]) : (objectId !== null && objectId !== undefined ? `OBJECTID ${objectId}` : "Unidentified Asset");
    const displayField = getDisplayField(layer, attrs);
    const title = displayField ? safeText(attrs[displayField]) : assetId;
    const assetKey = `${layer.id || layer.title}::${assetId}`;
    return {
      layer,
      graphic,
      layerId: layer.id || layer.title,
      layerTitle: layer.title || "ArcGIS Feature Layer",
      assetId,
      assetKey,
      objectId,
      title,
      attributes: attrs,
      geometry: graphic.geometry
    };
  }

  function renderSelectedAsset() {
    if (!state.selected) {
      els.detailEmpty.hidden = false;
      els.assetDetail.hidden = true;
      return;
    }
    const s = state.selected;
    els.detailEmpty.hidden = true;
    els.assetDetail.hidden = false;
    els.assetLayerTitle.textContent = s.layerTitle;
    els.assetTitle.textContent = s.title || s.assetId;
    els.assetIdValue.textContent = s.assetId;

    const layerFields = s.layer.fields || [];
    const fieldByName = Object.fromEntries(layerFields.map(f => [f.name, f]));
    const rows = Object.entries(s.attributes)
      .filter(([k,v]) => v !== null && v !== undefined && v !== "" && !/^shape/i.test(k))
      .slice(0, 18)
      .map(([k,v]) => {
        const label = fieldByName[k]?.alias || k;
        let display = v;
        if (fieldByName[k]?.type === "date" || (typeof v === "number" && /date|time/i.test(k))) {
          try { display = new Date(v).toLocaleString(); } catch {}
        }
        return `<div class="attr-row"><div class="attr-key">${escapeHtml(label)}</div><div class="attr-value">${escapeHtml(display)}</div></div>`;
      });
    els.attributeTable.innerHTML = rows.join("") || `<div class="attr-row"><div class="attr-value">No readable attributes returned.</div></div>`;
    renderAssetWorkOrders();
    if (window.innerWidth <= 1050) els.detailPanel.classList.add("open");
  }

  async function onMapClick(event) {
    try {
      const hit = await state.view.hitTest(event, { include: state.featureLayers });
      const result = hit.results.find(r => r.graphic && r.graphic.layer && r.graphic.layer.type === "feature");
      if (!result) return;
      state.selected = makeAssetSelection(result.graphic.layer, result.graphic);
      renderSelectedAsset();
      renderSelectionGraphic();
    } catch (err) {
      console.warn("Hit test failed", err);
    }
  }

  function symbolForGeometry(geometry, color, selected = false) {
    const outline = selected ? "#083b57" : "#ffffff";
    if (!geometry) return null;
    if (geometry.type === "point" || geometry.type === "multipoint") {
      return { type: "simple-marker", style: "circle", color, size: selected ? 14 : 11, outline: { color: outline, width: selected ? 2.5 : 1.5 } };
    }
    if (geometry.type === "polyline") {
      return { type: "simple-line", color, width: selected ? 5 : 4 };
    }
    if (geometry.type === "polygon" || geometry.type === "extent") {
      return { type: "simple-fill", color: [...hexToRgb(color), selected ? 0.32 : 0.20], outline: { color, width: selected ? 3 : 2 } };
    }
    return null;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function renderSelectionGraphic() {
    if (!state.selectionLayer || !state.selected?.geometry) return;
    state.selectionLayer.removeAll();
    require(["esri/Graphic"], Graphic => {
      state.selectionLayer.add(new Graphic({
        geometry: state.selected.geometry,
        symbol: symbolForGeometry(state.selected.geometry, "#00a6d6", true)
      }));
    });
  }

  function renderWorkOrderGraphics() {
    if (!state.woGraphicsLayer) return;
    state.woGraphicsLayer.removeAll();
    let items = state.workOrders.filter(w => w.geometry);
    if (state.woFilter !== "all") items = items.filter(w => w.status === state.woFilter);
    require(["esri/Graphic", "esri/geometry/Point", "esri/geometry/Polyline", "esri/geometry/Polygon"], (Graphic, Point, Polyline, Polygon) => {
      items.forEach(w => {
        let geometry = null;
        try {
          if (w.geometryType === "point") geometry = Point.fromJSON(w.geometry);
          else if (w.geometryType === "polyline") geometry = Polyline.fromJSON(w.geometry);
          else if (w.geometryType === "polygon") geometry = Polygon.fromJSON(w.geometry);
        } catch {}
        if (!geometry) return;
        const color = statusColors[w.status] || "#c9891b";
        state.woGraphicsLayer.add(new Graphic({
          geometry,
          symbol: symbolForGeometry(geometry, color, false),
          attributes: { __guidelineWoId: w.id }
        }));
      });
    });
  }

  async function focusWorkOrder(id) {
    const wo = state.workOrders.find(w => w.id === id);
    if (!wo || !state.view) return;
    if (wo.geometry) {
      try { await state.view.goTo(wo.geometry, { zoom: Math.max(state.view.zoom, 17), duration: 700 }); } catch {}
    }
    const layer = state.featureLayers.find(l => (l.id || l.title) === wo.layerId);
    if (layer && wo.objectId !== null && wo.objectId !== undefined) {
      try {
        const res = await layer.queryFeatures({ objectIds: [wo.objectId], outFields: ["*"], returnGeometry: true });
        if (res.features[0]) {
          state.selected = makeAssetSelection(layer, res.features[0]);
          renderSelectedAsset();
          renderSelectionGraphic();
        }
      } catch (e) { console.warn(e); }
    }
  }

  async function runAssetSearch() {
    const term = els.assetSearch.value.trim();
    if (!term || term.length < 2) {
      els.searchStatus.textContent = "Enter at least 2 characters.";
      return;
    }
    els.searchStatus.textContent = "Searching visible feature layers…";
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
    const results = [];
    const layers = state.featureLayers.filter(l => l.visible && l.loaded);
    for (const layer of layers) {
      if (results.length >= 30) break;
      try {
        const stringFields = (layer.fields || []).filter(f => f.type === "string").slice(0, 14);
        if (!stringFields.length) continue;
        const escaped = term.replaceAll("'", "''");
        const where = stringFields.map(f => `${f.name} LIKE '%${escaped}%'`).join(" OR ");
        const res = await layer.queryFeatures({ where, outFields: ["*"], returnGeometry: true, num: Math.max(1, 30 - results.length) });
        res.features.forEach(g => results.push({ layer, graphic: g }));
      } catch (err) {
        console.debug("Search skipped layer", layer.title, err);
      }
    }
    if (!results.length) {
      els.searchStatus.textContent = "No matching assets found in visible searchable layers.";
      return;
    }
    els.searchStatus.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
    els.searchResults.innerHTML = results.slice(0,30).map((r,i) => {
      const s = makeAssetSelection(r.layer, r.graphic);
      r.selection = s;
      return `<button type="button" class="search-result" data-result-index="${i}"><div class="search-result-title">${escapeHtml(s.assetId)}</div><div class="search-result-sub">${escapeHtml(s.layerTitle)} · ${escapeHtml(s.title)}</div></button>`;
    }).join("");
    els.searchResults.hidden = false;
    els.searchResults.querySelectorAll(".search-result").forEach(btn => {
      btn.addEventListener("click", async () => {
        const r = results[Number(btn.dataset.resultIndex)];
        state.selected = r.selection || makeAssetSelection(r.layer, r.graphic);
        renderSelectedAsset();
        renderSelectionGraphic();
        try { await state.view.goTo(r.graphic.geometry, { zoom: 18, duration: 700 }); } catch {}
        if (window.innerWidth <= 760) els.sidebar.classList.remove("open");
      });
    });
  }

  async function discoverFeatureLayers() {
    const all = state.webmap.allLayers?.toArray?.() || [];
    const layers = all.filter(l => l.type === "feature");
    await Promise.allSettled(layers.map(l => l.load()));
    state.featureLayers = layers.filter(l => l.loaded);
  }

  function seedLayerOriginalVisibility() {
    const all = state.webmap.allLayers?.toArray?.() || [];
    all.forEach(l => { if (l && l.__guidelineOriginalVisible === undefined) l.__guidelineOriginalVisible = l.visible; });
  }

  function initArcGis() {
    require([
      "esri/WebMap",
      "esri/views/MapView",
      "esri/widgets/LayerList",
      "esri/widgets/Home",
      "esri/widgets/Expand",
      "esri/widgets/Legend",
      "esri/layers/GraphicsLayer"
    ], async (WebMap, MapView, LayerList, Home, Expand, Legend, GraphicsLayer) => {
      try {
        const webmap = new WebMap({ portalItem: { id: WEBMAP_ID } });
        state.webmap = webmap;
        state.woGraphicsLayer = new GraphicsLayer({ title: "Demo Work Orders", listMode: "hide" });
        state.selectionLayer = new GraphicsLayer({ title: "Selected Asset", listMode: "hide" });
        webmap.addMany([state.woGraphicsLayer, state.selectionLayer]);

        const view = new MapView({
          container: "viewDiv",
          map: webmap,
          popup: { dockEnabled: false },
          highlightOptions: { color: "#00a6d6", haloOpacity: .8, fillOpacity: .15 }
        });
        state.view = view;

        await view.when();
        await discoverFeatureLayers();
        seedLayerOriginalVisibility();

        const layerList = new LayerList({ view, container: "layerList" });
        state.layerList = layerList;
        const legend = new Legend({ view });
        view.ui.add(new Expand({ view, content: legend, expandTooltip: "Legend" }), "bottom-left");
        view.ui.add(new Home({ view }), "top-left");

        view.on("click", onMapClick);
        view.on("pointer-move", async evt => {
          try {
            const hit = await view.hitTest(evt, { include: state.featureLayers });
            view.container.style.cursor = hit.results.some(r => r.graphic?.layer?.type === "feature") ? "pointer" : "default";
          } catch {}
        });

        els.loadingOverlay.classList.add("hidden");
        renderWorkOrders();
        renderWorkOrderGraphics();
      } catch (err) {
        console.error(err);
        els.loadingOverlay.innerHTML = `<div class="loading-title">The ArcGIS Web Map could not be loaded.</div><div class="loading-copy">Confirm the Web Map and all required layers are shared publicly, then refresh. ${escapeHtml(err.message || err)}</div>`;
      }
    });
  }

  initDom();
  renderWorkOrders();
  initArcGis();
})();
