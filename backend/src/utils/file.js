const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const { env } = require('../config/env');

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function getUploadRootAbsolutePath() {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}

function ensureUploadRootExists() {
  fs.mkdirSync(getUploadRootAbsolutePath(), { recursive: true });
}

async function ensureDirectoryExists(directoryPath) {
  await fsp.mkdir(directoryPath, { recursive: true });
}

function sanitizeFilenameBase(filename) {
  const baseName = path.basename(filename, path.extname(filename));
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return sanitized || 'file';
}

function getFileExtension(mimeType, originalName) {
  const mappedExtension = MIME_EXTENSION_MAP[mimeType];

  if (mappedExtension) {
    return mappedExtension;
  }

  const originalExtension = path.extname(originalName).replace('.', '').toLowerCase();
  return originalExtension || 'bin';
}

function createStoredFilename(originalName, mimeType) {
  const extension = getFileExtension(mimeType, originalName);
  const baseName = sanitizeFilenameBase(originalName);

  return `${baseName}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function buildPublicFileUrl(relativePath) {
  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return normalizedPath.replace(/\\/g, '/');
}

async function writeUploadedFile({ fileBuffer, fileName, subdirectory = 'assets' }) {
  const targetDirectory = path.join(getUploadRootAbsolutePath(), subdirectory);
  await ensureDirectoryExists(targetDirectory);

  const absolutePath = path.join(targetDirectory, fileName);
  await fsp.writeFile(absolutePath, fileBuffer);

  const relativePath = toPosixPath(path.join(env.UPLOAD_DIR, subdirectory, fileName));

  return {
    absolutePath,
    relativePath,
    publicUrl: buildPublicFileUrl(relativePath),
  };
}

async function deletePhysicalFile(relativeOrAbsolutePath) {
  if (!relativeOrAbsolutePath) {
    return;
  }

  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(process.cwd(), relativeOrAbsolutePath);

  try {
    await fsp.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function parseSvgDimensions(buffer) {
  const svgContent = buffer.toString('utf8');
  const widthMatch = svgContent.match(/\bwidth=["']?([0-9.]+)(px)?["']?/i);
  const heightMatch = svgContent.match(/\bheight=["']?([0-9.]+)(px)?["']?/i);

  if (widthMatch && heightMatch) {
    return {
      width: Number(widthMatch[1]),
      height: Number(heightMatch[1]),
    };
  }

  const viewBoxMatch = svgContent.match(/\bviewBox=["']?([0-9.\s-]+)["']?/i);

  if (viewBoxMatch) {
    const values = viewBoxMatch[1].trim().split(/\s+/).map(Number);

    if (values.length === 4 && values.every((value) => Number.isFinite(value))) {
      return {
        width: values[2],
        height: values[3],
      };
    }
  }

  return { width: null, height: null };
}

function parsePngDimensions(buffer) {
  if (buffer.length < 24) {
    return { width: null, height: null };
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) {
    return { width: null, height: null };
  }

  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const blockLength = buffer.readUInt16BE(offset + 2);

    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + blockLength;
  }

  return { width: null, height: null };
}

function parseWebpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return { width: null, height: null };
  }

  const chunkHeader = buffer.toString('ascii', 12, 16);

  if (chunkHeader === 'VP8X') {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  if (chunkHeader === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkHeader === 'VP8L') {
    const byte1 = buffer[21];
    const byte2 = buffer[22];
    const byte3 = buffer[23];
    const byte4 = buffer[24];

    const width = 1 + (((byte2 & 0x3f) << 8) | byte1);
    const height = 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6));

    return { width, height };
  }

  return { width: null, height: null };
}

function getImageDimensions(buffer, mimeType) {
  switch (mimeType) {
    case 'image/png':
      return parsePngDimensions(buffer);
    case 'image/jpeg':
    case 'image/jpg':
      return parseJpegDimensions(buffer);
    case 'image/webp':
      return parseWebpDimensions(buffer);
    case 'image/svg+xml':
      return parseSvgDimensions(buffer);
    default:
      return { width: null, height: null };
  }
}

module.exports = {
  buildPublicFileUrl,
  createStoredFilename,
  deletePhysicalFile,
  ensureDirectoryExists,
  ensureUploadRootExists,
  getImageDimensions,
  getUploadRootAbsolutePath,
  writeUploadedFile,
};
