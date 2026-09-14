"use strict";
(() => {
  // node_modules/bippy/dist/rdt-hook.js
  var e = `0.5.43`;
  var t = `bippy-${e}`;
  var n = Object.defineProperty;
  var r = Object.prototype.hasOwnProperty;
  var i = () => {
  };
  var a = (e2) => {
    try {
      Function.prototype.toString.call(e2).indexOf(`^_^`) > -1 && setTimeout(() => {
        throw Error(`React is running in production mode, but dead code elimination has not been applied. Read how to correctly configure React for production: https://reactjs.org/link/perf-use-production-build`);
      });
    } catch {
    }
  };
  var o = (e2 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) => !!(e2 && `getFiberRoots` in e2);
  var s = false;
  var c;
  var l = (e2 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) => s ? true : (e2 && typeof e2.inject == `function` && (c = e2.inject.toString()), !!c?.includes(`(injected)`));
  var u = /* @__PURE__ */ new Set();
  var d = /* @__PURE__ */ new Set();
  var f = (e2) => {
    let r2 = /* @__PURE__ */ new Map(), o2 = 0, s2 = { _instrumentationIsActive: false, _instrumentationSource: t, checkDCE: a, hasUnsupportedRendererAttached: false, inject(e3) {
      let t2 = ++o2;
      return r2.set(t2, e3), d.add(e3), s2._instrumentationIsActive || (s2._instrumentationIsActive = true, u.forEach((e4) => e4())), t2;
    }, on: i, onCommitFiberRoot: i, onCommitFiberUnmount: i, onPostCommitFiberRoot: i, renderers: r2, supportsFiber: true, supportsFlight: true };
    try {
      n(globalThis, `__REACT_DEVTOOLS_GLOBAL_HOOK__`, { configurable: true, enumerable: true, get() {
        return s2;
      }, set(t3) {
        if (t3 && typeof t3 == `object`) {
          let n2 = s2.renderers;
          s2 = t3, n2.size > 0 && (n2.forEach((e3, n3) => {
            d.add(e3), t3.renderers.set(n3, e3);
          }), p(e2));
        }
      } });
      let t2 = window.hasOwnProperty, r3 = false;
      n(window, `hasOwnProperty`, { configurable: true, value: function(...e3) {
        try {
          if (!r3 && e3[0] === `__REACT_DEVTOOLS_GLOBAL_HOOK__`) return globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = void 0, r3 = true, -0;
        } catch {
        }
        return t2.apply(this, e3);
      }, writable: true });
    } catch {
      p(e2);
    }
    return s2;
  };
  var p = (e2) => {
    e2 && u.add(e2);
    try {
      let n2 = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!n2) return;
      if (!n2._instrumentationSource) {
        n2.checkDCE = a, n2.supportsFiber = true, n2.supportsFlight = true, n2.hasUnsupportedRendererAttached = false, n2._instrumentationSource = t, n2._instrumentationIsActive = false;
        let e3 = o(n2);
        if (e3 || (n2.on = i), n2.renderers.size) {
          n2._instrumentationIsActive = true, u.forEach((e4) => e4());
          return;
        }
        let r2 = n2.inject, c2 = l(n2);
        c2 && !e3 && (s = true, n2.inject({ scheduleRefresh() {
        } }) && (n2._instrumentationIsActive = true)), n2.inject = (e4) => {
          let t2 = r2(e4);
          return d.add(e4), c2 && n2.renderers.set(t2, e4), n2._instrumentationIsActive = true, u.forEach((e5) => e5()), t2;
        };
      }
      (n2.renderers.size || n2._instrumentationIsActive || l()) && e2?.();
    } catch {
    }
  };
  var m = () => r.call(globalThis, `__REACT_DEVTOOLS_GLOBAL_HOOK__`);
  var h = (e2) => m() ? (p(e2), globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) : f(e2);
  var g = () => !!(typeof window < `u` && (window.document?.createElement || window.navigator?.product === `ReactNative`));
  var _ = () => {
    try {
      g() && h();
    } catch {
    }
  };

  // node_modules/bippy/dist/install-hook-only.js
  _();

  // node_modules/bippy/dist/core.js
  var b = (e2) => {
    switch (e2.tag) {
      case 5:
      case 26:
      case 27:
        return true;
      default:
        return typeof e2.type == `string`;
    }
  };
  var be = (e2) => {
    switch (e2.tag) {
      case 1:
      case 11:
      case 0:
      case 14:
      case 15:
        return true;
      default:
        return false;
    }
  };
  var N = (e2) => {
    let t2 = e2;
    return typeof t2 == `function` ? t2 : typeof t2 == `object` && t2 ? N(t2.type || t2.render) : null;
  };
  var Ee = (e2) => {
    let t2 = e2;
    if (typeof t2 == `string`) return t2;
    if (typeof t2 != `function` && !(typeof t2 == `object` && t2)) return null;
    let n2 = t2.displayName || t2.name || null;
    if (n2) return n2;
    let r2 = N(t2);
    return r2 && (r2.displayName || r2.name) || null;
  };
  var Ne = (e2) => {
    let t2 = h(e2.onActive);
    t2._instrumentationSource = e2.name ?? t;
    let n2 = t2.onCommitFiberRoot;
    if (e2.onCommitFiberRoot) {
      let r3 = (t3, i3, a2) => {
        n2 !== r3 && (n2?.(t3, i3, a2), e2.onCommitFiberRoot?.(t3, i3, a2));
      };
      t2.onCommitFiberRoot = r3;
    }
    let r2 = t2.onCommitFiberUnmount;
    if (e2.onCommitFiberUnmount) {
      let n3 = (i3, a2) => {
        t2.onCommitFiberUnmount === n3 && (r2?.(i3, a2), e2.onCommitFiberUnmount?.(i3, a2));
      };
      t2.onCommitFiberUnmount = n3;
    }
    let i2 = t2.onPostCommitFiberRoot;
    if (e2.onPostCommitFiberRoot) {
      let n3 = (r3, a2) => {
        t2.onPostCommitFiberRoot === n3 && (i2?.(r3, a2), e2.onPostCommitFiberRoot?.(r3, a2));
      };
      t2.onPostCommitFiberRoot = n3;
    }
    return t2;
  };
  var Z = Error();

  // src/extract.ts
  var fiberIds = /* @__PURE__ */ new WeakMap();
  var nextId = 1;
  function stableId(fiber) {
    const existing = fiberIds.get(fiber) ?? (fiber.alternate ? fiberIds.get(fiber.alternate) : void 0);
    if (existing) return existing;
    const id = String(nextId++);
    fiberIds.set(fiber, id);
    if (fiber.alternate) fiberIds.set(fiber.alternate, id);
    return id;
  }
  function cleanName(raw) {
    let name = raw.startsWith("bound ") ? raw.slice(6) : raw;
    if (name.includes("$")) {
      const segments = name.split("$").filter(Boolean);
      const last = segments[segments.length - 1] ?? name;
      name = /^[0-9a-f]{8,}$/.test(last) ? `anon-${last.slice(0, 4)}` : last;
    }
    return name;
  }
  function fiberName(fiber) {
    if (b(fiber)) return String(fiber.type);
    if (be(fiber)) {
      return cleanName(Ee(fiber.type) ?? "Anonymous");
    }
    return null;
  }
  function isServerInfo(value) {
    return typeof value === "object" && value !== null && typeof value.name === "string" && typeof value.tag !== "number";
  }
  var infoIds = /* @__PURE__ */ new WeakMap();
  function serverInfoId(info) {
    let id = infoIds.get(info);
    if (!id) {
      id = `s${nextId++}`;
      infoIds.set(info, id);
    }
    return id;
  }
  function ownerId(fiber) {
    const owner = fiber._debugOwner;
    if (!owner) return void 0;
    if (isServerInfo(owner)) return serverInfoId(owner);
    if (typeof owner.tag === "number") {
      return stableId(owner);
    }
    return void 0;
  }
  function debugInfoChain(fiber) {
    const info = fiber._debugInfo;
    if (!Array.isArray(info)) return [];
    return info.filter(isServerInfo);
  }
  function propNames(fiber) {
    const props = fiber.memoizedProps;
    if (!props || typeof props !== "object") return [];
    return Object.keys(props);
  }
  var CONTEXT_PROVIDER_TAG = 10;
  var CLASS_COMPONENT_TAG = 1;
  var SUSPENSE_TAG = 13;
  var OFFSCREEN_TAG = 22;
  var ACTIVITY_TAG = 31;
  var FRAGMENT_TAG = 7;
  var MODE_TAG = 8;
  var PROFILER_TAG = 12;
  var PORTAL_TAG = 4;
  function structuralName(fiber) {
    switch (fiber.tag) {
      case FRAGMENT_TAG:
        return "Fragment";
      case MODE_TAG:
        return "StrictMode";
      case PROFILER_TAG:
        return "Profiler";
      case PORTAL_TAG:
        return "createPortal";
      default:
        return null;
    }
  }
  function describePortalTarget(container) {
    const el = container;
    if (!el?.tagName) return "node";
    const tag = el.tagName.toLowerCase();
    return el.id ? `${tag}#${el.id}` : tag;
  }
  var REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition");
  var VIEW_TRANSITION_TAG = 30;
  function isViewTransitionFiber(fiber) {
    return fiber.elementType === REACT_VIEW_TRANSITION_TYPE || fiber.tag === VIEW_TRANSITION_TAG;
  }
  function isActivityFiber(fiber) {
    if (fiber.tag === ACTIVITY_TAG) return true;
    if (fiber.tag !== OFFSCREEN_TAG) return false;
    const parentTag = fiber.return?.tag;
    return parentTag !== SUSPENSE_TAG && parentTag !== ACTIVITY_TAG;
  }
  function isErrorBoundary(fiber) {
    if (fiber.tag !== CLASS_COMPONENT_TAG) return false;
    const t2 = fiber.type;
    return Boolean(t2?.getDerivedStateFromError ?? t2?.prototype?.componentDidCatch);
  }
  var REACT_MEMO_TYPE = Symbol.for("react.memo");
  var REACT_LAZY_TYPE = Symbol.for("react.lazy");
  function isLazyFiber(fiber) {
    const elementType = fiber.elementType;
    return elementType?.$$typeof === REACT_LAZY_TYPE;
  }
  function isMemoFiber(fiber) {
    const elementType = fiber.elementType;
    return elementType?.$$typeof === REACT_MEMO_TYPE;
  }
  function previewValue(value) {
    if (typeof value === "function")
      return `\u0192 ${value.name || "anonymous"}`;
    if (typeof value === "string")
      return JSON.stringify(
        value.length > 24 ? `${value.slice(0, 21)}\u2026` : value
      );
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (typeof value === "object" && value !== null) return "{\u2026}";
    return String(value);
  }
  function memoPropPreviews(fiber) {
    const props = fiber.memoizedProps;
    if (!props || typeof props !== "object") return [];
    return Object.entries(props).map(
      ([key, value]) => `${key}: ${previewValue(value)}`
    );
  }
  function stateHookCount(fiber) {
    if (!be(fiber)) return void 0;
    if (fiber.tag === CLASS_COMPONENT_TAG) {
      return fiber.memoizedState != null ? 1 : void 0;
    }
    let hook = fiber.memoizedState;
    let count = 0;
    let guard = 0;
    while (hook && typeof hook === "object" && guard++ < 1e3) {
      if (typeof hook.queue?.dispatch === "function") count++;
      hook = hook.next;
    }
    return count > 0 ? count : void 0;
  }
  var contextIds = /* @__PURE__ */ new WeakMap();
  function contextId(ctx) {
    let id = contextIds.get(ctx);
    if (!id) {
      id = `c${nextId++}`;
      contextIds.set(ctx, id);
    }
    return id;
  }
  var contextNames = /* @__PURE__ */ new Map();
  function contextName(id) {
    return contextNames.get(id);
  }
  function providerContext(fiber) {
    if (fiber.tag !== CONTEXT_PROVIDER_TAG) return null;
    const t2 = fiber.type;
    const ctx = t2?._context ?? t2;
    return ctx && typeof ctx === "object" ? ctx : null;
  }
  function consumedContexts(fiber) {
    let dep = fiber.dependencies?.firstContext;
    const out = [];
    while (dep) {
      out.push(contextId(dep.context));
      dep = dep.next;
    }
    return out.length > 0 ? out : void 0;
  }
  function collectChildren(fiber, out, serverRows) {
    let current = fiber;
    while (current) {
      const provided = providerContext(current);
      const providedName = provided && typeof provided.displayName === "string" ? provided.displayName : null;
      const suspense = current.tag === SUSPENSE_TAG;
      const activity = isActivityFiber(current);
      const viewTransition = isViewTransitionFiber(current);
      const structural = structuralName(current);
      const name = providedName ? `${providedName}.Provider` : suspense ? "Suspense" : activity ? "Activity" : viewTransition ? "ViewTransition" : structural ?? fiberName(current);
      if (name !== null) {
        const node = {
          name,
          id: stableId(current),
          owner: ownerId(current),
          dom: b(current) || void 0,
          props: propNames(current),
          contexts: consumedContexts(current),
          state: stateHookCount(current),
          children: []
        };
        if (provided && providedName) {
          node.contextProvider = contextId(provided);
          contextNames.set(node.contextProvider, providedName);
          const value = current.memoizedProps?.value;
          if (value !== void 0) node.contextValue = previewValue(value);
        }
        if (suspense) {
          node.suspense = true;
          if (current.memoizedState !== null) node.suspended = true;
        }
        if (activity) {
          node.activity = true;
          const mode = current.memoizedProps?.mode;
          if (mode === "hidden") node.hidden = true;
        }
        if (viewTransition) {
          node.viewTransition = true;
          const vtName = current.memoizedProps?.name;
          if (typeof vtName === "string" && vtName !== "auto")
            node.vtName = vtName;
        }
        if (structural) {
          node.structural = true;
          if (current.tag === FRAGMENT_TAG) node.props = [];
          if (current.tag === PROFILER_TAG) {
            node.profiler = true;
            const id = current.memoizedProps?.id;
            if (typeof id === "string") node.profilerId = id;
          }
          if (current.tag === PORTAL_TAG) {
            node.portal = true;
            node.portalTarget = describePortalTarget(
              current.stateNode?.containerInfo
            );
            node.props = [];
          }
        }
        if (isErrorBoundary(current)) node.errorBoundary = true;
        if (isMemoFiber(current)) {
          node.memo = true;
          node.memoProps = memoPropPreviews(current);
        }
        if (isLazyFiber(current)) node.lazy = true;
        const fiberOwner = current._debugOwner;
        if (be(current) && fiberOwner && isServerInfo(fiberOwner)) {
          node.boundary = true;
        }
        collectChildren(current.child, node.children, serverRows);
        if (node.children.length === 0) delete node.children;
        if (node.portal && !node.owner) node.owner = node.children?.[0]?.owner;
        let target = out;
        for (const info of debugInfoChain(current)) {
          let row = serverRows.get(info);
          if (!row) {
            const infoOwner = info.owner;
            row = {
              name: cleanName(info.name ?? "ServerComponent"),
              id: serverInfoId(info),
              owner: infoOwner && isServerInfo(infoOwner) ? serverInfoId(infoOwner) : void 0,
              server: true,
              props: [],
              children: []
            };
            serverRows.set(info, row);
            target.push(row);
          }
          target = row.children;
        }
        target.push(node);
      } else {
        collectChildren(current.child, out, serverRows);
      }
      current = current.sibling;
    }
  }
  function startExtraction(onTree) {
    let scheduled = false;
    const fiberRoots = /* @__PURE__ */ new Map();
    Ne({
      onCommitFiberRoot(_rendererId, root) {
        const container = root.containerInfo;
        if (container?.tagName?.startsWith("NEXTJS")) return;
        if (root.current.child) fiberRoots.set(root, root.current);
        else fiberRoots.delete(root);
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          const out = [];
          const serverRows = /* @__PURE__ */ new Map();
          for (const current of fiberRoots.values()) {
            collectChildren(current.child, out, serverRows);
          }
          onTree(out);
        });
      }
    });
  }

  // src/render-trees.ts
  var GRID = 25;
  var SERVER_COLOR = "#d9822b";
  var STATE_COLOR = "#d6336c";
  var MEMO_COLOR = "#5f3dc4";
  function svgWidth(maxDepth) {
    return maxDepth * GRID + 260;
  }
  var depth = 0;
  function setDepth(t2) {
    depth = t2;
  }
  var PLANE_DX = 60;
  var PLANE_DY = 12;
  function offX(node) {
    return node.server ? 0 : PLANE_DX * depth;
  }
  function offY(node) {
    return node.server ? 0 : PLANE_DY * depth;
  }
  function backSheetMarkup(rowCount, width) {
    if (depth < 0.02) return "";
    const left = -GRID / 2;
    const right = width - 1.5 * GRID;
    const top = -GRID / 2;
    const height = rowCount * GRID + GRID / 2;
    return `<rect x="${left}" y="${top}" width="${right - left}" height="${height}"
      rx="3" fill="${SERVER_COLOR}" fill-opacity="${(0.05 * depth).toFixed(3)}"
      stroke="${SERVER_COLOR}" stroke-opacity="${(0.3 * depth).toFixed(3)}" />
    <text x="${right - 6}" y="${top + 12}" text-anchor="end" font-size="10"
      font-style="italic" fill="${SERVER_COLOR}" opacity="${depth.toFixed(3)}">server &#183; early</text>`;
  }
  function frontSheetMarkup(rowCount, width) {
    if (depth < 0.02) return "";
    const left = -GRID / 2 + PLANE_DX * depth;
    const right = width - 1.5 * GRID + PLANE_DX * depth;
    const top = -GRID / 2 + PLANE_DY * depth;
    const height = rowCount * GRID + GRID / 2;
    return `<rect x="${left}" y="${top}" width="${right - left}" height="${height}"
      rx="3" fill="var(--color-bg)" fill-opacity="${(0.55 * depth).toFixed(3)}"
      stroke="#dcdcdc" stroke-opacity="${depth.toFixed(3)}" />
    <text x="${right - 6}" y="${top + 12}" text-anchor="end" font-size="10"
      font-style="italic" fill="var(--color-text-lighter)" opacity="${depth.toFixed(3)}">client &#183; late</text>`;
  }
  function ghostAndHop(ex, ey, rx, ry, child, faded) {
    const amber = Boolean(child.boundary);
    const color = amber ? SERVER_COLOR : "var(--color-text-lighter)";
    const [bx, by, fx, fy] = child.server ? [rx, ry, ex, ey] : [ex, ey, rx, ry];
    const dx = fx - bx;
    const dy = fy - by;
    const len = Math.hypot(dx, dy);
    const title = amber ? "Deferred reference in the server output &#8212; executed later, on the client" : "Server-rendered output, slotted into the client tree";
    const arrow = len > 16 ? `<path d="M${bx + dx / len * 5},${by + dy / len * 5} L${fx - dx / len * 8},${fy - dy / len * 8}"
          fill="none" stroke="${color}"${amber ? ` marker-end="url(#rt-hop-amber)"` : ` stroke-width="0.75" opacity="0.6"`} />` : "";
    const o2 = (faded ? FADE : 1) * depth;
    return `<g opacity="${o2.toFixed(3)}">
    <circle cx="${ex}" cy="${ey}" r="3" fill="none" stroke="${color}"
      stroke-dasharray="2 1.5"><title>${title}</title></circle>
    ${arrow}
  </g>`;
  }
  var CONTEXT_COLORS = ["#2f6fab", "#8f4bbf", "#2e8b57", "#c23b77", "#b8860b"];
  var contextColorMap = /* @__PURE__ */ new Map();
  function contextColor(id) {
    let color = contextColorMap.get(id);
    if (!color) {
      color = CONTEXT_COLORS[contextColorMap.size % CONTEXT_COLORS.length];
      contextColorMap.set(id, color);
    }
    return color;
  }
  var activeContexts = /* @__PURE__ */ new Set();
  function toggleContext(id) {
    if (activeContexts.has(id)) activeContexts.delete(id);
    else activeContexts.add(id);
  }
  function contextAreaMarkup(rows, width) {
    const areas = [];
    let slot = 0;
    for (const id of activeContexts) {
      const p3 = rows.findIndex((r2) => r2.node.contextProvider === id);
      if (p3 === -1) continue;
      const provider = rows[p3];
      let end = p3 + 1;
      while (end < rows.length && rows[end].depth > provider.depth) end++;
      const color = contextColor(id);
      const left = provider.x - GRID / 2;
      const right = width - 1.5 * GRID;
      const y = provider.y - GRID / 2;
      const height = (end - p3) * GRID;
      areas.push(`<rect x="${left}" y="${y}" width="${right - left}"
        height="${height}" rx="2" fill="${color}" fill-opacity="0.07"
        stroke="${color}" stroke-opacity="0.3">
        <title>All components within this area can consume ${contextName(id)}</title>
      </rect>
      <text x="${right - 6}" y="${y + height - 5}" text-anchor="end" font-size="10"
        font-style="italic" fill="${color}">${contextName(id)}</text>`);
      const valueX = right - 10 - slot * 14;
      slot++;
      const value = provider.node.contextValue;
      areas.push(
        `${value ? `<text x="${valueX}" y="${provider.y}" dy="-0.8em" text-anchor="middle"
          font-size="10" font-style="italic" fill="${color}">${escapeXml(value)}</text>` : ""}<circle cx="${valueX}" cy="${provider.y}" r="4" fill="${color}">
        <title>Current ${contextName(id)} value</title></circle>`
      );
      for (let i2 = p3 + 1; i2 < end; i2++) {
        if (!rows[i2].node.contexts?.includes(id)) continue;
        const nameEnd = rows[i2].x + 6 + rows[i2].node.name.length * 7.8 + 4;
        areas.push(`<path d="M${valueX},${provider.y} V${rows[i2].y} H${nameEnd}"
        fill="none" stroke="${color}" stroke-width="1" opacity="0.8">
        <title>${rows[i2].node.name} reads ${contextName(id)} here (useContext)</title></path>`);
      }
    }
    return areas.join("");
  }
  var ERROR_COLOR = "#c0392b";
  var SUSPENSE_COLOR = "#0e7490";
  var PROFILER_COLOR = "#64748b";
  var ACTIVITY_COLOR = "#15803d";
  var VIEW_TRANSITION_COLOR = "#a21caf";
  function boundaryColor(kind) {
    switch (kind) {
      case "error":
        return ERROR_COLOR;
      case "suspense":
        return SUSPENSE_COLOR;
      case "profiler":
        return PROFILER_COLOR;
      case "activity":
        return ACTIVITY_COLOR;
      case "viewtransition":
        return VIEW_TRANSITION_COLOR;
    }
  }
  var activeBoundaries = /* @__PURE__ */ new Set();
  function toggleBoundary(id) {
    if (activeBoundaries.has(id)) activeBoundaries.delete(id);
    else activeBoundaries.add(id);
  }
  var activeMemos = /* @__PURE__ */ new Set();
  function toggleMemo(id) {
    if (activeMemos.has(id)) activeMemos.delete(id);
    else activeMemos.add(id);
  }
  function escapeXml(s2) {
    return s2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function boundaryKind(node) {
    if (node.suspense) return "suspense";
    if (node.errorBoundary) return "error";
    if (node.profiler) return "profiler";
    if (node.activity) return "activity";
    if (node.viewTransition) return "viewtransition";
    return null;
  }
  function boundaryAreaMarkup(rows, width) {
    const areas = [];
    for (const id of activeBoundaries) {
      const p3 = rows.findIndex((r2) => r2.node.id === id);
      if (p3 === -1) continue;
      const boundary = rows[p3];
      const kind = boundaryKind(boundary.node);
      if (!kind) continue;
      const color = boundaryColor(kind);
      let end = p3 + 1;
      while (end < rows.length && rows[end].depth > boundary.depth) end++;
      const runs = [];
      if (kind === "profiler" || kind === "activity") {
        if (end > p3 + 1) runs.push([p3 + 1, end]);
      } else {
        let i2 = p3 + 1;
        let runStart = -1;
        while (i2 < end) {
          if (runStart === -1) runStart = i2;
          if (boundaryKind(rows[i2].node) === kind) {
            runs.push([runStart, i2 + 1]);
            runStart = -1;
            let j2 = i2 + 1;
            while (j2 < end && rows[j2].depth > rows[i2].depth) j2++;
            i2 = j2;
            continue;
          }
          i2++;
        }
        if (runStart !== -1) runs.push([runStart, end]);
      }
      const badge = boundary.node.profilerId ?? boundary.node.vtName;
      const displayName = boundary.node.name + (badge ? ` "${badge}"` : "");
      const mode = boundary.node.hidden ? "hidden" : "visible";
      const areaTitle = kind === "profiler" ? `${displayName} measures every render in this area` : kind === "activity" ? `${displayName} controls this subtree; currently ${mode}` : kind === "viewtransition" ? `${displayName} animates this subtree as one unit` : `${displayName} (${boundary.node.id}) is the closest ${kind} boundary here`;
      const tag = marks.ids ? ` (${boundary.node.id})` : "";
      const areaLabel = kind === "profiler" ? `measures: ${displayName}${tag}` : kind === "activity" ? `covers: ${displayName}${tag} &#183; ${mode}` : kind === "viewtransition" ? `animates: ${displayName}${tag}` : `catches: ${displayName}${tag}`;
      const right = width - 1.5 * GRID;
      runs.forEach(([start, stop2], runIndex) => {
        const left = Math.min(...rows.slice(start, stop2).map((r2) => r2.x)) - GRID / 2;
        const y = rows[start].y - GRID / 2;
        const height = (stop2 - start) * GRID;
        areas.push(`<rect x="${left}" y="${y}" width="${right - left}"
          height="${height}" rx="2" fill="${color}" fill-opacity="0.07"
          stroke="${color}" stroke-opacity="0.3">
          <title>${areaTitle}</title>
        </rect>${runIndex === 0 ? `<text x="${right - 6}" y="${y + 8}" text-anchor="end"
          font-size="10" font-style="italic" fill="${color}">${areaLabel}</text>` : ""}`);
      });
    }
    return areas.join("");
  }
  function serverRegionMarkup(rows, width) {
    const regions = [];
    let i2 = 0;
    while (i2 < rows.length) {
      if (!rows[i2].node.server) {
        i2++;
        continue;
      }
      let j2 = i2;
      while (j2 < rows.length && rows[j2].node.server) j2++;
      const run = rows.slice(i2, j2);
      const left = Math.min(...run.map((r2) => r2.x)) - GRID / 2;
      const right = width - 1.5 * GRID;
      const y = rows[i2].y - GRID / 2;
      const height = (j2 - i2) * GRID;
      regions.push(`<rect x="${left}" y="${y}" width="${right - left}"
        height="${height}" rx="2" fill="${SERVER_COLOR}" fill-opacity="0.08"
        stroke="${SERVER_COLOR}" stroke-opacity="0.25">
        <title>Rendered on the server</title>
      </rect>
      <text x="${right - 6}" y="${y + 8}" text-anchor="end"
        font-size="10" font-style="italic" fill="${SERVER_COLOR}">server</text>`);
      i2 = j2;
    }
    return regions.join("");
  }
  var selectedId = null;
  var FOCUS_UP = 2;
  var FOCUS_DOWN = 2;
  var FADE = 0.15;
  function computeFocus(roots, byId) {
    if (!selectedId || !byId.has(selectedId)) return null;
    const parentOf = /* @__PURE__ */ new Map();
    const childrenOf = /* @__PURE__ */ new Map();
    function walk(node) {
      const kids = node.children ?? [];
      childrenOf.set(
        node.id,
        kids.map((k2) => k2.id)
      );
      for (const kid of kids) {
        parentOf.set(kid.id, node.id);
        walk(kid);
      }
    }
    roots.forEach(walk);
    const keep = /* @__PURE__ */ new Set([selectedId]);
    let up = parentOf.get(selectedId);
    for (let i2 = 0; i2 < FOCUS_UP && up; i2++) {
      keep.add(up);
      up = parentOf.get(up);
    }
    let frontier = [selectedId];
    for (let i2 = 0; i2 < FOCUS_DOWN; i2++) {
      frontier = frontier.flatMap((id) => childrenOf.get(id) ?? []);
      frontier.forEach((id) => keep.add(id));
    }
    const owner = byId.get(selectedId).node.owner;
    if (owner && byId.has(owner)) keep.add(owner);
    for (const row of byId.values())
      if (row.node.owner === selectedId) keep.add(row.node.id);
    return { keep };
  }
  var unfoldedRuns = /* @__PURE__ */ new Set();
  function toggleFold(id) {
    if (unfoldedRuns.has(id)) unfoldedRuns.delete(id);
    else unfoldedRuns.add(id);
  }
  function foldRepeats(nodes, minRun = 4) {
    const out = [];
    let i2 = 0;
    while (i2 < nodes.length) {
      let j2 = i2;
      while (j2 < nodes.length && nodes[j2].name === nodes[i2].name) j2++;
      const run = j2 - i2;
      const foldChildren = (node) => {
        const kids = node.children;
        return { ...node, children: kids ? foldRepeats(kids, minRun) : void 0 };
      };
      if (run >= minRun && !unfoldedRuns.has(nodes[i2].id)) {
        out.push({ ...foldChildren(nodes[i2]), fold: run });
        i2 = j2;
      } else if (run >= minRun) {
        for (let k2 = i2; k2 < j2; k2++) {
          const member = foldChildren(nodes[k2]);
          if (k2 === i2) member.foldOpen = run;
          out.push(member);
        }
        i2 = j2;
      } else {
        out.push(foldChildren(nodes[i2]));
        i2++;
      }
    }
    return out;
  }
  function flatten(roots) {
    const rows = [];
    function visit(node, depth2, dim) {
      rows.push({ node, depth: depth2, y: rows.length * GRID, x: depth2 * GRID, dim });
      const childDim = dim || Boolean(node.activity && node.hidden);
      node.children?.forEach((child) => visit(child, depth2 + 1, childDim));
    }
    roots.forEach((root) => visit(root, 0, false));
    return rows;
  }
  function nodeMarkup(row, focus) {
    const { node, x: x2, y } = row;
    const selected = node.id === selectedId;
    const focusFaded = focus ? !focus.keep.has(node.id) : false;
    const opacity = Math.min(row.dim ? 0.25 : 1, focusFaded ? FADE : 1);
    const propCount = node.props?.length ?? 0;
    const title = propCount > 0 ? `<title>${node.props.join(", ")}</title>` : "";
    const fold = node.fold ? ` <tspan font-weight="bold" fill="var(--color-text)" data-fold-toggle="${node.id}"
         style="cursor:pointer" text-decoration="underline">\xD7${node.fold}</tspan>` : node.foldOpen ? ` <tspan font-weight="bold" fill="var(--color-text-lighter)" data-fold-toggle="${node.id}"
           style="cursor:pointer" text-decoration="underline">\u2212${node.foldOpen}</tspan>` : "";
    const boundary = node.boundary ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">'use client'</tspan>` : "";
    const kind = marks.markers ? boundaryKind(node) : null;
    const marker = !marks.markers ? null : node.contextProvider ? {
      color: contextColor(node.contextProvider),
      toggle: `data-context-toggle="${node.contextProvider}"`,
      active: activeContexts.has(node.contextProvider),
      hint: "Click to toggle this context's area"
    } : kind ? {
      color: boundaryColor(kind),
      toggle: `data-boundary-toggle="${node.id}"`,
      active: activeBoundaries.has(node.id),
      hint: kind === "profiler" ? "Click to show what this Profiler measures" : kind === "activity" ? "Click to show what this Activity controls" : kind === "viewtransition" ? "Click to show what this ViewTransition animates" : `Click to show where this ${kind} boundary is the closest one`
    } : null;
    const fill = marker ? marker.active ? marker.color : "var(--color-bg)" : node.server ? SERVER_COLOR : node.dom || node.structural ? "var(--color-bg)" : "var(--color-text)";
    const stroke = marker ? marker.color : node.structural ? "var(--color-text-lighter)" : node.dom ? "var(--color-text)" : "none";
    const nameMarkup = marker ? `<tspan ${marker.toggle} style="cursor:pointer"${node.structural ? ` font-style="italic"` : ""}
         fill="${marker.color}">${node.name}</tspan>` : node.structural ? `<tspan data-select-toggle="${node.id}" style="cursor:pointer"
           font-style="italic" fill="var(--color-text-lighter)">${node.name}</tspan>` : `<tspan data-select-toggle="${node.id}" style="cursor:pointer">${node.name}</tspan>`;
    const profilerId = node.profilerId && marks.markers ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">"${node.profilerId}"</tspan>` : "";
    const vtName = node.vtName && marks.markers ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">"${node.vtName}"</tspan>` : "";
    const suspended = node.suspended && marks.markers ? ` <tspan font-size="0.75em" font-style="italic" fill="${SUSPENSE_COLOR}">suspended</tspan>` : "";
    const portalTarget = node.portal ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">&#8594; ${escapeXml(node.portalTarget ?? "node")}</tspan>` : "";
    const lazyBadge = node.lazy ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">lazy</tspan>` : "";
    const activityMode = node.activity && marks.markers ? node.hidden ? ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text)">hidden</tspan>` : ` <tspan font-size="0.75em" font-style="italic" fill="var(--color-text-lighter)">visible</tspan>` : "";
    const markerTitle = marker ? `<title>${marker.hint}</title>` : "";
    const memo = node.memo && marks.memo;
    const memoRing = memo ? `<circle r="6.5" fill="${MEMO_COLOR}" fill-opacity="0.3" stroke="${MEMO_COLOR}"
        data-memo-toggle="${node.id}" style="cursor:pointer"><title>React.memo wraps this component &#8212; props are compared here. Click to show the retained props snapshot.</title></circle>` : "";
    const memoBadge = memo && activeMemos.has(node.id) && node.memoProps ? ` <tspan font-size="0.75em" fill="${MEMO_COLOR}">{ ${escapeXml(node.memoProps.join(", "))} }</tspan>` : "";
    const stateDots = node.state && marks.state ? `<g fill="${STATE_COLOR}"><title>${node.state} state hook${node.state > 1 ? "s" : ""} here</title>${Array.from(
      { length: Math.min(node.state, 3) },
      (_3, i2) => `<circle cy="${-(memo ? 9.5 : 7) - i2 * 5}" r="2" />`
    ).join("")}</g>` : "";
    return `<g transform="translate(${x2 + offX(node)},${y + offY(node)})"${opacity < 1 ? ` opacity="${opacity}"` : ""}>
    ${title}${markerTitle}
    <circle r="9" fill="transparent" data-select-toggle="${node.id}"
      style="cursor:pointer"><title>Click to focus this node's neighborhood</title></circle>
    ${selected ? `<circle r="${memo ? 8.5 : 6.5}" fill="none" stroke="var(--color-text)" stroke-opacity="0.6" />` : ""}
    ${memoRing}
    <circle r="3"
      fill="${fill}"
      stroke="${stroke}" />
    ${stateDots}
    <text dy="0.28em" x="6" fill="var(--color-text-light)">${nameMarkup}${portalTarget}${lazyBadge}${profilerId}${vtName}${fold}${boundary}${suspended}${activityMode}${memoBadge}${marks.ids ? ` <tspan font-size="0.8em" opacity="0.6">(${node.id})</tspan>` : ""}</text>
  </g>`;
  }
  function elbow(x1, y1, y2, faded = false) {
    return `<path d="M${x1},${y1} V${y2} h${GRID}" fill="none" stroke="var(--color-text)"${faded ? ` opacity="${FADE}"` : ""} />`;
  }
  var arcStyle = "arc";
  function setArcStyle(style) {
    arcStyle = style;
  }
  var marks = {
    arcs: true,
    ids: true,
    state: true,
    memo: true,
    markers: true
  };
  function setMarks(partial) {
    marks = { ...marks, ...partial };
  }
  var STADIUM_R = 36;
  var STADIUM_SPREAD = 10;
  var BRACKET_CAP = 14;
  var arcLeftExtent = 0;
  function arcPath(d3, accent) {
    return `<path d="${d3}"
    fill="none" stroke="${accent ? "var(--color-text)" : "var(--color-text-light)"}"${accent ? ' stroke-width="1.5"' : ""} stroke-dasharray="2" />`;
  }
  function ownerArcPath(o2, r2) {
    const ox = o2.x + offX(o2.node);
    const oy = o2.y + offY(o2.node);
    const rx = r2.x + offX(r2.node);
    const ry = r2.y + offY(r2.node);
    const d3 = Math.hypot(rx - ox, ry - oy);
    const trim = r2.node.memo && marks.memo && d3 > 20 ? 6.5 : 0;
    if (arcStyle === "square") {
      const lane = Math.min(ox, rx) - BRACKET_CAP;
      arcLeftExtent = Math.min(arcLeftExtent, lane);
      return `M${ox},${oy} H${lane} V${ry} H${rx - trim}`;
    }
    if (arcStyle === "bracket" && Math.abs(ry - oy) > 2 * BRACKET_CAP + 2) {
      const lane = Math.min(ox, rx) - BRACKET_CAP;
      arcLeftExtent = Math.min(arcLeftExtent, lane);
      const s2 = ry > oy ? 1 : -1;
      const sweep = s2 === 1 ? 0 : 1;
      const c2 = BRACKET_CAP;
      return `M${ox},${oy} H${lane + c2} A${c2},${c2} 0,0,${sweep} ${lane},${oy + s2 * c2} V${ry - s2 * c2} A${c2},${c2} 0,0,${sweep} ${lane + c2},${ry} H${rx - trim}`;
    }
    const half = d3 / 2;
    const ux = (rx - ox) / (d3 || 1);
    const uy = (ry - oy) / (d3 || 1);
    const vx = -uy;
    const vy = ux;
    if (arcStyle === "stadium" && half > STADIUM_R) {
      const R2 = STADIUM_R + STADIUM_SPREAD * Math.log(half / STADIUM_R);
      const p1x = ox + R2 * ux;
      const p1y = oy + R2 * uy;
      const p2x = rx - R2 * ux;
      const p2y = ry - R2 * uy;
      const a1x = p1x + R2 * vx;
      const a1y = p1y + R2 * vy;
      const a2x = p2x + R2 * vx;
      const a2y = p2y + R2 * vy;
      arcLeftExtent = Math.min(arcLeftExtent, ox, rx, p1x - R2, p2x - R2);
      let ex2 = rx;
      let ey2 = ry;
      if (trim) {
        const t2 = trim / R2;
        ex2 = p2x + R2 * (Math.cos(t2) * ux + Math.sin(t2) * vx);
        ey2 = p2y + R2 * (Math.cos(t2) * uy + Math.sin(t2) * vy);
      }
      return `M${ox},${oy} A${R2},${R2} 0,0,0 ${a1x},${a1y} L${a2x},${a2y} A${R2},${R2} 0,0,0 ${ex2},${ey2}`;
    }
    const cx = (ox + rx) / 2;
    const cy = (oy + ry) / 2;
    arcLeftExtent = Math.min(arcLeftExtent, ox, rx, cx - half);
    let ex = rx;
    let ey = ry;
    if (trim) {
      const t2 = trim / half;
      ex = cx + half * (Math.cos(t2) * ux + Math.sin(t2) * vx);
      ey = cy + half * (Math.cos(t2) * uy + Math.sin(t2) * vy);
    }
    return `M${ox},${oy} A${half},${half} 0,0,0 ${ex},${ey}`;
  }
  function ownerArc(o2, r2, accent) {
    return arcPath(ownerArcPath(o2, r2), accent);
  }
  function svgWrap(inner, rowCount, maxDepth) {
    const leftPad = Math.max(0, -arcLeftExtent) + (arcLeftExtent < 0 ? 4 : 0);
    const width = maxDepth * GRID + 260 + PLANE_DX * depth + leftPad;
    const height = rowCount * GRID + 25 + PLANE_DY * depth;
    const defs = `<defs>
    <marker id="rt-hop-amber" viewBox="0 0 8 8" refX="6" refY="4"
      markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="${SERVER_COLOR}" /></marker>
    <marker id="rt-hop-grey" viewBox="0 0 8 8" refX="6" refY="4"
      markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="var(--color-text-lighter)" /></marker>
  </defs>`;
    return `<svg width="${width}" height="${height}" viewBox="${-12.5 - leftPad},-12.5,${width},${height}" xmlns="http://www.w3.org/2000/svg">${defs}${inner}</svg>`;
  }
  function composeTree(roots, withArcs) {
    arcLeftExtent = 0;
    const rows = flatten(roots);
    const byId = new Map(rows.map((r2) => [r2.node.id, r2]));
    const focus = computeFocus(roots, byId);
    const maxDepth = Math.max(...rows.map((r2) => r2.depth), 0);
    const width = svgWidth(maxDepth);
    const backLinks = [];
    const frontLinks = [];
    const hops = [];
    function visitLinks(node) {
      const from = byId.get(node.id);
      node.children?.forEach((child) => {
        const to = byId.get(child.id);
        const faded = focus ? !(focus.keep.has(node.id) && focus.keep.has(child.id)) : false;
        const pox = offX(node);
        const poy = offY(node);
        (node.server ? backLinks : frontLinks).push(
          elbow(from.x + pox, from.y + poy, to.y + poy, faded)
        );
        if (Boolean(node.server) !== Boolean(child.server) && depth > 0.02) {
          hops.push(
            ghostAndHop(
              to.x + pox,
              to.y + poy,
              to.x + offX(child),
              to.y + offY(child),
              child,
              faded
            )
          );
        }
        visitLinks(child);
      });
    }
    roots.forEach(visitLinks);
    const arcs = withArcs && marks.arcs ? rows.filter((r2) => !r2.node.dom && r2.node.owner && byId.has(r2.node.owner)).map((r2) => {
      const o2 = byId.get(r2.node.owner);
      if (!focus) return ownerArc(o2, r2, false);
      if (r2.node.id === selectedId || o2.node.id === selectedId)
        return ownerArc(o2, r2, true);
      if (focus.keep.has(r2.node.id) && focus.keep.has(o2.node.id))
        return ownerArc(o2, r2, false);
      return `<g opacity="${FADE}">${ownerArc(o2, r2, false)}</g>`;
    }) : [];
    const flatAreas = serverRegionMarkup(rows, width) + (withArcs ? contextAreaMarkup(rows, width) + boundaryAreaMarkup(rows, width) : "");
    const backRows = rows.filter((r2) => r2.node.server);
    const frontRows = rows.filter((r2) => !r2.node.server);
    return svgWrap(
      (depth < 0.999 ? `<g opacity="${(1 - depth).toFixed(3)}">${flatAreas}</g>` : "") + backSheetMarkup(rows.length, width) + backLinks.join("") + backRows.map((r2) => nodeMarkup(r2, focus)).join("") + frontSheetMarkup(rows.length, width) + hops.join("") + // Owner arcs fade out with depth: in the split view the hops carry
      // the cross-world story and the arcs just tangle it.
      (depth < 0.999 ? depth > 1e-3 ? `<g opacity="${(1 - depth).toFixed(3)}">${arcs.join("")}</g>` : arcs.join("") : "") + frontLinks.join("") + frontRows.map((r2) => nodeMarkup(r2, focus)).join(""),
      rows.length,
      maxDepth
    );
  }
  function parentTreeSvg(unfoldedRoots) {
    return composeTree(foldRepeats(unfoldedRoots), true);
  }
  function ownerTreeSvg(roots) {
    const parentRows = flatten(roots);
    const ownerChildren = /* @__PURE__ */ new Map();
    const ownerRoots = [];
    const ids = new Set(parentRows.map((r2) => r2.node.id));
    for (const { node } of parentRows) {
      if (node.owner && ids.has(node.owner)) {
        const list = ownerChildren.get(node.owner) ?? [];
        list.push(node);
        ownerChildren.set(node.owner, list);
      } else {
        ownerRoots.push(node);
      }
    }
    const rebuilt = (function rebuild(nodes) {
      return nodes.map((node) => ({
        ...node,
        children: rebuild(ownerChildren.get(node.id) ?? [])
      }));
    })(ownerRoots);
    return composeTree(foldRepeats(rebuilt), false);
  }

  // src/auto.ts
  function appOnly(nodes) {
    const flat = [];
    (function walk(list) {
      for (const node of list) {
        flat.push(node);
        walk(node.children ?? []);
      }
    })(nodes);
    const kept = /* @__PURE__ */ new Set();
    for (const node of flat) if (node.server) kept.add(node.id);
    if (kept.size === 0) return nodes;
    let grew = true;
    while (grew) {
      grew = false;
      for (const node of flat) {
        if (!kept.has(node.id) && node.owner && kept.has(node.owner)) {
          kept.add(node.id);
          grew = true;
        }
      }
    }
    function prune(list) {
      const out = [];
      for (const node of list) {
        const kids = prune(node.children ?? []);
        if (kept.has(node.id)) {
          out.push({ ...node, children: kids.length > 0 ? kids : void 0 });
        } else {
          out.push(...kids);
        }
      }
      return out;
    }
    return prune(nodes);
  }
  function stripDom(nodes) {
    const out = [];
    for (const node of nodes) {
      const kids = stripDom(node.children ?? []);
      if (node.dom) {
        out.push(...kids);
      } else {
        out.push({ ...node, children: kids.length > 0 ? kids : void 0 });
      }
    }
    return out;
  }
  function createPanel() {
    const panel2 = document.createElement("aside");
    panel2.id = "react-trees-panel";
    panel2.style.cssText = [
      "--color-bg:#fdfdfd",
      "--color-text:#1a1a1a",
      "--color-text-light:#4a4a4a",
      "--color-text-lighter:#8a8a8a",
      "position:fixed",
      "top:0",
      "right:0",
      "bottom:0",
      "width:min(880px,70vw)",
      "z-index:2147483646",
      "background:var(--color-bg)",
      "color:var(--color-text)",
      "border-left:1px solid #e5e5e5",
      "box-shadow:-4px 0 16px rgba(0,0,0,0.06)",
      "font-family:monospace",
      "font-size:13px",
      "overflow:auto",
      "padding:12px 16px"
    ].join(";");
    panel2.innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;font-family:system-ui,sans-serif;font-size:12px;color:var(--color-text-lighter);position:sticky;top:0;left:0;background:var(--color-bg);padding-block:4px">
      <strong style="color:var(--color-text-light)">react-trees</strong>
      <label style="display:flex;gap:4px;align-items:center;cursor:pointer">
        <input type="checkbox" id="rt-show-dom" /> DOM nodes
      </label>
      <label style="display:flex;gap:4px;align-items:center;cursor:pointer">
        <input type="checkbox" id="rt-show-arcs" checked /> owner arcs
      </label>
      <label style="display:flex;gap:4px;align-items:center;cursor:pointer">
        <input type="checkbox" id="rt-app-only" checked /> app only
      </label>
      <button id="rt-depth" style="cursor:pointer">depth</button>
      <select id="rt-arc-style" style="cursor:pointer">
        <option value="arc">arc</option>
        <option value="stadium">stadium</option>
        <option value="bracket">bracket</option>
        <option value="square">square</option>
      </select>
      <button id="rt-hide" style="margin-left:auto;cursor:pointer">hide</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
      <div><h4 style="font-family:system-ui,sans-serif;font-weight:500;color:var(--color-text-lighter);margin:8px 0">Parent tree</h4><div id="rt-parent"></div></div>
      <div><h4 style="font-family:system-ui,sans-serif;font-weight:500;color:var(--color-text-lighter);margin:8px 0">Owner tree</h4><div id="rt-owner"></div></div>
    </div>`;
    const badge = document.createElement("button");
    badge.textContent = "trees";
    badge.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:2147483646;display:none;cursor:pointer;font-family:monospace";
    badge.addEventListener("click", () => {
      panel2.style.display = "block";
      badge.style.display = "none";
    });
    const attach = () => {
      document.body.append(panel2, badge);
      panel2.querySelector("#rt-hide").addEventListener("click", () => {
        panel2.style.display = "none";
        badge.style.display = "block";
      });
    };
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);
    return panel2;
  }
  var panel = createPanel();
  var latestRoots = [];
  function render() {
    const showDom = panel.querySelector("#rt-show-dom")?.checked;
    const scoped = panel.querySelector("#rt-app-only")?.checked;
    let roots = scoped ? appOnly(latestRoots) : latestRoots;
    if (!showDom) roots = stripDom(roots);
    panel.querySelector("#rt-parent").innerHTML = parentTreeSvg(roots);
    panel.querySelector("#rt-owner").innerHTML = ownerTreeSvg(roots);
  }
  panel.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "rt-arc-style")
      setArcStyle(target.value);
    if (target.id === "rt-show-arcs") setMarks({ arcs: target.checked });
    if (target.id === "rt-show-dom" || target.id === "rt-app-only" || target.id === "rt-arc-style" || target.id === "rt-show-arcs")
      render();
  });
  panel.addEventListener("click", (event) => {
    const target = event.target;
    const fold = target.closest?.("[data-fold-toggle]");
    const context = target.closest?.("[data-context-toggle]");
    const boundary = target.closest?.("[data-boundary-toggle]");
    const memoRing = target.closest?.("[data-memo-toggle]");
    if (fold) toggleFold(fold.getAttribute("data-fold-toggle"));
    if (context) toggleContext(context.getAttribute("data-context-toggle"));
    if (boundary) toggleBoundary(boundary.getAttribute("data-boundary-toggle"));
    if (memoRing) toggleMemo(memoRing.getAttribute("data-memo-toggle"));
    if (fold || context || boundary || memoRing) render();
  });
  var depthT = 0;
  var depthTarget = 0;
  var depthRaf = 0;
  var depthTick = () => {
    depthT += (depthTarget - depthT) * 0.15;
    if (Math.abs(depthTarget - depthT) < 4e-3) {
      depthT = depthTarget;
      depthRaf = 0;
    } else {
      depthRaf = requestAnimationFrame(depthTick);
    }
    setDepth(depthT);
    render();
  };
  panel.querySelector("#rt-depth").addEventListener("click", (event) => {
    depthTarget = depthTarget === 0 ? 1 : 0;
    event.target.textContent = depthTarget === 1 ? "flat" : "depth";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      depthT = depthTarget;
      setDepth(depthT);
      render();
    } else if (!depthRaf) {
      depthRaf = requestAnimationFrame(depthTick);
    }
  });
  startExtraction((roots) => {
    latestRoots = roots;
    render();
  });
})();
/*! Bundled license information:

bippy/dist/rdt-hook.js:
bippy/dist/install-hook-only.js:
bippy/dist/core.js:
bippy/dist/index.js:
  (**
   * @license bippy
   *
   * Copyright (c) Aiden Bai
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
