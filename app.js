(() => {
  const WEBMAP_ID = "5e88ffc05f0f4bbb968e852d816e09a0";
  const STORAGE_KEY = "guideline-wo-poc-v017";

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
    selectionLayer: null,
    originalBasemap: null,
    Basemap: null,
    Extent: null,
    symbolUtils: null,
    layerUserVisibility: new Map(),
    clientMasterVisibility: new Map(),
    categoryHidden: new Map(),
    categoryEntries: new Map(),
    woClientVisibility: new Map(),
    woStatusVisibility: new Map(),
    expandedClients: new Set(["HCMUD71", "FBLID2"]),
    expandedLayers: new Set(),
    expandedWoClients: new Set()
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
      "loadingOverlay", "districtSelect", "basemapSelect", "assetSearch", "assetSearchBtn", "searchStatus", "searchResults",
      "woCountBadge", "workOrderList", "layerList", "toggleLayerPanelBtn", "detailPanel", "detailEmpty",
      "assetDetail", "assetLayerTitle", "assetTitle", "assetIdValue", "attributeTable", "assetWorkOrders",
      "createWoBtn", "woDialog", "woForm", "dialogAssetLabel", "woType", "woDescription", "woPriority",
      "woStatus", "woAssigned", "saveWoBtn", "resetDemoBtn", "mobileSidebarBtn", "sidebar"
    ].forEach(id => els[id] = $(id));

    els.assetSearchBtn.addEventListener("click", runAssetSearch);
    els.assetSearch.addEventListener("keydown", e => { if (e.key === "Enter") runAssetSearch(); });
    els.districtSelect.addEventListener("change", applyDistrictFilter);
    els.basemapSelect.addEventListener("change", changeBasemap);
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
            <div class="wo-meta">${escapeHtml(clientDisplayName(w.client || "OTHER"))} · ${escapeHtml(w.layerTitle)} · ${escapeHtml(w.assetId)}</div>
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
      client: clientKeyForLayer(state.selected.layer),
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
    renderCustomLayerTree();
  }

  function resetDemoData() {
    if (!confirm("Delete all demo work orders saved in this browser? ArcGIS data will not be affected.")) return;
    state.workOrders = [];
    saveWorkOrders();
    renderWorkOrders();
    renderWorkOrderGraphics();
    renderCustomLayerTree();
  }

  function toggleLayerPanel() {
    const el = els.layerList;
    const hidden = el.style.display === "none";
    el.style.display = hidden ? "block" : "none";
    els.toggleLayerPanelBtn.textContent = hidden ? "Hide" : "Show";
  }

  function layerMatchesClient(layer, client) {
    const title = String(layer?.title || "").toUpperCase().replaceAll(" ", "").replaceAll("_", "").replaceAll("-", "");
    if (client === "HCMUD71") return title.includes("HCMUD71") || title.includes("HCMUD071");
    if (client === "FBLID2") return title.includes("FBLID2") || title.includes("FBLID02");
    return true;
  }


  function clientKeyForLayer(layer) {
    const title = String(layer?.title || "").toUpperCase().replaceAll(" ", "").replaceAll("_", "").replaceAll("-", "");
    if (title.includes("HCMUD71") || title.includes("HCMUD071")) return "HCMUD71";
    if (title.includes("FBLID2") || title.includes("FBLID02")) return "FBLID2";
    return "OTHER";
  }

  function clientDisplayName(client) {
    if (client === "HCMUD71") return "HCMUD 71";
    if (client === "FBLID2") return "FBLID 2";
    return "Other";
  }

  function cleanLayerTitle(layer, client) {
    let title = String(layer?.title || "Asset Layer");
    if (client === "HCMUD71") title = title.replace(/^HCMUD\s*0?71[\s_-]*/i, "");
    if (client === "FBLID2") title = title.replace(/^FBLID\s*0?2[\s_-]*/i, "");
    return title || layer?.title || "Asset Layer";
  }

  function selectedClientAllows(client) {
    const selected = els.districtSelect?.value || "all";
    return selected === "all" || selected === client;
  }

  function effectiveLayerVisible(layer) {
    const client = clientKeyForLayer(layer);
    const userVisible = state.layerUserVisibility.get(layer.id) ?? layer.__guidelineOriginalVisible ?? true;
    const clientMaster = state.clientMasterVisibility.get(client) ?? true;
    return !!(selectedClientAllows(client) && clientMaster && userVisible);
  }

  function applyOperationalVisibility() {
    state.featureLayers.forEach(layer => {
      layer.visible = effectiveLayerVisible(layer);
    });
  }

  function eyeSvg(visible) {
    return visible
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10.5 10.5 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17 17 0 0 1-2.5 3.2M6.2 7.3C3.8 9.2 2.5 12 2.5 12s3.4 6 9.5 6c1.4 0 2.7-.3 3.8-.7M9.9 9.9A3 3 0 0 0 14.1 14.1"/></svg>`;
  }

  function arrowSvg(expanded) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" class="${expanded ? "expanded" : ""}"><path d="m8 10 4 4 4-4"/></svg>`;
  }

  function sqlLiteral(layer, fieldName, raw) {
    if (raw === null || raw === undefined) return "NULL";
    const field = (layer.fields || []).find(f => f.name === fieldName);
    const type = String(field?.type || "").toLowerCase();
    if (type.includes("integer") || type.includes("double") || type.includes("single") || type.includes("small")) {
      const n = Number(raw);
      return Number.isFinite(n) ? String(n) : "NULL";
    }
    return `'${String(raw).replaceAll("'", "''")}'`;
  }

  function uniqueValueClause(layer, renderer, info) {
    const fields = [renderer.field, renderer.field2, renderer.field3].filter(Boolean);
    if (!fields.length) return null;

    const delimiter = renderer.fieldDelimiter || ", ";
    const rawValue = info.value;
    const values = fields.length === 1
      ? [rawValue]
      : String(rawValue).split(delimiter);

    if (values.length < fields.length) return null;

    return fields.map((field, i) => {
      const raw = values[i];
      if (raw === null || raw === undefined || String(raw).toLowerCase() === "<null>") {
        return `${field} IS NULL`;
      }
      return `${field} = ${sqlLiteral(layer, field, raw)}`;
    }).join(" AND ");
  }

  function getRendererEntries(layer) {
    const renderer = layer?.renderer;
    if (!renderer) return [];

    if (renderer.type === "simple" && renderer.symbol) {
      return [{
        key: "simple",
        label: cleanLayerTitle(layer, clientKeyForLayer(layer)),
        symbol: renderer.symbol,
        clause: null
      }];
    }

    if (renderer.type === "unique-value") {
      return (renderer.uniqueValueInfos || []).map((info, i) => ({
        key: `uv:${i}:${String(info.value)}`,
        label: info.label || safeText(info.value),
        symbol: info.symbol,
        clause: uniqueValueClause(layer, renderer, info)
      }));
    }

    if (renderer.type === "class-breaks") {
      const field = renderer.field;
      return (renderer.classBreakInfos || []).map((info, i) => {
        const min = Number(info.minValue);
        const max = Number(info.maxValue);
        let clause = null;
        if (field && Number.isFinite(max)) {
          clause = Number.isFinite(min)
            ? `(${field} > ${min} AND ${field} <= ${max})`
            : `${field} <= ${max}`;
        }
        return {
          key: `cb:${i}:${min}:${max}`,
          label: info.label || `${safeText(info.minValue)} – ${safeText(info.maxValue)}`,
          symbol: info.symbol,
          clause
        };
      });
    }

    return [];
  }

  function getCachedRendererEntries(layer) {
    if (!state.categoryEntries.has(layer.id)) {
      state.categoryEntries.set(layer.id, getRendererEntries(layer));
    }
    return state.categoryEntries.get(layer.id) || [];
  }

  async function renderSymbolPreview(node, symbol, geometryType) {
    if (!node) return;
    node.innerHTML = "";
    if (symbol && state.symbolUtils) {
      try {
        await state.symbolUtils.renderPreviewHTML(symbol.clone ? symbol.clone() : symbol, {
          node,
          size: 16,
          symbolConfig: { isSquareFill: true }
        });
        if (node.childNodes.length) return;
      } catch (err) {
        console.debug("Symbol preview fallback", err);
      }
    }

    const fallback = document.createElement("span");
    fallback.className = `symbol-fallback symbol-${geometryType || "point"}`;
    node.appendChild(fallback);
  }

  function createEyeButton(visible, label, onClick, disabled = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `layer-eye ${visible ? "is-visible" : "is-hidden"}`;
    btn.innerHTML = eyeSvg(visible);
    btn.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${label}`);
    btn.title = `${visible ? "Hide" : "Show"} ${label}`;
    btn.disabled = disabled;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function createArrowButton(expanded, label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "layer-arrow";
    btn.innerHTML = arrowSvg(expanded);
    btn.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${label}`);
    btn.title = `${expanded ? "Collapse" : "Expand"} ${label}`;
    btn.addEventListener("click", onClick);
    return btn;
  }

  async function applyCategoryVisibility(layer) {
    const entries = getCachedRendererEntries(layer);
    const hidden = state.categoryHidden.get(layer.id) || new Set();
    const hiddenClauses = entries
      .filter(entry => hidden.has(entry.key) && entry.clause)
      .map(entry => `(${entry.clause})`);

    const where = hiddenClauses.length ? `NOT (${hiddenClauses.join(" OR ")})` : null;
    layer.__guidelineCategoryWhere = where;

    try {
      const layerView = await state.view.whenLayerView(layer);
      layerView.filter = where ? { where } : null;
    } catch (err) {
      console.warn("Could not apply category visibility", layer.title, err);
    }
  }

  function workOrderClientVisible(client) {
    return state.woClientVisibility.get(client) ?? true;
  }

  function workOrderStatusVisible(client, status) {
    const map = state.woStatusVisibility.get(client);
    return map ? (map.get(status) ?? true) : true;
  }

  function initializeCustomLayerState() {
    state.featureLayers.forEach(layer => {
      const client = clientKeyForLayer(layer);
      state.layerUserVisibility.set(layer.id, layer.__guidelineOriginalVisible ?? layer.visible);
      if (!state.clientMasterVisibility.has(client)) state.clientMasterVisibility.set(client, true);
      if (!state.woClientVisibility.has(client)) state.woClientVisibility.set(client, true);
      if (!state.woStatusVisibility.has(client)) {
        state.woStatusVisibility.set(client, new Map(
          Object.keys(statusColors).map(status => [status, true])
        ));
      }
    });

    ["HCMUD71", "FBLID2"].forEach(client => {
      if (!state.clientMasterVisibility.has(client)) state.clientMasterVisibility.set(client, true);
      if (!state.woClientVisibility.has(client)) state.woClientVisibility.set(client, true);
      if (!state.woStatusVisibility.has(client)) {
        state.woStatusVisibility.set(client, new Map(
          Object.keys(statusColors).map(status => [status, true])
        ));
      }
    });
  }

  async function renderCustomLayerTree() {
    if (!els.layerList) return;
    els.layerList.innerHTML = "";

    const selectedClient = els.districtSelect.value;
    const groups = new Map();

    state.featureLayers.forEach(layer => {
      const client = clientKeyForLayer(layer);
      if (client === "OTHER") return;
      if (selectedClient !== "all" && selectedClient !== client) return;
      if (!groups.has(client)) groups.set(client, []);
      groups.get(client).push(layer);
    });

    const orderedClients = ["HCMUD71", "FBLID2"].filter(client =>
      groups.has(client) || selectedClient === client
    );

    const previewJobs = [];

    for (const client of orderedClients) {
      const clientWrap = document.createElement("div");
      clientWrap.className = "client-layer-group";

      const header = document.createElement("div");
      header.className = "layer-row client-layer-row";

      const clientVisible = state.clientMasterVisibility.get(client) ?? true;
      const clientExpanded = state.expandedClients.has(client);

      header.appendChild(createEyeButton(clientVisible, clientDisplayName(client), () => {
        state.clientMasterVisibility.set(client, !clientVisible);
        applyOperationalVisibility();
        renderWorkOrderGraphics();
        renderCustomLayerTree();
      }));

      header.appendChild(createArrowButton(clientExpanded, clientDisplayName(client), () => {
        if (clientExpanded) state.expandedClients.delete(client);
        else state.expandedClients.add(client);
        renderCustomLayerTree();
      }));

      const headerLabel = document.createElement("div");
      headerLabel.className = "layer-label client-label";
      headerLabel.textContent = clientDisplayName(client);
      header.appendChild(headerLabel);

      clientWrap.appendChild(header);

      const children = document.createElement("div");
      children.className = "client-layer-children";
      children.hidden = !clientExpanded;

      for (const layer of (groups.get(client) || [])) {
        const entries = getCachedRendererEntries(layer);
        const multi = entries.length > 1;
        const row = document.createElement("div");
        row.className = "layer-row asset-layer-row";

        const userVisible = state.layerUserVisibility.get(layer.id) ?? true;
        const effectiveVisible = effectiveLayerVisible(layer);

        row.appendChild(createEyeButton(effectiveVisible, layer.title, () => {
          state.layerUserVisibility.set(layer.id, !userVisible);
          applyOperationalVisibility();
          renderCustomLayerTree();
        }));

        if (multi) {
          const expanded = state.expandedLayers.has(layer.id);
          row.appendChild(createArrowButton(expanded, layer.title, () => {
            if (expanded) state.expandedLayers.delete(layer.id);
            else state.expandedLayers.add(layer.id);
            renderCustomLayerTree();
          }));
        } else {
          const symbolCell = document.createElement("div");
          symbolCell.className = "layer-symbol";
          row.appendChild(symbolCell);
          if (entries[0]?.symbol) {
            previewJobs.push(renderSymbolPreview(symbolCell, entries[0].symbol, layer.geometryType));
          } else {
            previewJobs.push(renderSymbolPreview(symbolCell, null, layer.geometryType));
          }
        }

        const label = document.createElement("div");
        label.className = "layer-label";
        label.textContent = cleanLayerTitle(layer, client);
        label.title = layer.title;
        row.appendChild(label);
        children.appendChild(row);

        if (multi) {
          const sub = document.createElement("div");
          sub.className = "symbol-category-list";
          sub.hidden = !state.expandedLayers.has(layer.id);

          const hidden = state.categoryHidden.get(layer.id) || new Set();

          for (const entry of entries) {
            const child = document.createElement("div");
            child.className = "layer-row symbol-category-row";
            const canToggle = !!entry.clause;
            const visible = !hidden.has(entry.key);

            child.appendChild(createEyeButton(visible, `${layer.title}: ${entry.label}`, async () => {
              if (!canToggle) return;
              const next = new Set(state.categoryHidden.get(layer.id) || []);
              if (next.has(entry.key)) next.delete(entry.key);
              else next.add(entry.key);
              state.categoryHidden.set(layer.id, next);
              await applyCategoryVisibility(layer);
              renderCustomLayerTree();
            }, !canToggle));

            const symbolCell = document.createElement("div");
            symbolCell.className = "layer-symbol";
            child.appendChild(symbolCell);
            previewJobs.push(renderSymbolPreview(symbolCell, entry.symbol, layer.geometryType));

            const childLabel = document.createElement("div");
            childLabel.className = "layer-label category-label";
            childLabel.textContent = entry.label;
            if (!canToggle) childLabel.title = "This renderer category can be displayed but cannot be independently filtered in this POC.";
            child.appendChild(childLabel);

            sub.appendChild(child);
          }

          children.appendChild(sub);
        }
      }

      // Client work-order pseudo layer. It uses the same nested behavior as a
      // multi-symbol ArcGIS layer, with each WO status as a child symbol.
      const woRow = document.createElement("div");
      woRow.className = "layer-row asset-layer-row wo-layer-row";

      const woVisible = workOrderClientVisible(client);
      woRow.appendChild(createEyeButton(woVisible, `${clientDisplayName(client)} Work Orders`, () => {
        state.woClientVisibility.set(client, !woVisible);
        renderWorkOrderGraphics();
        renderCustomLayerTree();
      }));

      const woExpanded = state.expandedWoClients.has(client);
      woRow.appendChild(createArrowButton(woExpanded, `${clientDisplayName(client)} Work Orders`, () => {
        if (woExpanded) state.expandedWoClients.delete(client);
        else state.expandedWoClients.add(client);
        renderCustomLayerTree();
      }));

      const woLabel = document.createElement("div");
      woLabel.className = "layer-label wo-layer-label";
      woLabel.textContent = `${clientDisplayName(client)} Work Orders`;
      woRow.appendChild(woLabel);
      children.appendChild(woRow);

      const woSub = document.createElement("div");
      woSub.className = "symbol-category-list";
      woSub.hidden = !woExpanded;

      Object.keys(statusColors).forEach(status => {
        const statusRow = document.createElement("div");
        statusRow.className = "layer-row symbol-category-row";

        const statusVisible = workOrderStatusVisible(client, status);
        statusRow.appendChild(createEyeButton(statusVisible, `${clientDisplayName(client)} ${status} work orders`, () => {
          const map = state.woStatusVisibility.get(client) || new Map();
          map.set(status, !statusVisible);
          state.woStatusVisibility.set(client, map);
          renderWorkOrderGraphics();
          renderCustomLayerTree();
        }));

        const swatch = document.createElement("div");
        swatch.className = "layer-symbol";
        swatch.innerHTML = `<span class="wo-symbol-swatch" style="--wo-color:${statusColors[status]}"></span>`;
        statusRow.appendChild(swatch);

        const statusLabel = document.createElement("div");
        statusLabel.className = "layer-label category-label";
        statusLabel.textContent = status;
        statusRow.appendChild(statusLabel);
        woSub.appendChild(statusRow);
      });

      children.appendChild(woSub);
      clientWrap.appendChild(children);
      els.layerList.appendChild(clientWrap);
    }

    await Promise.allSettled(previewJobs);
  }

  function applyDistrictFilter() {
    applyOperationalVisibility();

    if (state.selected) {
      const selectedClient = clientKeyForLayer(state.selected.layer);
      if (!selectedClientAllows(selectedClient) || !state.selected.layer.visible) {
        clearSelection();
      }
    }

    renderWorkOrderGraphics();
    renderCustomLayerTree();
  }

  async function changeBasemap() {
    if (!state.webmap) return;
    const id = els.basemapSelect.value;

    try {
      if (id === "webmap") {
        // Restore a clone so the exact Web Map default is restored reliably.
        state.webmap.basemap = state.originalBasemap?.clone
          ? state.originalBasemap.clone()
          : state.originalBasemap;
      } else {
        // ArcGIS Map/WebMap supports assigning a well-known basemap ID directly.
        state.webmap.basemap = id;
      }

      // Wait for the replacement basemap to become ready before declaring success.
      if (state.webmap.basemap?.load) {
        try { await state.webmap.basemap.load(); } catch {}
      }
    } catch (err) {
      console.warn("Basemap change failed", err);
      els.basemapSelect.value = "webmap";
      state.webmap.basemap = state.originalBasemap?.clone
        ? state.originalBasemap.clone()
        : state.originalBasemap;
    }
  }

  function clearSelection() {
    state.selected = null;
    if (state.selectionLayer) state.selectionLayer.removeAll();
    renderSelectedAsset();
    els.detailPanel.classList.remove("open");
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
      els.detailEmpty.style.display = "";
      els.assetDetail.style.display = "none";
      return;
    }

    const s = state.selected;

    // FIRST: force the selected-asset UI visible immediately.
    // No asset-ID detection, field formatting, WO lookup, or highlighting is
    // allowed to block this state change.
    els.detailEmpty.hidden = true;
    els.assetDetail.hidden = false;
    els.detailEmpty.style.display = "none";
    els.assetDetail.style.display = "block";
    els.detailPanel.classList.add("open");

    // Always show the ArcGIS layer first, even if every other heuristic fails.
    els.assetLayerTitle.textContent = s.layerTitle || s.layer?.title || "ArcGIS Asset";
    els.assetTitle.textContent = "Selected Asset";
    els.assetIdValue.textContent = "—";

    // SECOND: dump the raw ArcGIS attributes into the panel.
    const attrs = s.graphic?.attributes || s.attributes || {};
    try {
      const fields = s.layer?.fields || [];
      const fieldByName = Object.fromEntries(fields.map(f => [f.name, f]));

      const rows = Object.entries(attrs)
        .filter(([k, v]) =>
          v !== null &&
          v !== undefined &&
          v !== "" &&
          !/^shape/i.test(k)
        )
        .slice(0, 40)
        .map(([k, v]) => {
          const field = fieldByName[k];
          const label = field?.alias || k;
          let display = v;

          if (field?.type === "date") {
            try {
              const dt = new Date(v);
              if (!Number.isNaN(dt.getTime())) display = dt.toLocaleString();
            } catch {}
          }

          return `<div class="attr-row"><div class="attr-key">${escapeHtml(label)}</div><div class="attr-value">${escapeHtml(display)}</div></div>`;
        });

      els.attributeTable.innerHTML = rows.join("") ||
        `<div class="attr-row"><div class="attr-value">ArcGIS selected this feature but returned no displayable attributes.</div></div>`;
    } catch (err) {
      console.error("Raw ArcGIS attribute render failed", err);
      els.attributeTable.innerHTML =
        `<div class="attr-row"><div class="attr-value">Feature selected. Raw attribute formatting encountered an error.</div></div>`;
    }

    // THIRD: try to derive a human-friendly Asset ID/title.
    // Failure here must never hide the already-rendered panel.
    try {
      const idField = getCandidateIdField(s.layer);
      let assetId = null;

      if (idField && attrs[idField] !== undefined && attrs[idField] !== null && attrs[idField] !== "") {
        assetId = String(attrs[idField]);
      }

      if (!assetId) {
        const preferred = [
          "GIS_ID", "GISID", "ASSET_ID", "ASSETID", "FACILITYID",
          "FACILITY_ID", "UNIQUE_ID", "UNIQUEID", "ID", "NAME", "Name",
          "OBJECTID", "ObjectID"
        ];
        const found = preferred.find(key =>
          attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== ""
        );
        if (found) assetId = String(attrs[found]);
      }

      if (!assetId) assetId = s.assetId || "Unindexed Asset";

      s.assetId = assetId;
      s.attributes = attrs;

      let title = assetId;
      try {
        title = getDisplayTitle(s.layer, attrs, assetId) || assetId;
      } catch {}

      s.title = title;
      els.assetIdValue.textContent = assetId;
      els.assetTitle.textContent = title;
    } catch (err) {
      console.debug("Asset ID/title detection skipped", err);
      els.assetIdValue.textContent = s.assetId || "Unindexed Asset";
      els.assetTitle.textContent = s.title || "Selected Asset";
    }

    // FOURTH: WO lookup is non-blocking.
    try {
      renderAssetWorkOrders();
    } catch (err) {
      console.error("WO rendering failed", err);
      els.assetWoList.innerHTML =
        `<div class="helper">No demo work orders are available for this selected asset yet.</div>`;
    }

    console.info("Guideline v0.1.6 selected:", {
      layer: s.layerTitle || s.layer?.title,
      assetId: s.assetId,
      attributes: attrs
    });
  }

  function resolveOperationalFeatureLayer(result) {
    const graphic = result?.graphic;
    const candidates = [
      result?.layer,
      graphic?.layer,
      graphic?.sourceLayer
    ].filter(Boolean);

    for (const candidate of candidates) {
      const direct = state.featureLayers.find(layer => layer === candidate);
      if (direct) return direct;

      const byId = state.featureLayers.find(layer =>
        candidate.id && layer.id === candidate.id
      );
      if (byId) return byId;

      const byUrl = state.featureLayers.find(layer =>
        candidate.url && layer.url === candidate.url
      );
      if (byUrl) return byUrl;

      const byTitle = state.featureLayers.find(layer =>
        candidate.title && layer.title === candidate.title
      );
      if (byTitle) return byTitle;
    }

    return null;
  }

  function layerIsSelectable(layer) {
    if (!layer || !layer.visible || !layer.loaded) return false;

    const scale = state.view?.scale;
    if (scale) {
      if (layer.minScale && scale > layer.minScale) return false;
      if (layer.maxScale && scale < layer.maxScale) return false;
    }
    return true;
  }

  function geometryAnchorPoint(geometry) {
    if (!geometry) return null;
    if (geometry.type === "point") return geometry;
    if (geometry.type === "polygon" && geometry.centroid) return geometry.centroid;
    if (geometry.extent?.center) return geometry.extent.center;
    return null;
  }

  async function queryLayerAtMapClick(layer, event) {
    try {
      if (!layerIsSelectable(layer)) return null;
      if (!event?.mapPoint) return null;

      // Convert ~12 screen pixels to a real map-space Extent around the click.
      const screenA = { x: event.x - 12, y: event.y - 12 };
      const screenB = { x: event.x + 12, y: event.y + 12 };
      const a = state.view.toMap(screenA);
      const b = state.view.toMap(screenB);
      if (!a || !b) return null;

      const extent = new state.Extent({
        xmin: Math.min(a.x, b.x),
        ymin: Math.min(a.y, b.y),
        xmax: Math.max(a.x, b.x),
        ymax: Math.max(a.y, b.y),
        spatialReference: event.mapPoint.spatialReference
      });

      const result = await layer.queryFeatures({
        geometry: extent,
        spatialRelationship: "intersects",
        where: layer.__guidelineCategoryWhere || "1=1",
        outFields: ["*"],
        returnGeometry: true,
        num: 5
      });

      if (!result?.features?.length) return null;

      const ranked = result.features.map(graphic => {
        let distance = Number.POSITIVE_INFINITY;
        try {
          const anchor = geometryAnchorPoint(graphic.geometry);
          if (anchor) {
            const p = state.view.toScreen(anchor);
            if (p) distance = Math.hypot(p.x - event.x, p.y - event.y);
          }
        } catch {}
        return { graphic, distance };
      }).sort((a, b) => a.distance - b.distance);

      return {
        layer,
        graphic: ranked[0].graphic,
        distance: ranked[0].distance
      };
    } catch (err) {
      console.debug("Map-click query skipped layer", layer?.title, err);
      return null;
    }
  }

  async function selectAssetFromMapClick(event) {
    const layers = state.featureLayers.filter(layerIsSelectable);
    if (!layers.length) return null;

    // Directly query all visible operational FeatureLayers. This is deliberately
    // independent of ArcGIS popup and hitTest behavior.
    const matches = (await Promise.all(
      layers.map(layer => queryLayerAtMapClick(layer, event))
    )).filter(Boolean);

    if (!matches.length) return null;

    // Prefer the feature spatially closest to the click. If equal, prefer the
    // later/top-most operational layer.
    const order = new Map(state.featureLayers.map((layer, i) => [layer, i]));
    matches.sort((a, b) => {
      if (Math.abs(a.distance - b.distance) > 0.25) return a.distance - b.distance;
      return (order.get(b.layer) ?? 0) - (order.get(a.layer) ?? 0);
    });

    return matches[0];
  }

  async function onMapClick(event) {
    try {
      if (event?.stopPropagation) event.stopPropagation();

      if (state.view) {
        state.view.popupEnabled = false;
        state.view.popup = null;
      }

      // Keep the v0.1.4 selection method that successfully identified and
      // highlighted real assets in the live Web Map.
      const selection = await selectAssetFromMapClick(event);

      if (!selection) {
        clearSelection();
        return;
      }

      const { layer, graphic } = selection;

      // Construct only the minimum state required for the panel.
      // The panel itself performs all optional ID/title/WO enrichment afterward.
      state.selected = {
        layer,
        graphic,
        geometry: graphic?.geometry || null,
        attributes: graphic?.attributes || {},
        layerTitle: layer?.title || "ArcGIS Asset",
        assetId: null,
        title: null
      };

      // CRITICAL: render the right panel before any visual highlighting or other logic.
      renderSelectedAsset();

      // Highlight remains cosmetic/non-blocking.
      try {
        renderSelectionGraphic();
      } catch (highlightError) {
        console.debug("Selection highlight skipped", highlightError);
      }
    } catch (err) {
      console.error("Guideline v0.1.6 asset selection failed", err);
      clearSelection();
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

    if (state.woFilter !== "all") {
      items = items.filter(w => w.status === state.woFilter);
    }

    items = items.filter(w => {
      const client = w.client || "OTHER";
      if (!selectedClientAllows(client)) return false;
      if (!workOrderClientVisible(client)) return false;
      if (!workOrderStatusVisible(client, w.status)) return false;
      return true;
    });

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
          attributes: {
            __guidelineWoId: w.id,
            __guidelineClient: w.client || "OTHER"
          }
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

  function searchFieldScore(field) {
    const n = `${field.name} ${field.alias || ""}`.toLowerCase();
    let score = 0;
    if (/asset.?id/.test(n)) score += 120;
    if (/facility.?id/.test(n)) score += 110;
    if (/cityworks/.test(n) && /id/.test(n)) score += 100;
    if (/unique.?id/.test(n)) score += 95;
    if (/(^|\\W)id(\\W|$)/.test(n)) score += 70;
    if (/name/.test(n)) score += 55;
    if (/description|desc/.test(n)) score += 35;
    if (/address|location/.test(n)) score += 30;
    if (/globalid|objectid|shape/.test(n)) score -= 25;
    return score;
  }

  async function searchOneLayer(layer, term) {
    try {
      const fields = (layer.fields || [])
        .filter(f => f.type === "string")
        .map(f => ({ field: f, score: searchFieldScore(f) }))
        .sort((a,b) => b.score - a.score)
        .slice(0, 8)
        .map(x => x.field);

      if (!fields.length) return [];

      const escaped = term.replaceAll("'", "''");
      const searchWhere = fields.map(f => `${f.name} LIKE '%${escaped}%'`).join(" OR ");
      const categoryWhere = layer.__guidelineCategoryWhere;
      const where = categoryWhere ? `(${categoryWhere}) AND (${searchWhere})` : searchWhere;
      const res = await layer.queryFeatures({
        where,
        outFields: ["*"],
        returnGeometry: true,
        num: 8
      });
      return res.features.map(graphic => ({ layer, graphic }));
    } catch (err) {
      console.debug("Search skipped layer", layer.title, err);
      return [];
    }
  }

  async function runAssetSearch() {
    const term = els.assetSearch.value.trim();
    if (!term || term.length < 2) {
      els.searchStatus.textContent = "Enter at least 2 characters.";
      return;
    }

    els.searchStatus.textContent = "Searching ArcGIS asset layers…";
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";

    const client = els.districtSelect.value;
    const layers = state.featureLayers.filter(l => {
      if (!l.loaded || !l.visible) return false;
      return client === "all" || layerMatchesClient(l, client);
    });

    // Query layers concurrently. This is still live ArcGIS search, but materially
    // faster than the sequential v0.1 approach.
    const batches = await Promise.all(layers.map(layer => searchOneLayer(layer, term)));
    const results = batches.flat().slice(0, 30);

    if (!results.length) {
      els.searchStatus.textContent = "No matching assets found in the current client/layers.";
      return;
    }

    els.searchStatus.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
    els.searchResults.innerHTML = results.map((r,i) => {
      const s = makeAssetSelection(r.layer, r.graphic);
      r.selection = s;
      return `<button type="button" class="search-result" data-result-index="${i}"><div class="search-result-title">${escapeHtml(s.assetId)}</div><div class="search-result-sub">${escapeHtml(s.layerTitle)} · ${escapeHtml(s.title)}</div></button>`;
    }).join("");
    els.searchResults.hidden = false;

    els.searchResults.querySelectorAll(".search-result").forEach(btn => {
      btn.addEventListener("click", async () => {
        const r = results[Number(btn.dataset.resultIndex)];
        state.selected = {
          layer: r.layer,
          graphic: r.graphic,
          geometry: r.graphic?.geometry || null,
          attributes: r.graphic?.attributes || {},
          layerTitle: r.layer?.title || "ArcGIS Asset",
          assetId: null,
          title: null
        };
        renderSelectedAsset();
        try { renderSelectionGraphic(); } catch {}
        try { await state.view.goTo(r.graphic.geometry, { zoom: 18, duration: 700 }); } catch {}
        if (window.innerWidth <= 760) els.sidebar.classList.remove("open");
      });
    });
  }

  function collectOperationalFeatureLayers(collection, out = []) {
    if (!collection) return out;

    collection.forEach(layer => {
      if (!layer) return;

      if (layer.type === "group" && layer.layers) {
        collectOperationalFeatureLayers(layer.layers, out);
        return;
      }

      if (layer.type === "feature") {
        out.push(layer);
      }
    });

    return out;
  }

  async function discoverFeatureLayers() {
    // IMPORTANT: webmap.layers = operational layers only.
    // Do NOT use webmap.allLayers because ArcGIS includes basemap/reference layers there.
    const layers = collectOperationalFeatureLayers(state.webmap.layers);
    await Promise.allSettled(layers.map(l => l.load()));
    state.featureLayers = layers.filter(l => l.loaded);
  }

  function seedLayerOriginalVisibility() {
    state.featureLayers.forEach(layer => {
      if (layer && layer.__guidelineOriginalVisible === undefined) {
        layer.__guidelineOriginalVisible = layer.visible;
      }
    });
  }

  function initArcGis() {
    require([
      "esri/WebMap",
      "esri/views/MapView",
      "esri/widgets/Home",
      "esri/widgets/Expand",
      "esri/widgets/Legend",
      "esri/layers/GraphicsLayer",
      "esri/Basemap",
      "esri/geometry/Extent",
      "esri/symbols/support/symbolUtils"
    ], async (WebMap, MapView, Home, Expand, Legend, GraphicsLayer, Basemap, Extent, symbolUtils) => {
      try {
        const webmap = new WebMap({ portalItem: { id: WEBMAP_ID } });
        state.webmap = webmap;
        state.Basemap = Basemap;
        state.Extent = Extent;
        state.symbolUtils = symbolUtils;
        state.woGraphicsLayer = new GraphicsLayer({ title: "Demo Work Orders", listMode: "hide" });
        state.selectionLayer = new GraphicsLayer({ title: "Selected Asset", listMode: "hide" });
        webmap.addMany([state.woGraphicsLayer, state.selectionLayer]);

        const view = new MapView({
          container: "viewDiv",
          map: webmap,
          popup: null,
          popupEnabled: false,
          highlightOptions: { color: "#00a6d6", haloOpacity: .8, fillOpacity: .15 }
        });
        state.view = view;

        await view.when();

        // Definitively remove the ArcGIS popup experience.
        // popupEnabled=false stops click-to-popup; popup=null prevents a Popup from existing.
        view.popupEnabled = false;
        view.popup = null;

        // Clone the original basemap so it can be restored after testing alternatives.
        state.originalBasemap = webmap.basemap?.clone
          ? webmap.basemap.clone()
          : webmap.basemap;

        await discoverFeatureLayers();
        state.featureLayers.forEach(layer => {
          layer.popupEnabled = false;
        });
        seedLayerOriginalVisibility();
        console.info(`Guideline POC: ${state.featureLayers.length} operational FeatureLayers indexed for selection/search.`);

        initializeCustomLayerState();
        applyOperationalVisibility();
        await renderCustomLayerTree();

        const legend = new Legend({ view });
        view.ui.add(new Expand({ view, content: legend, expandTooltip: "Legend" }), "bottom-left");
        view.ui.add(new Home({ view }), "top-left");

        view.on("click", onMapClick);
        view.on("pointer-move", async evt => {
          try {
            const hit = await view.hitTest(evt);
            view.container.style.cursor = hit.results.some(result => {
              const layer = resolveOperationalFeatureLayer(result);
              return !!layer && layer.visible;
            }) ? "pointer" : "default";
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
