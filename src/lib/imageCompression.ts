const uploadLimitBytes = 300 * 1024;
const targetBytes = 260 * 1024;
const sourceLimitBytes = 12 * 1024 * 1024;
const maxDimension = 1800;

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

const webpName = (name: string) => `${name.replace(/\.[^.]+$/, "") || "image"}.webp`;

export const compressImageForUpload = async (file: File) => {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件。");
  if (["image/gif", "image/svg+xml"].includes(file.type)) throw new Error("请上传 JPG、PNG、WebP 或 HEIC 图片。");
  if (file.size > sourceLimitBytes) throw new Error("图片原文件不能超过 12MB。");
  if (file.size <= uploadLimitBytes) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("无法读取这张图片，请换一张 JPG、PNG 或 WebP 图片。");

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("当前浏览器不支持图片压缩。");
  }

  const initialScale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  let width = Math.max(1, Math.round(bitmap.width * initialScale));
  let height = Math.max(1, Math.round(bitmap.height * initialScale));
  let smallest: Blob | null = null;

  for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]) {
      const blob = await canvasBlob(canvas, "image/webp", quality);
      if (!blob) continue;
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= targetBytes) {
        bitmap.close();
        return new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
      }
    }

    const ratio = smallest?.size ? Math.sqrt(targetBytes / smallest.size) : 0.82;
    const nextScale = Math.max(0.7, Math.min(0.86, ratio * 0.96));
    width = Math.max(1, Math.round(width * nextScale));
    height = Math.max(1, Math.round(height * nextScale));
  }

  bitmap.close();
  if (!smallest || smallest.size > uploadLimitBytes) throw new Error("图片压缩后仍超过 300KB，请换一张更简单或更小的图片。");
  return new File([smallest], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
};
