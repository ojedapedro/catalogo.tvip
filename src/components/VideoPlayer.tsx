import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Copy, AlertTriangle, ExternalLink } from 'lucide-react';

interface Stream {
  url: string;
  quality: string;
  label: string;
  user_agent?: string;
  referrer?: string;
}

interface VideoPlayerProps {
  stream: Stream;
  channelName: string;
  onCopySuccess: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, channelName, onCopySuccess }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);

    // Clean up previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(stream.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay might have been blocked
            setIsPlaying(false);
          });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', event, data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Error de red. Posible restricción de CORS o stream fuera de línea.');
              hls.destroy();
              setIsLoading(false);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('No se pudo reproducir este stream.');
              hls.destroy();
              setIsLoading(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Fallback for Safari native HLS
      video.src = stream.url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });
      video.addEventListener('error', () => {
        setError('Error al cargar el stream. Posible restricción de CORS.');
        setIsLoading(false);
      });
    } else {
      setError('Tu navegador no soporta la reproducción de streams HLS.');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream.url]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || error) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const val = parseFloat(e.target.value);
    setVolume(val);
    video.volume = val;
    video.muted = val === 0;
    setIsMuted(val === 0);
  };

  const handleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch((err) => {
        console.error('Fullscreen Error:', err);
      });
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(stream.url);
    onCopySuccess();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="video-container">
        {isLoading && !error && (
          <div className="video-error-overlay" style={{ background: 'rgba(9, 11, 17, 0.85)' }}>
            <div className="shimmer" style={{ width: '48px', height: '48px', borderRadius: '50%' }}></div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cargando transmisión en vivo...</p>
          </div>
        )}

        {error && (
          <div className="video-error-overlay">
            <AlertTriangle size={36} style={{ color: '#ef4444' }} />
            <div className="video-error-title">Error de Reproducción: {channelName}</div>
            <div className="video-error-text">
              {error}
              <br /><br />
              Muchos streams limitan el acceso directo en navegadores (restricciones de CORS). Puedes copiar el enlace para abrirlo en VLC, MPC-HC, o PotPlayer.
            </div>
            <div className="video-error-actions">
              <button className="btn btn-primary" onClick={copyUrl} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Copy size={14} /> Copiar URL del Stream
              </button>
              <a href={`vlc://${stream.url}`} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                <ExternalLink size={14} /> Abrir en VLC
              </a>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="main-video"
          onClick={togglePlay}
          playsInline
        />

        {/* Custom Controls Overlay (subtle at bottom) */}
        {!error && !isLoading && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(9, 11, 17, 0.95), transparent)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: 0,
            transition: 'opacity 0.2s ease',
            zIndex: 5
          }}
          className="video-controls-bar"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={togglePlay} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={toggleMute} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{
                    width: '70px',
                    height: '4px',
                    accentColor: 'var(--primary)',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {stream.quality}
              </span>
              <button onClick={handleFullscreen} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <Maximize size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inline controls to easily copy links or report streams outside the video element */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Reproduciendo desde: <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{new URL(stream.url).hostname}</span>
        </div>
        <button className="btn btn-secondary" onClick={copyUrl} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
          <Copy size={12} /> Copiar enlace M3U8
        </button>
      </div>
    </div>
  );
};
