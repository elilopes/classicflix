export const DEFAULT_DRIVE_POSTER_FOLDER_ID = '1EplnNSliyeRLI0KcTYACJrvmIweqlxcX';
const MAX_WEBP_BYTES = 1_000_000; // Estritamente menor que 1 MB

export interface DrivePosterUploadResult {
  fileId: string;
  fileName: string;
  posterUrl: string;
  alreadyExisted: boolean;
  sizeBytes?: number;
}

const isWikimediaHost = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['commons.wikimedia.org', 'upload.wikimedia.org', 'www.wikidata.org'].includes(
      parsed.hostname.toLowerCase()
    );
  } catch {
    return false;
  }
};

const renderImageToWebp = (
  img: HTMLImageElement,
  maxWidth: number,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const naturalW = img.naturalWidth || img.width || 600;
    const naturalH = img.naturalHeight || img.height || 900;
    const scale = naturalW > maxWidth ? maxWidth / naturalW : 1;
    const targetWidth = Math.max(1, Math.round(naturalW * scale));
    const targetHeight = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Contexto 2D indisponível para converter imagem em WebP.'));
      return;
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Navegador não conseguiu converter a imagem para WebP.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
};

export const convertImageUrlToWebpBlob = async (imageUrl: string): Promise<Blob> => {
  const fetchTarget = isWikimediaHost(imageUrl)
    ? `/api/drive/proxy-image?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;

  const response = await fetch(fetchTarget);
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Falha ao baixar imagem do Wikidata (${response.status}): ${errText}`);
  }

  const sourceBlob = await response.blob();
  const objectUrl = URL.createObjectURL(sourceBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível decodificar a imagem do Wikidata.'));
      el.src = objectUrl;
    });

    // Tenta qualidade alta primeiro e reduz qualidade/dimensão progressivamente para garantir < 1 MB
    const widthSteps = [800, 640, 480, 360, 260];
    const qualitySteps = [0.88, 0.76, 0.64, 0.5, 0.36, 0.25];

    for (const maxWidth of widthSteps) {
      for (const quality of qualitySteps) {
        const candidate = await renderImageToWebp(img, maxWidth, quality);
        if (candidate.size < MAX_WEBP_BYTES) {
          return candidate;
        }
      }
    }

    throw new Error('Não foi possível comprimir a imagem WebP para menos de 1 MB.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const findFileInDrive = async (
  query: string,
  accessToken: string
): Promise<{ id: string; name: string } | null> => {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id, name)');
  url.searchParams.set('pageSize', '5');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
};

const uploadMultipartWebp = async (
  fileName: string,
  webpBlob: Blob,
  accessToken: string,
  parentFolderId: string
): Promise<{ id: string; name: string }> => {
  const metadata = {
    name: fileName,
    mimeType: 'image/webp',
    parents: [parentFolderId],
  };

  const boundary = `classicflix_webp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadataPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n`;
  const mediaHeader =
    `--${boundary}\r\n` +
    `Content-Type: image/webp\r\n\r\n`;
  const endDelimiter = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([metadataPart, mediaHeader, webpBlob, endDelimiter], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: bodyBlob,
    }
  );

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const rawMsg = errJson?.error?.message || `Google Drive upload retornou status ${res.status}`;
    const msg =
      res.status === 403 || res.status === 404
        ? `Sem permissão de escrita na pasta ${parentFolderId} do Google Drive (${rawMsg}). Verifique se a conta Google conectada tem acesso de Editor à pasta.`
        : rawMsg;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return await res.json();
};

const makeDriveFilePublicReader = async (fileId: string, accessToken: string): Promise<void> => {
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );
  } catch (err) {
    console.warn('Aviso ao configurar permissão pública no Drive:', err);
  }
};

export const uploadWikidataPosterToGoogleDrive = async ({
  qid,
  imageUrl,
  accessToken,
  folderId = DEFAULT_DRIVE_POSTER_FOLDER_ID,
}: {
  qid: string;
  imageUrl: string;
  accessToken: string;
  folderId?: string;
}): Promise<DrivePosterUploadResult> => {
  const cleanQid = qid.trim().toUpperCase();
  const fileName = `${cleanQid}.webp`;
  const targetFolderId = (folderId || DEFAULT_DRIVE_POSTER_FOLDER_ID).trim();

  // Verifica exclusivamente dentro da pasta configurada para evitar sobrescrita silenciosa
  const existingInFolder = await findFileInDrive(
    `'${targetFolderId}' in parents and name = '${fileName}' and trashed = false`,
    accessToken
  );

  if (existingInFolder?.id) {
    await makeDriveFilePublicReader(existingInFolder.id, accessToken);
    return {
      fileId: existingInFolder.id,
      fileName,
      posterUrl: `https://lh3.googleusercontent.com/d/${existingInFolder.id}`,
      alreadyExisted: true,
    };
  }

  const webpBlob = await convertImageUrlToWebpBlob(imageUrl);
  const uploaded = await uploadMultipartWebp(fileName, webpBlob, accessToken, targetFolderId);

  await makeDriveFilePublicReader(uploaded.id, accessToken);

  return {
    fileId: uploaded.id,
    fileName,
    posterUrl: `https://lh3.googleusercontent.com/d/${uploaded.id}`,
    alreadyExisted: false,
    sizeBytes: webpBlob.size,
  };
};
