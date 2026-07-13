// Integrations — αντικαθιστούν τα Base44 Core integrations.

import { apiFetch } from './http';

// Κλήση AI (χρειάζεται ANTHROPIC_API_KEY στον server).
export const InvokeLLM = (payload) =>
  apiFetch('/api/integrations/invoke-llm', { method: 'POST', body: payload });

// Upload αρχείου: διαβάζεται ως base64 και αποθηκεύεται στον server.
export const UploadFile = async ({ file }) => {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Αποτυχία ανάγνωσης αρχείου.'));
    reader.readAsDataURL(file);
  });
  return apiFetch('/api/integrations/upload', {
    method: 'POST',
    body: { name: file.name, type: file.type, data },
  });
};

export const UploadPrivateFile = UploadFile;

// Δεν υποστηρίζονται στη standalone έκδοση — καθαρό σφάλμα αντί για σιωπηλή αποτυχία.
const notSupported = (name) => async () => {
  throw new Error(`Η ενσωμάτωση "${name}" δεν είναι διαθέσιμη στη standalone έκδοση.`);
};

export const SendEmail = notSupported('SendEmail');
export const GenerateImage = notSupported('GenerateImage');
export const ExtractDataFromUploadedFile = notSupported('ExtractDataFromUploadedFile');
export const CreateFileSignedUrl = notSupported('CreateFileSignedUrl');

export const Core = {
  InvokeLLM,
  UploadFile,
  UploadPrivateFile,
  SendEmail,
  GenerateImage,
  ExtractDataFromUploadedFile,
  CreateFileSignedUrl,
};
