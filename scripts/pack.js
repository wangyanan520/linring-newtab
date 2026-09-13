#!/usr/bin/env node
/**
 * PBI-16 可复现打包脚本（US-18）
 *
 * 从 凌睿科技导航页/ 生成干净 zip（排除 .DS_Store / __MACOSX / ._* 垃圾），
 * 输出 dist/lingrui-nav-<version>-<YYYYMMDD>.zip 与 .sha256 校验文件。
 * 零外部依赖：zip 格式（local header + central directory + deflateRaw + crc32）手写实现。
 *
 * 运行：npm run pack:zip（npm run pack 会先跑单测）
 * 自校验：打包后立即解压并与源码目录逐文件字节比对，不一致则失败。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '凌睿科技导航页');
const OUT_DIR = path.join(ROOT, 'dist');

/* ---- 垃圾与非发布文件过滤（US-18 AC2：无 .DS_Store / __MACOSX） ---- */
function isJunk(name) {
  return name === '.DS_Store' || name === '.AppleDouble'
    || name === '__MACOSX' || name.startsWith('._')
    || name === '.git'
    || name === '__tests__';   // 测试代码不进分发包（P1-3）
}

/* ---- 固定打包时间戳（P1-4）----
 * 可复现性要求同一份源码在任何机器、任何时刻产出相同字节流。
 * 早期实现用文件 mtime 编码 zip 时间戳，导致 git clone 或 touch 之后 SHA 就变，
 * 跨环境无法作为发布指纹。改为固定时间戳；需要时用 SOURCE_DATE_EPOCH 覆盖。 */
const ZIP_TIMESTAMP = (() => {
  const raw = process.env.SOURCE_DATE_EPOCH;
  if (raw !== undefined) {
    const secs = Number(raw);
    if (Number.isFinite(secs)) return new Date(secs * 1000);
  }
  return new Date(1980, 0, 1, 0, 0, 0); // zip 纪元起点，稳定且合法
})();

/* ---- 遍历源码目录，返回 [{ path, buffer }]（zip 内路径为相对 SRC） ---- */
function collectFiles(dir, base) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isJunk(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(abs, rel));
    } else {
      out.push({ path: rel.split(path.sep).join('/'), buffer: fs.readFileSync(abs) });
    }
  }
  return out;
}

/* ---- CRC32 ---- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---- DOS 时间编码 ---- */
function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/* ---- 构建 zip 字节流 ---- */
function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  const { time, date } = dosDateTime(ZIP_TIMESTAMP); // 固定时间戳，保证可复现（P1-4）
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.path, 'utf8');
    const comp = zlib.deflateRawSync(f.buffer);
    const crc = crc32(f.buffer);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);      // local file header signature
    local.writeUInt16LE(20, 4);              // version needed
    local.writeUInt16LE(0x0800, 6);          // flags: UTF-8
    local.writeUInt16LE(8, 8);               // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(f.buffer.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);              // extra len
    localParts.push(local, nameBuf, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);    // central directory signature
    central.writeUInt16LE(20, 4);            // version made by
    central.writeUInt16LE(20, 6);            // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(f.buffer.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);            // extra
    central.writeUInt16LE(0, 32);            // comment
    central.writeUInt16LE(0, 34);            // disk
    central.writeUInt16LE(0, 36);            // internal attrs
    central.writeUInt32LE(0, 38);            // external attrs
    central.writeUInt32LE(offset, 42);       // local header offset
    centralParts.push(central, nameBuf);

    offset += 30 + nameBuf.length + comp.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // end of central directory
  eocd.writeUInt16LE(0, 4);                  // disk
  eocd.writeUInt16LE(0, 6);                  // cd disk
  eocd.writeUInt16LE(files.length, 8);       // entries this disk
  eocd.writeUInt16LE(files.length, 10);      // entries total
  eocd.writeUInt32LE(centralBuf.length, 12); // cd size
  eocd.writeUInt32LE(offset, 16);            // cd offset
  eocd.writeUInt16LE(0, 20);                 // comment len

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

/* ---- 自校验：解压 zip 与源码逐文件比对（US-18 AC3 / PBI-16 AC3） ---- */
function verifyZip(zipBuf, files) {
  // 简单解析：按 local header 顺序读
  let pos = 0;
  const seen = new Set();
  while (pos + 30 <= zipBuf.length) {
    const sig = zipBuf.readUInt32LE(pos);
    if (sig !== 0x04034b50) break;
    const compSize = zipBuf.readUInt32LE(pos + 18);
    const nameLen = zipBuf.readUInt16LE(pos + 26);
    const extraLen = zipBuf.readUInt16LE(pos + 28);
    const name = zipBuf.subarray(pos + 30, pos + 30 + nameLen).toString('utf8');
    const dataStart = pos + 30 + nameLen + extraLen;
    const data = zlib.inflateRawSync(zipBuf.subarray(dataStart, dataStart + compSize));
    const src = files.find(f => f.path === name);
    if (!src) throw new Error(`zip 含源码外文件: ${name}`);
    if (!src.buffer.equals(data)) throw new Error(`内容不一致: ${name}`);
    seen.add(name);
    pos = dataStart + compSize;
  }
  const missing = files.filter(f => !seen.has(f.path)).map(f => f.path);
  if (missing.length) throw new Error(`源码未全部入包: ${missing.join(', ')}`);
}

function main() {
  const files = collectFiles(SRC, '');
  if (files.length === 0) throw new Error('源码目录为空');

  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const outName = `lingrui-nav-v${manifest.version}-${dateStr}.zip`;
  const outPath = path.join(OUT_DIR, outName);

  const zip = buildZip(files);
  verifyZip(zip, files); // 打包即校验，保证产物与源码一致

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, zip);
  const sha = crypto.createHash('sha256').update(zip).digest('hex');
  fs.writeFileSync(outPath + '.sha256', sha + '  ' + outName + '\n');

  console.log(`打包完成: ${outName}`);
  console.log(`文件数: ${files.length} | 大小: ${(zip.length / 1024).toFixed(1)} KB`);
  console.log(`SHA-256: ${sha}`);
  console.log(`自校验: zip 内容与源码逐文件一致 ✓`);
  console.log(`垃圾文件: 已排除（.DS_Store/__MACOSX/._*）`);
}

main();
