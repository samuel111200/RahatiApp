const CLOUD_NAME    = 'dyrf3eqtn';
const UPLOAD_PRESET = 'Haraka_App';

function fixMimeType(fileName: string, mimeType: string): string {
  const n = fileName.toLowerCase();
  if (n.endsWith('.pdf'))  return 'application/pdf';
  if (n.endsWith('.doc'))  return 'application/msword';
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (n.endsWith('.xls'))  return 'application/vnd.ms-excel';
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (n.endsWith('.ppt'))  return 'application/vnd.ms-powerpoint';
  if (n.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png'))  return 'image/png';
  if (n.endsWith('.gif'))  return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.mp4'))  return 'video/mp4';
  if (n.endsWith('.mp3'))  return 'audio/mpeg';
  if (n.endsWith('.txt'))  return 'text/plain';
  return mimeType && mimeType !== 'application/octet-stream' ? mimeType : 'application/octet-stream';
}

async function cloudinaryUpload(localUri: string, mimeType: string, fileName: string): Promise<string> {
  const resolvedMime = fixMimeType(fileName, mimeType);

  const formData = new FormData();
  formData.append('file', { uri: localUri, type: resolvedMime, name: fileName } as any);
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: formData },
  );

  const data = await res.json();
  console.log('[Cloudinary] status:', res.status, 'body:', JSON.stringify(data).slice(0, 500));

  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Upload failed (${res.status})`);
  }

  return data.secure_url as string;
}

export function uploadImageToCloudinary(localUri: string): Promise<string> {
  return cloudinaryUpload(localUri, 'image/jpeg', 'avatar.jpg');
}

export function uploadFileToCloudinary(localUri: string, mimeType: string, fileName: string): Promise<string> {
  return cloudinaryUpload(localUri, mimeType, fileName);
}
