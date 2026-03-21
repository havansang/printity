const ApiError = require('../../utils/ApiError');
const {
  createStoredFilename,
  deletePhysicalFile,
  getImageDimensions,
  writeUploadedFile,
} = require('../../utils/file');
const Asset = require('./asset.model');

function mapAsset(asset) {
  return {
    id: asset._id?.toString() || asset.id,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    storageType: asset.storageType,
    path: asset.path,
    url: asset.url,
    width: asset.width ?? null,
    height: asset.height ?? null,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

async function uploadAsset(userId, file) {
  if (!file) {
    throw new ApiError(422, 'Validation failed', [
      {
        field: 'file',
        message: 'File is required',
      },
    ]);
  }

  const storedFilename = createStoredFilename(file.originalname, file.mimetype);
  const fileMetadata = await writeUploadedFile({
    fileBuffer: file.buffer,
    fileName: storedFilename,
    subdirectory: 'assets',
  });

  try {
    const dimensions = getImageDimensions(file.buffer, file.mimetype);

    const asset = await Asset.create({
      userId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageType: 'local',
      path: fileMetadata.relativePath,
      url: fileMetadata.publicUrl,
      width: Number.isFinite(dimensions.width) ? dimensions.width : null,
      height: Number.isFinite(dimensions.height) ? dimensions.height : null,
    });

    return mapAsset(asset);
  } catch (error) {
    await deletePhysicalFile(fileMetadata.absolutePath);
    throw error;
  }
}

async function listAssets(userId) {
  const assets = await Asset.find({ userId }).sort({ createdAt: -1 });
  return assets.map(mapAsset);
}

async function deleteAsset(userId, assetId) {
  const asset = await Asset.findOne({ _id: assetId, userId });

  if (!asset) {
    throw new ApiError(404, 'Asset not found');
  }

  await deletePhysicalFile(asset.path);
  await asset.deleteOne();
}

module.exports = {
  uploadAsset,
  listAssets,
  deleteAsset,
};
