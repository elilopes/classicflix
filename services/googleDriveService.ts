
import { signInWithPopup, googleDriveProvider, auth } from '../firebase';
import { GoogleAuthProvider } from 'firebase/auth';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  iconLink?: string;
}

/**
 * Realiza o login no Google Drive via Firebase Auth
 * Retorna o token de acesso necessário para chamadas diretas à API
 */
export const connectDrive = async (): Promise<string | null> => {
  try {
    const result = await signInWithPopup(auth, googleDriveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return credential?.accessToken || null;
  } catch (error: any) {
    console.error("Erro ao conectar ao Google Drive:", error);
    throw error;
  }
};

/**
 * Lista arquivos de imagem do Google Drive do usuário
 */
export const listDriveImages = async (accessToken: string): Promise<DriveFile[]> => {
  try {
    // Filtramos por tipos de imagens comuns
    const query = "mimeType contains 'image/' and trashed = false";
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, thumbnailLink, webViewLink, iconLink)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Erro ao buscar arquivos do Drive");
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Erro na API do Google Drive:", error);
    throw error;
  }
};

/**
 * Lista arquivos de imagem do Google Drive via Service Account (Servidor)
 */
export const listSharedImages = async (): Promise<DriveFile[]> => {
  try {
    const response = await fetch('/api/drive/shared-files');
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erro ao buscar arquivos compartilhados");
    }
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Erro ao buscar arquivos compartilhados:", error);
    throw error;
  }
};
