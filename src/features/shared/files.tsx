'use client';
/* Signed private images deliberately use native img to avoid a shared image optimizer cache. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Trash2, Upload } from 'lucide-react';
async function compress(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error(
      'Usa una imagen JPEG, PNG o WebP. Si tu iPhone guarda HEIC, exporta como JPEG.',
    );
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen de origen supera 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen.'))),
        'image/jpeg',
        0.84,
      ),
    );
    if (blob.size > 5 * 1024 * 1024) throw new Error('La imagen comprimida supera 5 MB.');
    return new File([blob], 'evidencia.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
export function UploadImage({
  kind,
  parent,
  demo,
  notify,
}: {
  kind: 'task' | 'entry' | 'avatar';
  parent: string;
  demo: boolean;
  notify: (s: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const router = useRouter();
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function upload(file?: File) {
    if (!file) return;
    if (demo) {
      notify('Demostración de solo lectura.');
      return;
    }
    if (!navigator.onLine) {
      notify('Sin conexión. La imagen no se ha guardado.');
      return;
    }
    try {
      setProgress(0);
      const image = await compress(file);
      setPreview(URL.createObjectURL(image));
      const form = new FormData();
      form.set('kind', kind);
      form.set('parent', parent);
      form.set('file', image);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/files');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          let response;
          try {
            response = JSON.parse(xhr.responseText);
          } catch {
            reject(new Error('Respuesta de carga inválida.'));
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(response.error ?? 'No se pudo subir.'));
        };
        xhr.onerror = () =>
          reject(new Error('Conexión interrumpida. La imagen no se confirmó como guardada.'));
        xhr.send(form);
      });
      notify('Imagen guardada.');
      setPreview(null);
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo subir la imagen.');
    } finally {
      setProgress(null);
    }
  }
  return (
    <div className="stack">
      {preview && (
        <img className="photo" src={preview} alt="Vista previa de la imagen seleccionada" />
      )}
      <div className="row wrap">
        <label className="btn">
          <Upload size={14} />
          Galería
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            disabled={progress !== null}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        <label className="btn">
          <Camera size={14} />
          Cámara
          <input
            type="file"
            className="sr-only"
            capture="environment"
            accept="image/*"
            disabled={progress !== null}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        <small className="muted">JPEG, PNG o WebP · hasta 5 MB después de comprimir</small>
      </div>
      {progress !== null && (
        <label>
          Subiendo imagen · {progress}%<progress value={progress} max={100} />
          <small>La carga se confirma al terminar la validación del servidor.</small>
        </label>
      )}
    </div>
  );
}
export function PrivateImage({
  kind,
  id,
  canDelete,
  demo,
  notify,
}: {
  kind: 'task' | 'entry' | 'avatar';
  id: string;
  canDelete?: boolean;
  demo: boolean;
  notify: (s: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null),
    [error, setError] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/files?kind=${kind}&id=${id}`, { cache: 'no-store', signal: c.signal })
      .then((r) => r.json())
      .then((r) => {
        if (r.url) setUrl(r.url);
        else setError(true);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [id, kind]);
  return (
    <div className="stack">
      {url && !error ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            className="photo"
            alt={kind === 'avatar' ? 'Avatar del trabajador' : 'Evidencia adjunta'}
            onError={() => setError(true)}
          />
        </a>
      ) : (
        <p className="muted">
          {error
            ? 'Imagen no disponible. Vuelve a abrir el detalle para renovar el acceso.'
            : 'Cargando imagen privada…'}
        </p>
      )}
      {canDelete && kind !== 'avatar' && (
        <button
          className="btn danger"
          onClick={async () => {
            if (demo) {
              notify('Demostración de solo lectura.');
              return;
            }
            try {
              const r = await fetch('/api/files', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, id }),
              });
              const result = await r.json();
              notify(result.error ?? 'Archivo eliminado.');
              router.refresh();
            } catch {
              notify(
                'No se pudo confirmar la eliminación. Revisa la conexión y recarga el detalle.',
              );
            }
          }}
        >
          <Trash2 size={14} />
          Eliminar imagen
        </button>
      )}
    </div>
  );
}
