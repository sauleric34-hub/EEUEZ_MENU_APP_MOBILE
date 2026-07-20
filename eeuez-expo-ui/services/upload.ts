// ═══════════════════════════════════════════════════════════
//  Aides à l'envoi de fichiers (multipart React Native)
//  React Native attend une « pièce » de la forme { uri, name, type }.
// ═══════════════════════════════════════════════════════════

const MIME_PAR_EXTENSION: Record<string, string> = {
  // images
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', heic: 'image/heic', gif: 'image/gif',
  // vidéos
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  m4v: 'video/x-m4v', '3gp': 'video/3gpp',
};

/** Devine le type MIME depuis l'extension du fichier. */
export function guessMime(nom: string): string {
  const ext = (nom.split('.').pop() || '').toLowerCase();
  return MIME_PAR_EXTENSION[ext] || 'application/octet-stream';
}

export function estVideo(nom: string): boolean {
  return guessMime(nom).startsWith('video');
}

/** Construit la pièce multipart à partir d'un URI local (galerie/caméra). */
export function fichierDepuisUri(uri: string, prefixe = 'media'): {
  uri: string; name: string; type: string;
} {
  const nom = uri.split('/').pop() || `${prefixe}_${Date.now()}.jpg`;
  return { uri, name: nom, type: guessMime(nom) };
}

/** Ajoute un fichier local à un FormData (cast nécessaire : RN n'a pas de Blob). */
export function ajouterFichier(form: FormData, champ: string, uri: string): void {
  form.append(champ, fichierDepuisUri(uri) as unknown as Blob);
}
