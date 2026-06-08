const CLOUD_NAME    = 'dyrf3eqtn';
const UPLOAD_PRESET = 'Haraka_App';

async function cloudinaryUpload(localUri: string, mimeType: string, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri: localUri, type: mimeType, name: fileName } as any);
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: formData },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? 'Upload failed');
  }

  const data = await res.json();
  return data.secure_url as string;
}

export function uploadImageToCloudinary(localUri: string): Promise<string> {
  return cloudinaryUpload(localUri, 'image/jpeg', 'avatar.jpg');
}

export function uploadFileToCloudinary(localUri: string, mimeType: string, fileName: string): Promise<string> {
  return cloudinaryUpload(localUri, mimeType, fileName);
}
