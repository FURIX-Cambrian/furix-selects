/* ============================================================
   FURIX SELECTS — core utilities
   Local catalog, filtering, XMP and ZIP helpers.
   ============================================================ */

(function (global) {
  "use strict";

  const F = (global.Furix = global.Furix || {});

  const PREVIEW_EXTS = new Set([
    "jpg", "jpeg", "jpe", "jfif", "png", "webp", "avif", "gif", "bmp", "svg", "ico"
  ]);

  const RAW_EXTS = new Set([
    "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "dng", "raf", "orf",
    "rw2", "pef", "srw", "3fr", "erf", "mef", "mos", "x3f", "raw", "ari", "bay",
    "dcr", "kdc", "mrw", "pxn", "rwl", "iiq", "cap", "gpr"
  ]);

  const OPAQUE_EXTS = new Set([
    ...RAW_EXTS, "heic", "heif", "tif", "tiff", "jxl"
  ]);

  const IMAGE_EXTS = new Set([...PREVIEW_EXTS, ...OPAQUE_EXTS]);
  const COLORS = ["red", "yellow", "green", "blue", "purple"];
  const COLOR_LABELS = {
    red: "红色",
    yellow: "黄色",
    green: "绿色",
    blue: "蓝色",
    purple: "紫色"
  };
  const COLOR_XMP = {
    red: "Red",
    yellow: "Yellow",
    green: "Green",
    blue: "Blue",
    purple: "Purple"
  };
  const FLAG_LABELS = {
    pick: "留用",
    reject: "淘汰",
    none: "待定"
  };

  const collator = new Intl.Collator("zh-Hans-CN", {
    numeric: true,
    sensitivity: "base"
  });

  const pad2 = (n) => String(n).padStart(2, "0");

  function extOf(name) {
    const i = String(name).lastIndexOf(".");
    return i > -1 ? String(name).slice(i + 1).toLowerCase() : "";
  }

  function baseName(name) {
    const str = String(name);
    const i = str.lastIndexOf(".");
    return i > 0 ? str.slice(0, i) : str;
  }

  function isImageName(name) {
    return IMAGE_EXTS.has(extOf(name));
  }

  function canPreviewExt(ext) {
    return PREVIEW_EXTS.has(String(ext).toLowerCase());
  }

  function isRawExt(ext) {
    return RAW_EXTS.has(String(ext).toLowerCase());
  }

  function isOpaqueExt(ext) {
    return OPAQUE_EXTS.has(String(ext).toLowerCase());
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }

  function formatDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      d.getFullYear() +
      "-" + pad2(d.getMonth() + 1) +
      "-" + pad2(d.getDate()) +
      " " + pad2(d.getHours()) +
      ":" + pad2(d.getMinutes())
    );
  }

  function formatDateShort(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function timestampForFile(date) {
    const d = date || new Date();
    return (
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      "_" +
      pad2(d.getHours()) +
      pad2(d.getMinutes())
    );
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function debounce(fn, wait) {
    let timer = 0;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeFileName(name, fallback) {
    const cleaned = String(name || "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 120);
    return cleaned || fallback || "untitled";
  }

  function normalizeZipPath(name) {
    return String(name)
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .split("/")
      .filter((part) => part && part !== "." && part !== "..")
      .join("/");
  }

  function colorLabel(color) {
    return color ? COLOR_LABELS[color] || color : "";
  }

  function flagLabel(flag) {
    return FLAG_LABELS[flag || "none"];
  }

  const FOCAL_RANGES = {
    f24: [0, 24.999],
    f35: [25, 35.999],
    f70: [36, 70.999],
    f135: [71, 135.999],
    f300: [136, 300.999],
    f301: [301, 99999]
  };

  const APERTURE_RANGES = {
    a2: [0, 2],
    a28: [2.001, 2.8],
    a4: [2.801, 4],
    a56: [4.001, 5.6],
    a8: [5.601, 8],
    a8p: [8.001, 999]
  };

  /* ---------------- EXIF ---------------- */

  function parseExif(input) {
    let bytes = null;
    if (input instanceof Uint8Array) bytes = input;
    else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    if (!bytes || bytes.length < 12) return null;

    let best = null;
    const limit = bytes.length - 8;
    for (let i = 0; i <= limit; i += 1) {
      const little =
        bytes[i] === 0x49 &&
        bytes[i + 1] === 0x49 &&
        bytes[i + 2] === 0x2a &&
        bytes[i + 3] === 0x00;
      const big =
        bytes[i] === 0x4d &&
        bytes[i + 1] === 0x4d &&
        bytes[i + 2] === 0x00 &&
        bytes[i + 3] === 0x2a;
      if (!little && !big) continue;
      const candidate = parseTiffExif(bytes, i);
      if (candidate && candidate.score > 0) {
        if (!best || candidate.score > best.score) best = candidate;
      }
      i += 3;
    }
    if (!best) return null;
    delete best.score;
    return best;
  }

  function parseTiffExif(bytes, base) {
    const little = bytes[base] === 0x49;
    const len = bytes.length;

    function u16(offset) {
      if (offset < 0 || offset + 2 > len) return null;
      return little
        ? bytes[offset] | (bytes[offset + 1] << 8)
        : (bytes[offset] << 8) | bytes[offset + 1];
    }
    function u32(offset) {
      if (offset < 0 || offset + 4 > len) return null;
      return little
        ? (bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24)) >>>
            0
        : ((bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3]) >>>
            0;
    }
    function s32(offset) {
      const value = u32(offset);
      if (value == null) return null;
      return value > 0x7fffffff ? value - 0x100000000 : value;
    }

    if (u16(base + 2) !== 42) return null;
    const ifd0 = u32(base + 4);
    if (ifd0 == null || ifd0 < 8) return null;
    if (base + ifd0 + 2 > len) return null;

    const data = {};
    let score = 0;
    let exifPointer = 0;
    const typeSizes = {
      1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8,
      11: 4, 12: 8
    };

    function readValue(entryOffset, type, count) {
      const unit = typeSizes[type];
      if (!unit || !count || count > 100000) return null;
      const total = unit * count;
      if (total > 262144) return null;
      let valuePos;
      if (total <= 4) {
        valuePos = entryOffset + 8;
      } else {
        const offset = u32(entryOffset + 8);
        if (offset == null) return null;
        valuePos = base + offset;
      }
      if (valuePos < 0 || valuePos + total > len) return null;

      if (type === 2) {
        let end = valuePos;
        while (end < valuePos + total && bytes[end] !== 0) end += 1;
        let out = "";
        for (let i = valuePos; i < end; i += 1) {
          out += String.fromCharCode(bytes[i]);
        }
        return out.trim();
      }
      if (type === 1 || type === 7) {
        return bytes[valuePos];
      }
      if (type === 3) {
        if (count === 1) return u16(valuePos);
        const out = [];
        for (let i = 0; i < count; i += 1) out.push(u16(valuePos + i * 2));
        return out;
      }
      if (type === 8) {
        const value = u16(valuePos);
        return value > 0x7fff ? value - 0x10000 : value;
      }
      if (type === 4) {
        if (count === 1) return u32(valuePos);
        const out = [];
        for (let i = 0; i < count; i += 1) out.push(u32(valuePos + i * 4));
        return out;
      }
      if (type === 9) {
        return s32(valuePos);
      }
      if (type === 5 || type === 10) {
        const n = type === 5 ? u32(valuePos) : s32(valuePos);
        const d = type === 5 ? u32(valuePos + 4) : s32(valuePos + 4);
        if (n == null || d == null || d === 0) return null;
        return n / d;
      }
      return null;
    }

    function parseDate(value) {
      if (typeof value !== "string") return null;
      const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
      if (!m) return null;
      const date = new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6])
      );
      if (Number.isNaN(date.getTime())) return null;
      return {
        ts: date.getTime(),
        text:
          m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + m[6]
      };
    }

    function handleTag(tag, value) {
      if (value == null) return;
      switch (tag) {
        case 0x010f:
          if (typeof value === "string" && value) {
            data.make = value;
            score += 1;
          }
          break;
        case 0x0110:
          if (typeof value === "string" && value) {
            data.model = value;
            score += 1;
          }
          break;
        case 0x9003:
        case 0x0132: {
          const parsed = parseDate(value);
          if (parsed) {
            if (!data.takenAt) {
              data.takenAt = parsed.ts;
              data.takenAtText = parsed.text;
              score += 1;
            }
          }
          break;
        }
        case 0x829a:
          if (typeof value === "number" && value > 0) {
            data.exposure = value;
            score += 1;
          }
          break;
        case 0x9201:
          if (data.exposure == null && typeof value === "number" && value > 0) {
            data.exposure = Math.pow(2, -value);
            score += 1;
          }
          break;
        case 0x829d:
          if (typeof value === "number" && value > 0) {
            data.aperture = value;
            score += 1;
          }
          break;
        case 0x9202:
          if (data.aperture == null && typeof value === "number" && value > 0) {
            data.aperture = Math.pow(2, value / 2);
            score += 1;
          }
          break;
        case 0x9205:
          if (data.aperture == null && typeof value === "number" && value > 0) {
            data.aperture = Math.pow(2, value / 2);
            score += 1;
          }
          break;
        case 0x8827:
          if (typeof value === "number" && value > 0) {
            data.iso = Math.round(value);
            score += 1;
          }
          break;
        case 0x8833:
          if (data.iso == null && typeof value === "number" && value > 0) {
            data.iso = Math.round(value);
            score += 1;
          }
          break;
        case 0x920a:
          if (typeof value === "number" && value > 0) {
            data.focal = value;
            score += 1;
          }
          break;
        case 0xa405:
          if (typeof value === "number" && value > 0) {
            data.focal35 = value;
            score += 1;
          }
          break;
        case 0xa434:
          if (typeof value === "string" && value) {
            data.lens = value;
            score += 1;
          }
          break;
        case 0xa433:
          if (typeof value === "string" && value) {
            data.lensMake = value;
            score += 1;
          }
          break;
        case 0x8769:
          if (typeof value === "number" && value > 0) {
            exifPointer = value;
          }
          break;
        default:
          break;
      }
    }

    function readIfd(offset, depth) {
      if (depth > 2 || !offset) return;
      const abs = base + offset;
      if (abs + 2 > len) return;
      const count = u16(abs);
      if (!count || count > 512) return;
      if (abs + 2 + count * 12 > len) return;
      for (let i = 0; i < count; i += 1) {
        const entry = abs + 2 + i * 12;
        const tag = u16(entry);
        const type = u16(entry + 2);
        const n = u32(entry + 4);
        if (tag == null || type == null || n == null) continue;
        handleTag(tag, readValue(entry, type, n));
      }
    }

    readIfd(ifd0, 0);
    if (exifPointer) readIfd(exifPointer, 1);
    if (!score) return null;

    const clean = (value) =>
      typeof value === "string" ? value.replace(/\0+$/g, "").trim() : "";
    const make = clean(data.make);
    const model = clean(data.model);
    const normalMake = make
      .replace(/\s+(CORPORATION|CO\.?,?\s*LTD\.?|INC\.?)$/i, "")
      .trim();
    if (model && normalMake) {
      data.camera = model.toLowerCase().startsWith(normalMake.toLowerCase())
        ? model
        : normalMake + " " + model;
    } else {
      data.camera = model || normalMake;
    }
    if (!data.camera) delete data.camera;
    if (data.lens) data.lens = clean(data.lens);
    return { ...data, score };
  }

  /* ---------------- filtering & sorting ---------------- */

  function normalizeFilter(filter) {
    const f = filter || {};
    const flag = ["all", "pick", "none", "reject"].includes(f.flag) ? f.flag : "all";
    const colors =
      f.colors instanceof Set ? f.colors : new Set(Array.isArray(f.colors) ? f.colors : []);
    return {
      flag,
      minRating: clamp(Number(f.minRating) || 0, 0, 5),
      colors,
      query: String(f.query || "").trim().toLowerCase(),
      camera: String(f.camera || "all"),
      lens: String(f.lens || "all"),
      focal: String(f.focal || "all"),
      aperture: String(f.aperture || "all")
    };
  }

  function matchesFilter(photo, filter, getMeta) {
    const f = normalizeFilter(filter);
    const meta = getMeta ? getMeta(photo) : photo.meta || {};
    const exif = photo.exif || null;
    if (f.flag === "pick" && meta.flag !== "pick") return false;
    if (f.flag === "reject" && meta.flag !== "reject") return false;
    if (f.flag === "none" && meta.flag) return false;
    if (f.minRating > 0 && (Number(meta.rating) || 0) < f.minRating) return false;
    if (f.colors.size > 0 && !f.colors.has(meta.color)) return false;
    if (f.query && !String(photo.name).toLowerCase().includes(f.query)) return false;
    if (f.camera !== "all") {
      if (f.camera === "unknown") {
        if (exif && exif.camera) return false;
      } else if (!exif || exif.camera !== f.camera) {
        return false;
      }
    }
    if (f.lens !== "all") {
      if (f.lens === "unknown") {
        if (exif && exif.lens) return false;
      } else if (!exif || exif.lens !== f.lens) {
        return false;
      }
    }
    if (f.focal !== "all") {
      if (f.focal === "unknown") {
        if (exif && exif.focal) return false;
      } else {
        const range = FOCAL_RANGES[f.focal];
        if (!range || !exif || !Number.isFinite(exif.focal)) return false;
        if (exif.focal < range[0] || exif.focal > range[1]) return false;
      }
    }
    if (f.aperture !== "all") {
      if (f.aperture === "unknown") {
        if (exif && exif.aperture) return false;
      } else {
        const range = APERTURE_RANGES[f.aperture];
        if (!range || !exif || !Number.isFinite(exif.aperture)) return false;
        if (exif.aperture < range[0] || exif.aperture > range[1]) return false;
      }
    }
    return true;
  }

  function sortPhotos(photos, sort, getMeta) {
    const list = photos.slice();
    const meta = getMeta || ((p) => p.meta || {});
    const nameCmp = (a, b) => collator.compare(a.name, b.name) || collator.compare(a.id, b.id);
    const numeric = (getter, direction) => {
      list.sort((a, b) => {
        const av = getter(a);
        const bv = getter(b);
        const aMissing = av == null || !Number.isFinite(av);
        const bMissing = bv == null || !Number.isFinite(bv);
        if (aMissing && bMissing) return nameCmp(a, b);
        if (aMissing) return 1;
        if (bMissing) return -1;
        return (av - bv) * direction || nameCmp(a, b);
      });
    };
    switch (sort) {
      case "name-desc":
        list.sort((a, b) => -nameCmp(a, b));
        break;
      case "date-desc":
        list.sort((a, b) => (b.mtime || 0) - (a.mtime || 0) || nameCmp(a, b));
        break;
      case "date-asc":
        list.sort((a, b) => (a.mtime || 0) - (b.mtime || 0) || nameCmp(a, b));
        break;
      case "taken-desc":
        numeric((p) => (p.exif ? p.exif.takenAt : null), -1);
        break;
      case "taken-asc":
        numeric((p) => (p.exif ? p.exif.takenAt : null), 1);
        break;
      case "focal-asc":
        numeric((p) => (p.exif ? p.exif.focal : null), 1);
        break;
      case "focal-desc":
        numeric((p) => (p.exif ? p.exif.focal : null), -1);
        break;
      case "aperture-asc":
        numeric((p) => (p.exif ? p.exif.aperture : null), 1);
        break;
      case "aperture-desc":
        numeric((p) => (p.exif ? p.exif.aperture : null), -1);
        break;
      case "rating-desc":
        list.sort(
          (a, b) =>
            (Number(meta(b).rating) || 0) - (Number(meta(a).rating) || 0) ||
            nameCmp(a, b)
        );
        break;
      case "size-desc":
        list.sort((a, b) => (b.size || 0) - (a.size || 0) || nameCmp(a, b));
        break;
      case "name-asc":
      default:
        list.sort(nameCmp);
        break;
    }
    return list;
  }

  /* ---------------- catalog persistence ---------------- */

  const STORAGE_PREFIX = "furix.catalog.v2:";
  const CATALOG_FILE = ".furix-catalog.json";
  const PROJECT_FILE = ".furix-project.json";

  function storageKey(rootName) {
    return STORAGE_PREFIX + String(rootName || "library").toLowerCase();
  }

  function normalizeRotation(value) {
    const n = Number(value) || 0;
    const r = (((Math.round(n / 90) * 90) % 360) + 360) % 360;
    return r === 90 || r === 180 || r === 270 ? r : 0;
  }

  function normalizeRecord(input) {
    if (!input || typeof input !== "object") return null;
    const rec = {
      flag: input.flag === "pick" || input.flag === "reject" ? input.flag : null,
      rating: clamp(Math.round(Number(input.rating) || 0), 0, 5),
      color: COLORS.includes(input.color) ? input.color : null,
      rotation: normalizeRotation(input.rotation),
      mirror: !!input.mirror,
      updatedAt: Number(input.updatedAt) || 0
    };
    return rec;
  }

  function isEmptyRecord(rec) {
    return (
      !rec ||
      (!rec.flag && !rec.rating && !rec.color && !rec.rotation && !rec.mirror)
    );
  }

  function normalizeMarks(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    const source = raw.marks && typeof raw.marks === "object" ? raw.marks : raw;
    for (const [key, value] of Object.entries(source)) {
      const rec = normalizeRecord(value);
      if (!rec) continue;
      // Keep touched-but-cleared records as tombstones so a newer empty
      // mark can override an older flag/rating coming from another catalog.
      if (!isEmptyRecord(rec) || rec.updatedAt > 0) out[key] = rec;
    }
    return out;
  }

  function mergeMarks(...sources) {
    const out = {};
    for (const source of sources) {
      if (!source) continue;
      const marks = source.marks && typeof source.marks === "object" ? source.marks : source;
      for (const [key, value] of Object.entries(marks)) {
        const rec = normalizeRecord(value);
        if (!rec) continue;
        const current = out[key];
        if (!current || rec.updatedAt >= (current.updatedAt || 0)) {
          out[key] = rec;
        }
      }
    }
    return out;
  }

  function readLocalCatalog(rootName) {
    try {
      const raw = global.localStorage.getItem(storageKey(rootName));
      if (!raw) return { marks: {}, updatedAt: 0 };
      const parsed = JSON.parse(raw);
      return {
        marks: normalizeMarks(parsed),
        updatedAt: Number(parsed && parsed.updatedAt) || 0
      };
    } catch (err) {
      return { marks: {}, updatedAt: 0 };
    }
  }

  function writeLocalCatalog(rootName, marks, updatedAt) {
    try {
      const payload = {
        app: "FURIX Selects",
        version: 1,
        folder: rootName,
        updatedAt: updatedAt || Date.now(),
        marks
      };
      global.localStorage.setItem(storageKey(rootName), JSON.stringify(payload));
      return true;
    } catch (err) {
      return false;
    }
  }

  async function readFolderCatalog(dirHandle) {
    if (!dirHandle) return null;
    try {
      const handle = await dirHandle.getFileHandle(CATALOG_FILE);
      const file = await handle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      return { marks: normalizeMarks(parsed), updatedAt: Number(parsed.updatedAt) || 0 };
    } catch (err) {
      return null;
    }
  }

  async function writeFolderCatalog(dirHandle, rootName, marks) {
    if (!dirHandle) throw new Error("没有可写入的文件夹");
    const payload = {
      app: "FURIX Selects",
      version: 1,
      folder: rootName,
      updatedAt: Date.now(),
      marks
    };
    const handle = await dirHandle.getFileHandle(CATALOG_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return true;
  }

  async function readProjectFile(dirHandle) {
    if (!dirHandle) return null;
    try {
      const handle = await dirHandle.getFileHandle(PROJECT_FILE);
      const file = await handle.getFile();
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.type !== "furix-project") return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  async function writeProjectFile(dirHandle, payload) {
    if (!dirHandle) throw new Error("没有可写入的项目文件夹");
    const handle = await dirHandle.getFileHandle(PROJECT_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return true;
  }

  /* ---------------- XMP ---------------- */

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function buildXmp(photo, meta) {
    const m = meta || {};
    const rating = clamp(Math.round(Number(m.rating) || 0), 0, 5);
    const label = m.color ? COLOR_XMP[m.color] || "" : "";
    const flag = m.flag === "pick" ? "pick" : m.flag === "reject" ? "reject" : "none";
    const now = new Date().toISOString();
    return [
      '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
      ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
      '  <rdf:Description rdf:about=""',
      '    xmlns:xmp="http://ns.adobe.com/xap/1.0/"',
      '    xmlns:dc="http://purl.org/dc/elements/1.1/"',
      '    xmlns:furix="https://furix.local/ns/selects/1.0/">',
      "   <xmp:Rating>" + rating + "</xmp:Rating>",
      "   <xmp:Label>" + xmlEscape(label) + "</xmp:Label>",
      "   <xmp:MetadataDate>" + now + "</xmp:MetadataDate>",
      "   <dc:title><rdf:Alt><rdf:li xml:lang=\"x-default\">" +
        xmlEscape(baseName(photo.name)) +
        "</rdf:li></rdf:Alt></dc:title>",
      "   <furix:Flag>" + flag + "</furix:Flag>",
      "   <furix:Source>" + xmlEscape(photo.relPath || photo.name) + "</furix:Source>",
      "   <tiff:Orientation xmlns:tiff=\"http://ns.adobe.com/tiff/1.0/\">" +
        (normalizeRotation(m.rotation) === 90
          ? 6
          : normalizeRotation(m.rotation) === 180
          ? 3
          : normalizeRotation(m.rotation) === 270
          ? 8
          : 1) +
        "</tiff:Orientation>",
      "  </rdf:Description>",
      " </rdf:RDF>",
      "</x:xmpmeta>",
      '<?xpacket end="w"?>'
    ].join("\n");
  }

  /* ---------------- embedded RAW preview ---------------- */

  function parseJpegCandidate(data, start) {
    const length = data.length;
    let pos = start + 2;
    let width = 0;
    let height = 0;
    let sawFrame = false;
    let guard = 0;

    while (pos < length - 1 && guard < 1024) {
      guard += 1;
      if (data[pos] !== 0xff) return null;
      while (pos < length && data[pos] === 0xff) pos += 1;
      if (pos >= length) return null;
      const marker = data[pos];
      pos += 1;

      if (marker === 0xd9 || marker === 0xd8) return null;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 2 > length) return null;

      const segmentLength = (data[pos] << 8) | data[pos + 1];
      if (segmentLength < 2 || pos + segmentLength > length) return null;

      const isFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isFrame && segmentLength >= 7) {
        height = (data[pos + 3] << 8) | data[pos + 4];
        width = (data[pos + 5] << 8) | data[pos + 6];
        sawFrame = true;
      }

      if (marker === 0xda) {
        if (!sawFrame) return null;
        let end = pos + segmentLength;
        while (end < length - 1) {
          if (data[end] === 0xff && data[end + 1] === 0xd9) {
            const finish = end + 2;
            const bytes = finish - start;
            if (
              width >= 32 &&
              height >= 32 &&
              width <= 30000 &&
              height <= 30000 &&
              bytes >= 2048
            ) {
              return { start, end: finish, width, height, bytes };
            }
            return null;
          }
          end += 1;
        }
        return null;
      }

      pos += segmentLength;
    }
    return null;
  }

  async function extractEmbeddedJpeg(file, options) {
    const opts = options || {};
    const maxBytes = Number(opts.maxBytes) || 512 * 1024 * 1024;
    if (!file || !file.size) throw new Error("RAW 文件为空");
    if (file.size > maxBytes) {
      throw new Error("RAW 文件超过预览提取上限");
    }

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    const length = data.length;
    const minArea = Number(opts.minArea) || 10000;
    const candidates = [];
    let i = 0;

    while (i < length - 3) {
      if (data[i] === 0xff && data[i + 1] === 0xd8 && data[i + 2] === 0xff) {
        const candidate = parseJpegCandidate(data, i);
        if (candidate) {
          if (candidate.width * candidate.height >= minArea) {
            candidates.push(candidate);
          }
          i = Math.max(i + 3, candidate.end - 2);
          continue;
        }
      }
      i += 1;
    }

    if (!candidates.length) {
      throw new Error("这张 RAW 中没有找到可用的 JPEG 预览");
    }

    candidates.sort((a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      return areaB - areaA || b.bytes - a.bytes;
    });
    const best = candidates[0];
    return {
      blob: file.slice(best.start, best.end, "image/jpeg"),
      start: best.start,
      end: best.end,
      width: best.width,
      height: best.height,
      bytes: best.bytes,
      offset: best.start
    };
  }

  /* ---------------- download ---------------- */

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* ---------------- ZIP (store, no compression) ---------------- */

  let CRC_TABLE = null;
  function getCrcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    CRC_TABLE = table;
    return table;
  }

  function crc32Update(crc, bytes) {
    const table = getCrcTable();
    let c = crc;
    for (let i = 0; i < bytes.length; i++) {
      c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return c >>> 0;
  }

  async function crcOfBlob(blob) {
    let crc = 0xffffffff;
    if (blob.stream) {
      const reader = blob.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length) crc = crc32Update(crc, value);
      }
    } else {
      const buffer = new Uint8Array(await blob.arrayBuffer());
      crc = crc32Update(crc, buffer);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const d = date || new Date();
    const time =
      ((d.getHours() & 0x1f) << 11) |
      ((d.getMinutes() & 0x3f) << 5) |
      (Math.floor(d.getSeconds() / 2) & 0x1f);
    const day =
      (((d.getFullYear() - 1980) & 0x7f) << 9) |
      (((d.getMonth() + 1) & 0x0f) << 5) |
      (d.getDate() & 0x1f);
    return { time, day };
  }

  async function zipStore(entries, onProgress) {
    if (!entries || !entries.length) throw new Error("没有可打包的文件");
    if (entries.length > 65535) throw new Error("文件数量超过 ZIP 上限（65535）");

    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    let centralSize = 0;
    const now = new Date();
    const stamp = dosDateTime(now);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const name = normalizeZipPath(entry.name);
      if (!name) continue;
      const blob = entry.blob instanceof Blob ? entry.blob : new Blob([entry.blob || ""]);
      const nameBytes = encoder.encode(name);
      const crc = await crcOfBlob(blob);
      const size = blob.size;

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.day, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      localParts.push(local, blob);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.day, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);
      centralSize += central.length;

      offset += local.length + size;
      if (onProgress) onProgress((i + 1) / entries.length, i + 1, entries.length);
    }

    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const all = localParts.concat(centralParts, [end]);
    return new Blob(all, { type: "application/zip" });
  }

  /* ---------------- canvas conversion ---------------- */

  async function bitmapFromFile(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (err) {
      return await createImageBitmap(file);
    }
  }

  async function convertImage(file, format, maxEdge, quality, options) {
    const opts = options || {};
    const bitmap = await bitmapFromFile(file);
    try {
      let width = bitmap.width;
      let height = bitmap.height;
      const limit = Number(maxEdge) || 0;
      if (limit > 0 && Math.max(width, height) > limit) {
        const scale = limit / Math.max(width, height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      const rotation = normalizeRotation(opts.rotation);
      const swap = rotation === 90 || rotation === 270;
      const canvas = document.createElement("canvas");
      canvas.width = swap ? height : width;
      canvas.height = swap ? width : height;
      const ctx = canvas.getContext("2d", { alpha: format === "webp" });
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      drawOriented(ctx, bitmap, width, height, rotation, !!opts.mirror);
      const type = format === "webp" ? "image/webp" : "image/jpeg";
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, type, clamp(Number(quality) || 92, 40, 100) / 100);
      });
      if (!blob) throw new Error("图像转换失败");
      return { blob, width: canvas.width, height: canvas.height, type };
    } finally {
      if (bitmap && bitmap.close) bitmap.close();
    }
  }

  // 缩略图专用解码：让浏览器直接按目标宽度解码，避免把 2400 万像素整张解到内存里。
  async function bitmapForThumb(file, maxEdge) {
    const target = Math.max(64, Math.round(Number(maxEdge) || 400));
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
        resizeWidth: target,
        resizeQuality: "medium"
      });
    } catch (err) {
      /* 老浏览器 / 特殊格式退回整张解码 */
    }
    return bitmapFromFile(file);
  }

  // 按方向把位图画进画布：rot 为 90/270 时宽高互换。
  function drawOriented(ctx, bitmap, boxW, boxH, rotation, mirror) {
    const rot = normalizeRotation(rotation);
    const swap = rot === 90 || rot === 270;
    ctx.save();
    ctx.translate(boxW / 2, boxH / 2);
    if (mirror) ctx.scale(-1, 1);
    ctx.rotate((rot * Math.PI) / 180);
    const drawW = swap ? boxH : boxW;
    const drawH = swap ? boxW : boxH;
    ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  async function makeThumbnail(file, maxEdge, options) {
    const opts = options || {};
    const limit = Number(maxEdge) || 640;
    const bitmap = opts.fast === false
      ? await bitmapFromFile(file)
      : await bitmapForThumb(file, limit);
    try {
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const rotation = normalizeRotation(opts.rotation);
      const swap = rotation === 90 || rotation === 270;
      const canvas = document.createElement("canvas");
      canvas.width = swap ? height : width;
      canvas.height = swap ? width : height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#0d0e10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawOriented(ctx, bitmap, width, height, rotation, !!opts.mirror);
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.84);
      });
      if (!blob) throw new Error("缩略图生成失败");
      return {
        blob,
        width: swap ? bitmap.height : bitmap.width,
        height: swap ? bitmap.width : bitmap.height,
        thumbWidth: canvas.width,
        thumbHeight: canvas.height
      };
    } finally {
      if (bitmap && bitmap.close) bitmap.close();
    }
  }

  function makeFile(blob, name) {
    try {
      return new File([blob], name, { type: blob.type || "application/octet-stream" });
    } catch (err) {
      return blob;
    }
  }

  F.extOf = extOf;
  F.baseName = baseName;
  F.isImageName = isImageName;
  F.canPreviewExt = canPreviewExt;
  F.isRawExt = isRawExt;
  F.isOpaqueExt = isOpaqueExt;
  F.COLORS = COLORS;
  F.COLOR_LABELS = COLOR_LABELS;
  F.COLOR_XMP = COLOR_XMP;
  F.FLAG_LABELS = FLAG_LABELS;
  F.colorLabel = colorLabel;
  F.flagLabel = flagLabel;
  F.formatBytes = formatBytes;
  F.formatDate = formatDate;
  F.formatDateShort = formatDateShort;
  F.timestampForFile = timestampForFile;
  F.clamp = clamp;
  F.debounce = debounce;
  F.escapeHtml = escapeHtml;
  F.sanitizeFileName = sanitizeFileName;
  F.normalizeZipPath = normalizeZipPath;
  F.matchesFilter = matchesFilter;
  F.sortPhotos = sortPhotos;
  F.parseExif = parseExif;
  F.FOCAL_RANGES = FOCAL_RANGES;
  F.APERTURE_RANGES = APERTURE_RANGES;
  F.normalizeRecord = normalizeRecord;
  F.isEmptyRecord = isEmptyRecord;
  F.normalizeMarks = normalizeMarks;
  F.mergeMarks = mergeMarks;
  F.readLocalCatalog = readLocalCatalog;
  F.writeLocalCatalog = writeLocalCatalog;
  F.readFolderCatalog = readFolderCatalog;
  F.writeFolderCatalog = writeFolderCatalog;
  F.readProjectFile = readProjectFile;
  F.writeProjectFile = writeProjectFile;
  F.CATALOG_FILE = CATALOG_FILE;
  F.PROJECT_FILE = PROJECT_FILE;
  /* ---------------- zip reading (store only) ---------------- */

  async function readZipCentral(blob) {
    if (!blob || !blob.size) throw new Error("归档包是空的");
    const tailSize = Math.min(blob.size, 66560);
    const tailStart = blob.size - tailSize;
    const tail = new DataView(await blob.slice(tailStart).arrayBuffer());
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i -= 1) {
      if (tail.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("不是有效的 ZIP");
    const count = tail.getUint16(eocd + 10, true);
    const centralSize = tail.getUint32(eocd + 12, true);
    const centralOffset = tail.getUint32(eocd + 16, true);
    if (!centralSize || centralOffset + centralSize > blob.size) {
      throw new Error("ZIP 目录损坏");
    }
    const buffer = await blob.slice(centralOffset, centralOffset + centralSize).arrayBuffer();
    const central = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");
    const entries = [];
    let p = 0;
    for (let i = 0; i < count; i += 1) {
      if (p + 46 > central.byteLength) break;
      if (central.getUint32(p, true) !== 0x02014b50) break;
      const method = central.getUint16(p + 10, true);
      const crc = central.getUint32(p + 16, true);
      const compSize = central.getUint32(p + 20, true);
      const size = central.getUint32(p + 24, true);
      const nameLen = central.getUint16(p + 28, true);
      const extraLen = central.getUint16(p + 30, true);
      const commentLen = central.getUint16(p + 32, true);
      const localOffset = central.getUint32(p + 42, true);
      const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen));
      entries.push({ name: name, method: method, crc: crc, size: size, compSize: compSize, localOffset: localOffset });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function zipEntryBlob(blob, entry) {
    if (entry.method !== 0) throw new Error("归档包必须是未压缩的 ZIP");
    const headerSize = 30;
    if (entry.localOffset + headerSize > blob.size) throw new Error("ZIP 数据偏移越界");
    const header = new DataView(
      await blob.slice(entry.localOffset, entry.localOffset + headerSize).arrayBuffer()
    );
    const nameLen = header.getUint16(26, true);
    const extraLen = header.getUint16(28, true);
    const start = entry.localOffset + headerSize + nameLen + extraLen;
    if (start + entry.compSize > blob.size) throw new Error("ZIP 数据越界");
    return blob.slice(start, start + entry.compSize);
  }

  /* ---------------- watermark ---------------- */

  function anchorParts(anchor) {
    const parts = String(anchor || "bottom-right").split("-");
    if (parts.length === 2) return { x: parts[1], y: parts[0] };
    return { x: "right", y: "bottom" };
  }

  function anchorRect(anchor, width, height, inset, contentW, contentH) {
    const parts = anchorParts(anchor);
    let x;
    if (parts.x === "left") x = inset;
    else if (parts.x === "center") x = (width - contentW) / 2;
    else x = width - inset - contentW;
    let y;
    if (parts.y === "top") y = inset;
    else if (parts.y === "middle") y = (height - contentH) / 2;
    else y = height - inset - contentH;
    return { x: x, y: y };
  }

  function drawWatermark(ctx, width, height, options) {
    const opts = options || {};
    const text = String(opts.text || "").trim();
    const logo = opts.logo || null;
    if (!text && !logo) return;
    const longEdge = Math.max(width, height);

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    if (text) {
      const fontSize = Math.max(8, Math.round((longEdge * (Number(opts.fontSize) || 3)) / 100));
      const inset = (longEdge * (Number(opts.inset) || 0)) / 100;
      const weight = String(opts.fontWeight || 600);
      const family =
        opts.fontFamily ||
        '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.font = weight + " " + fontSize + "px " + family;
      const textWidth = ctx.measureText(text).width;
      const pos = anchorRect(opts.anchor, width, height, inset, textWidth, fontSize);
      ctx.globalAlpha = clamp(Number(opts.opacity) || 70, 5, 100) / 100;
      ctx.fillStyle = opts.color || "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = Math.max(2, fontSize * 0.16);
      ctx.shadowOffsetY = Math.max(1, fontSize * 0.04);
      ctx.fillText(text, pos.x, pos.y + fontSize / 2);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    if (logo) {
      const logoInsetPercent =
        opts.logoInset == null ? Number(opts.inset) || 0 : Number(opts.logoInset) || 0;
      const logoInset = (longEdge * logoInsetPercent) / 100;
      const logoWidth = Math.max(
        8,
        Math.min(width * 0.6, (width * (Number(opts.logoSize) || 14)) / 100)
      );
      const logoHeight = (logoWidth * logo.height) / logo.width;
      const pos = anchorRect(
        opts.logoAnchor || opts.anchor,
        width,
        height,
        logoInset,
        logoWidth,
        logoHeight
      );
      const alpha =
        opts.logoOpacity == null ? 85 : Number(opts.logoOpacity);
      ctx.globalAlpha = clamp(alpha || 85, 5, 100) / 100;
      ctx.drawImage(logo, pos.x, pos.y, logoWidth, logoHeight);
    }

    ctx.restore();
  }

  async function watermarkBlob(file, options) {
    const opts = options || {};
    const bitmap = await bitmapFromFile(file);
    let width = bitmap.width;
    let height = bitmap.height;
    const maxEdge = Number(opts.maxEdge) || 0;
    if (maxEdge && Math.max(width, height) > maxEdge) {
      const scale = maxEdge / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    const rotation = normalizeRotation(opts.rotation);
    const swap = rotation === 90 || rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? height : width;
    canvas.height = swap ? width : height;
    const ctx = canvas.getContext("2d");
    drawOriented(ctx, bitmap, width, height, rotation, !!opts.mirror);
    drawWatermark(ctx, canvas.width, canvas.height, opts);
    const quality = clamp(Number(opts.quality) || 92, 40, 100) / 100;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("水印导出失败");
    return { blob: blob, width: canvas.width, height: canvas.height };
  }

  F.drawWatermark = drawWatermark;
  F.watermarkBlob = watermarkBlob;
  F.readZipCentral = readZipCentral;
  F.zipEntryBlob = zipEntryBlob;
  F.buildXmp = buildXmp;
  F.extractEmbeddedJpeg = extractEmbeddedJpeg;
  F.downloadBlob = downloadBlob;
  F.zipStore = zipStore;
  F.crcOfBlob = crcOfBlob;
  F.convertImage = convertImage;
  F.makeThumbnail = makeThumbnail;
  F.makeFile = makeFile;
})(window);
