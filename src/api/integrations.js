// Integrations — αντικαθιστούν τα Base44 Core integrations.

import { apiFetch } from './http';

// Κλήση AI (χρειάζεται ANTHROPIC_API_KEY στον server).
export const InvokeLLM = (payload) =>
  apiFetch('/api/integrations/invoke-llm', { method: 'POST', body: payload });

/**
 * Upload αρχείου ΑΠΕΥΘΕΙΑΣ στο Supabase Storage.
 *
 * ΓΙΑΤΙ ΟΧΙ base64 μέσω του API:
 *   Τα Vercel functions έχουν όριο ~4.5MB στο request body, και το base64
 *   μεγαλώνει το αρχείο κατά ~33%. Αποτέλεσμα: αρχεία >3MB απέτυχαν, παρότι
 *   η εφαρμογή διαφήμιζε όριο 20MB.
 *
 * ΠΩΣ ΔΟΥΛΕΥΕΙ ΤΩΡΑ:
 *   1) Ζητάμε από τον server signed upload URL (ελέγχει τύπο/μέγεθος).
 *   2) Ο browser ανεβάζει το αρχείο κατευθείαν στο Supabase (χωρίς όριο Vercel).
 *   3) Επιστρέφουμε το storage_path για αποθήκευση στη βάση.
 *
 * @param {File} file
 * @param {(percent:number)=>void} [onProgress]
 */
export const UploadFile = async ({ file, onProgress }) => {
  if (!file) throw new Error('Δεν επιλέχθηκε αρχείο.');

  // 1) signed URL (ο server επικυρώνει τύπο & μέγεθος)
  const { uploadUrl, path } = await apiFetch('/api/integrations/upload-url', {
    method: 'POST',
    body: { name: file.name, type: file.type, size: file.size },
  });

  // 2) απευθείας ανέβασμα, με progress
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    // ΠΡΟΣΟΧΗ: χωρίς αυτό, το ontimeout παρακάτω ΔΕΝ τρέχει ποτέ — το ανέβασμα
    // θα κρεμούσε επ' άπειρον σε κακό σήμα. 2 λεπτά: αρκετά για 20MB με 4G.
    xhr.timeout = 120000;
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Αποτυχία ανεβάσματος (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Σφάλμα δικτύου κατά το ανέβασμα.'));
    xhr.ontimeout = () => reject(new Error('Λήξη χρόνου κατά το ανέβασμα.'));
    xhr.send(file);
  });

  return { storage_path: path, name: file.name, type: file.type, size: file.size };
};

export const UploadPrivateFile = UploadFile;

/**
 * Προσωρινό URL για άνοιγμα/κατέβασμα ιδιωτικού αρχείου (ισχύει 1 ώρα).
 * Τα αρχεία ΔΕΝ είναι πλέον δημόσια — χρειάζεται πάντα signed URL.
 */
export const CreateFileSignedUrl = async ({ path }) => {
  const { urls } = await apiFetch('/api/integrations/file-url', {
    method: 'POST',
    body: { path },
  });
  return { url: urls?.[path] || null };
};

/** Batch: signed URLs για πολλά αρχεία με ΕΝΑ request (αποφυγή N+1). */
export const CreateFileSignedUrls = async (paths) => {
  if (!paths?.length) return {};
  const { urls } = await apiFetch('/api/integrations/file-url', {
    method: 'POST',
    body: { paths },
  });
  return urls || {};
};

// Δεν υποστηρίζονται στη standalone έκδοση — καθαρό σφάλμα αντί για σιωπηλή αποτυχία.
const notSupported = (name) => async () => {
  throw new Error(`Η ενσωμάτωση "${name}" δεν είναι διαθέσιμη στη standalone έκδοση.`);
};

export const SendEmail = notSupported('SendEmail');
export const GenerateImage = notSupported('GenerateImage');
export const ExtractDataFromUploadedFile = notSupported('ExtractDataFromUploadedFile');

export const Core = {
  InvokeLLM,
  UploadFile,
  UploadPrivateFile,
  SendEmail,
  GenerateImage,
  ExtractDataFromUploadedFile,
  CreateFileSignedUrl,
};
