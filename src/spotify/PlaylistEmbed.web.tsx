import { playlistEmbedUrl } from './links';

export function PlaylistEmbed({ id, title }: { id: string; title: string }) {
  return (
    <iframe
      src={playlistEmbedUrl(id)}
      title={`Lecteur Spotify : ${title}`}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="strict-origin-when-cross-origin"
      style={{ display: 'block', flex: 1, minHeight: 0, width: '100%', border: 0, borderRadius: 14 }}
    />
  );
}
