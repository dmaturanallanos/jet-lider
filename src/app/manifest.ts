import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Jet Líder · Gestión operativa',
    short_name: 'Jet Líder',
    description: 'Turnos y coordinación logística del equipo Jet',
    lang: 'es-CL',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b121c',
    theme_color: '#0b121c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
