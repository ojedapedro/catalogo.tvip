import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Copy, 
  AlertTriangle, 
  ExternalLink, 
  Settings, 
  ShieldCheck, 
  RefreshCw, 
  Info,
  ExternalLink as LinkIcon
} from 'lucide-react';

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

const PROXY_SERVERS = [
  { name: 'CORSProxy.io (Recomendado)', template: 'https://corsproxy.io/?{url}' },
  { name: 'AllOrigins (Alternativo)', template: 'https://api.allorigins.win/raw?url={url}' },
  { name: 'ThingProxy (Alternativo)', template: 'https://thingproxy.freeboard.io/fetch/{url}' },
  { name: 'Personalizado...', template: 'custom' }
];

const getProxiedUrl = (url: string, template: string): string => {
  if (!template) return url;
  if (template === 'custom') return url;
  if (template.includes('{url}')) {
    return template.replace('{url}', encodeURIComponent(url));
  }
  return `${template}${encodeURIComponent(url)}`;
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, channelName, onCopySuccess }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);

  const getHostname = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname;
    } catch (e) {
      return 'Stream Host';
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // CORS Proxy settings state
  const [useProxy, setUseProxy] = useState<boolean>(() => {
    return localStorage.getItem('tvip_use_proxy') === 'true';
  });

  const [proxyTemplate, setProxyTemplate] = useState<string>(() => {
    return localStorage.getItem('tvip_proxy_template') || 'https://corsproxy.io/?{url}';
  });

  const [customProxyTemplate, setCustomProxyTemplate] = useState<string>(() => {
    return localStorage.getItem('tvip_custom_proxy') || 'http://localhost:8080/?url={url}';
  });

  const [hasAutoRetried, setHasAutoRetried] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'proxy' | 'extension' | 'external'>('proxy');
  const [toast, setToast] = useState<string | null>(null);

  // Local Toast helper
  const showLocalToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('tvip_use_proxy', String(useProxy));
  }, [useProxy]);

  useEffect(() => {
    localStorage.setItem('tvip_proxy_template', proxyTemplate);
  }, [proxyTemplate]);

  useEffect(() => {
    localStorage.setItem('tvip_custom_proxy', customProxyTemplate);
  }, [customProxyTemplate]);

  // Reset auto-retry flag and reload user proxy preference when stream URL changes
  useEffect(() => {
    setHasAutoRetried(false);
    const savedUseProxy = localStorage.getItem('tvip_use_proxy') === 'true';
    setUseProxy(savedUseProxy);
  }, [stream.url]);

  // Main playback setup effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);

    // Sync volume and mute state to new video element
    video.volume = volume;
    video.muted = isMuted;

    // Clean up previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const activeTemplate = proxyTemplate === 'custom' ? customProxyTemplate : proxyTemplate;
    const targetUrl = useProxy ? getProxiedUrl(stream.url, activeTemplate) : stream.url;

    // Custom Hls.js loader to proxy TS fragment segments
    class ProxyLoader {
      stats: any;
      context: any;
      loader: any;

      constructor(config: any) {
        // @ts-ignore
        const DefaultLoaderClass = Hls.DefaultConfig?.loader || (Hls as any).DefaultConfig?.loader;
        this.loader = new DefaultLoaderClass(config);
        
        Object.defineProperty(this, 'stats', {
          get: () => this.loader.stats,
          set: (val) => { this.loader.stats = val; }
        });
        Object.defineProperty(this, 'context', {
          get: () => this.loader.context,
          set: (val) => { this.loader.context = val; }
        });
      }

      load(context: any, config: any, callbacks: any) {
        if (useProxy && context.url) {
          context.url = getProxiedUrl(context.url, activeTemplate);
        }
        this.loader.load(context, config, callbacks);
      }

      abort() {
        this.loader.abort();
      }

      destroy() {
        this.loader.destroy();
      }
    }

    const handleLoadedMetadata = () => {
      setIsLoading(false);
      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    const handleSafariError = () => {
      if (!useProxy && !hasAutoRetried) {
        setHasAutoRetried(true);
        setUseProxy(true);
        showLocalToast('Error de carga. Reintentando con Proxy CORS...');
      } else {
        setError('Error al cargar el stream. Posible restricción de CORS.');
        setIsLoading(false);
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
        ...(useProxy ? { loader: ProxyLoader } : {})
      });
      hlsRef.current = hls;

      hls.loadSource(targetUrl);
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
              if (!useProxy && !hasAutoRetried) {
                setHasAutoRetried(true);
                setUseProxy(true);
                showLocalToast('Error de red detectado. Reintentando con Proxy CORS...');
              } else {
                setError('Error de red. Posible restricción de CORS o stream fuera de línea.');
                hls.destroy();
                setIsLoading(false);
              }
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
      video.src = targetUrl;
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleSafariError);
    } else {
      setError('Tu navegador no soporta la reproducción de streams HLS.');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleSafariError);
    };
  }, [stream.url, useProxy, proxyTemplate, customProxyTemplate]);

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

  const retryPlayback = () => {
    setError(null);
    setIsLoading(true);
    // Force component effect to re-run
    setHasAutoRetried(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      {/* Toast alert */}
      {toast && (
        <div className="toast">
          <Info size={16} style={{ color: 'var(--primary)' }} />
          <span>{toast}</span>
        </div>
      )}

      <div className={`video-container ${showSettings ? 'settings-open' : ''}`}>
        {/* Shimmer loading overlay */}
        {isLoading && !error && (
          <div className="video-error-overlay" style={{ background: 'rgba(9, 11, 17, 0.85)' }}>
            <div className="shimmer" style={{ width: '48px', height: '48px', borderRadius: '50%' }}></div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Cargando transmisión en vivo...
            </p>
          </div>
        )}

        {/* Proxy Active Indicator Badge */}
        {useProxy && !error && !isLoading && (
          <div className="video-proxy-badge">
            <ShieldCheck size={12} />
            <span>Proxy CORS Activo</span>
          </div>
        )}

        {/* Error Troubleshooting Panel */}
        {error && (
          <div className="video-error-overlay" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AlertTriangle size={32} style={{ color: '#ef4444' }} />
            <div className="video-error-title" style={{ fontSize: '0.95rem' }}>
              Error de Reproducción: {channelName}
            </div>
            
            <div className="video-troubleshoot-container">
              <div className="video-troubleshoot-tabs">
                <button 
                  className={`video-troubleshoot-tab ${activeTab === 'proxy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('proxy')}
                >
                  Proxy CORS
                </button>
                <button 
                  className={`video-troubleshoot-tab ${activeTab === 'extension' ? 'active' : ''}`}
                  onClick={() => setActiveTab('extension')}
                >
                  Extensión (Recomendado)
                </button>
                <button 
                  className={`video-troubleshoot-tab ${activeTab === 'external' ? 'active' : ''}`}
                  onClick={() => setActiveTab('external')}
                >
                  Externo
                </button>
              </div>

              <div className="video-troubleshoot-content">
                {activeTab === 'proxy' && (
                  <>
                    <p style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      Redirige el stream a través de un servidor proxy para evadir bloqueos de CORS. Útil como solución rápida.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Estado del Proxy:</span>
                      <button 
                        className={`btn ${useProxy ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                        onClick={() => {
                          setUseProxy(!useProxy);
                          showLocalToast(useProxy ? 'Proxy CORS desactivado' : 'Proxy CORS activado');
                        }}
                      >
                        {useProxy ? 'Desactivar Proxy' : 'Activar Proxy'}
                      </button>
                    </div>
                    <button className="btn btn-primary" onClick={retryPlayback} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '6px' }}>
                      <RefreshCw size={12} /> Reintentar Reproducción
                    </button>
                  </>
                )}

                {activeTab === 'extension' && (
                  <>
                    <p style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                      Instala una extensión para permitir CORS directamente en el navegador. Es la mejor opción: máxima velocidad, sin intermediarios y funciona para todos los streams.
                    </p>
                    <div className="video-troubleshoot-links">
                      <a href="https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafahddgcelchocnlicejdjbgkfoc" target="_blank" rel="noopener noreferrer" className="chrome-btn">
                        <LinkIcon size={12} /> Chrome / Edge
                      </a>
                      <a href="https://addons.mozilla.org/firefox/addon/access-control-allow-origin/" target="_blank" rel="noopener noreferrer" className="firefox-btn">
                        <LinkIcon size={12} /> Firefox
                      </a>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                      *Una vez instalada la extensión, recuerda desactivar el Proxy CORS.
                    </p>
                  </>
                )}

                {activeTab === 'external' && (
                  <>
                    <p style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      Los reproductores externos no tienen restricciones de seguridad de navegador (CORS). Abre este stream en tu reproductor favorito.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" onClick={copyUrl} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px' }}>
                        <Copy size={12} /> Copiar URL
                      </button>
                      <a href={`vlc://${stream.url}`} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px', textDecoration: 'none' }}>
                        <ExternalLink size={12} /> En VLC
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="main-video"
          onClick={togglePlay}
          playsInline
        />

        {/* Custom Settings Popover Panel */}
        {showSettings && !error && (
          <div className="video-settings-popover">
            <div className="video-settings-title">Ajustes del Reproductor</div>
            
            {/* Toggle switch for Proxy CORS */}
            <div className="switch-container">
              <span className="switch-label">Proxy CORS</span>
              <label className="switch-control">
                <input 
                  type="checkbox" 
                  checked={useProxy} 
                  onChange={(e) => {
                    setUseProxy(e.target.checked);
                    showLocalToast(e.target.checked ? 'Proxy CORS activado' : 'Proxy CORS desactivado');
                  }} 
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            {/* Selector for Proxy template */}
            {useProxy && (
              <>
                <div className="video-settings-row">
                  <span className="video-settings-label">Servidor Proxy</span>
                  <select 
                    className="video-settings-select"
                    value={proxyTemplate}
                    onChange={(e) => setProxyTemplate(e.target.value)}
                  >
                    {PROXY_SERVERS.map(srv => (
                      <option key={srv.template} value={srv.template}>{srv.name}</option>
                    ))}
                  </select>
                </div>

                {/* Custom proxy template input */}
                {proxyTemplate === 'custom' && (
                  <div className="video-settings-row">
                    <span className="video-settings-label">
                      Plantilla Personalizada
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Usar {'{url}'}</span>
                    </span>
                    <input 
                      type="text" 
                      className="video-settings-input"
                      value={customProxyTemplate}
                      onChange={(e) => setCustomProxyTemplate(e.target.value)}
                      placeholder="http://localhost:8080/?url={url}"
                    />
                  </div>
                )}
              </>
            )}

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '6px', fontSize: '0.75rem', marginTop: '4px' }}
              onClick={() => setShowSettings(false)}
            >
              Cerrar Ajustes
            </button>
          </div>
        )}

        {/* Custom Controls Overlay (subtle at bottom) */}
        {!error && !isLoading && (
          <div className="video-controls-bar">
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
              
              {/* Settings Toggle button */}
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: showSettings ? 'var(--primary)' : 'white', 
                  cursor: 'pointer',
                  transition: 'color 0.2s ease'
                }}
              >
                <Settings size={18} />
              </button>

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
          Reproduciendo desde: <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{getHostname(stream.url)}</span>
        </div>
        <button className="btn btn-secondary" onClick={copyUrl} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
          <Copy size={12} /> Copiar enlace M3U8
        </button>
      </div>
    </div>
  );
};
