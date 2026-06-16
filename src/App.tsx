import React, { useEffect, useState, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChannelCard } from './components/ChannelCard';
import { VideoPlayer } from './components/VideoPlayer';
import { Search, SlidersHorizontal, Tv, X, Play, Menu } from 'lucide-react';

interface Stream {
  url: string;
  quality: string;
  label: string;
  user_agent?: string;
  referrer?: string;
}

interface Channel {
  id: string;
  name: string;
  logo: string;
  categories: string[];
  countries: string[];
  languages: string[];
  streams: Stream[];
}

interface Catalog {
  channels: Channel[];
  categories: Record<string, string>;
  countries: Record<string, { name: string; flag: string }>;
  languages: Record<string, string>;
}

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<{
    type: 'all' | 'favorites' | 'category' | 'country' | 'language';
    value?: string;
  }>({ type: 'all' });

  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(40);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Debounce search query to prevent filtering lag on large lists
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectFilter = (filter: {
    type: 'all' | 'favorites' | 'category' | 'country' | 'language';
    value?: string;
  }) => {
    setActiveFilter(filter);
    setIsSidebarOpen(false);
  };

  // Load catalog and favorites on mount
  useEffect(() => {
    fetch('/catalog.json')
      .then(res => res.json())
      .then((data: Catalog) => {
        setCatalog(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch catalog.json:', err);
        setIsLoading(false);
      });

    const storedFavs = localStorage.getItem('tvip_favorites');
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Show temporary toast message helper
  const triggerToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle favorite channel
  const toggleFavorite = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting card
    let newFavs: string[];
    if (favorites.includes(channelId)) {
      newFavs = favorites.filter(id => id !== channelId);
      triggerToast('Canal removido de favoritos');
    } else {
      newFavs = [...favorites, channelId];
      triggerToast('Canal agregado a favoritos');
    }
    setFavorites(newFavs);
    localStorage.setItem('tvip_favorites', JSON.stringify(newFavs));
  };

  // Filter channels logic
  const filteredChannels = useMemo(() => {
    if (!catalog) return [];

    let list = catalog.channels;

    // 1. Sidebar filter
    if (activeFilter.type === 'favorites') {
      list = list.filter(c => favorites.includes(c.id));
    } else if (activeFilter.type === 'category' && activeFilter.value) {
      list = list.filter(c => c.categories.includes(activeFilter.value!));
    } else if (activeFilter.type === 'country' && activeFilter.value) {
      list = list.filter(c => c.countries.includes(activeFilter.value!));
    } else if (activeFilter.type === 'language' && activeFilter.value) {
      list = list.filter(c => c.languages.includes(activeFilter.value!));
    }

    // 2. Search query filter (using debounced query)
    if (debouncedQuery.trim() !== '') {
      const q = debouncedQuery.toLowerCase().trim();
      list = list.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const catMatch = c.categories.some(cat => catalog.categories[cat]?.toLowerCase().includes(q));
        const countryName = c.countries[0] ? catalog.countries[c.countries[0]]?.name : '';
        const countryMatch = countryName?.toLowerCase().includes(q);
        return nameMatch || catMatch || countryMatch;
      });
    }

    // 3. Quality filter
    if (qualityFilter !== 'all') {
      list = list.filter(c => {
        return c.streams.some(s => {
          const q = s.quality.toLowerCase();
          if (qualityFilter === 'FHD') return q.includes('1080') || q.includes('fhd');
          if (qualityFilter === 'HD') return q.includes('720') || q.includes('hd');
          if (qualityFilter === 'SD') return q.includes('sd') || (!q.includes('720') && !q.includes('1080'));
          if (qualityFilter === 'HD+') return q.includes('720') || q.includes('hd') || q.includes('1080') || q.includes('fhd');
          return true;
        });
      });
    }

    return list;
  }, [catalog, activeFilter, searchQuery, qualityFilter, favorites]);

  // Compute counts for the sidebar counts badge
  const counts = useMemo(() => {
    const res = {
      all: 0,
      favorites: favorites.length,
      categories: {} as Record<string, number>,
      countries: {} as Record<string, number>,
      languages: {} as Record<string, number>
    };

    if (!catalog) return res;

    res.all = catalog.channels.length;

    // Count categories, countries, and languages across channels
    for (const c of catalog.channels) {
      c.categories.forEach(cat => {
        res.categories[cat] = (res.categories[cat] || 0) + 1;
      });
      c.countries.forEach(country => {
        res.countries[country] = (res.countries[country] || 0) + 1;
      });
      c.languages.forEach(lang => {
        res.languages[lang] = (res.languages[lang] || 0) + 1;
      });
    }

    return res;
  }, [catalog, favorites]);

  // Reset pagination count whenever filter changes
  useEffect(() => {
    setVisibleCount(40);
  }, [activeFilter, debouncedQuery, qualityFilter]);

  const selectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    // Auto-select first stream
    if (channel.streams && channel.streams.length > 0) {
      setSelectedStream(channel.streams[0]);
    } else {
      setSelectedStream(null);
    }
  };

  const activeTitle = useMemo(() => {
    if (activeFilter.type === 'all') return 'Todos los Canales';
    if (activeFilter.type === 'favorites') return 'Canales Favoritos';
    if (activeFilter.type === 'category' && catalog) return `Categoría: ${catalog.categories[activeFilter.value!] || activeFilter.value}`;
    if (activeFilter.type === 'country' && catalog) {
      const c = catalog.countries[activeFilter.value!];
      return `País: ${c?.flag} ${c?.name || activeFilter.value}`;
    }
    if (activeFilter.type === 'language' && catalog) return `Idioma: ${catalog.languages[activeFilter.value!] || activeFilter.value}`;
    return 'Canales';
  }, [activeFilter, catalog]);

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <Sidebar
        categories={catalog?.categories || {}}
        countries={catalog?.countries || {}}
        languages={catalog?.languages || {}}
        activeFilter={activeFilter}
        onSelectFilter={handleSelectFilter}
        counts={counts}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Layout Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header glass-panel">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} title="Menú">
            <Menu size={20} />
          </button>

          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, país o categoría..."
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-bar">
            <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="filter-select"
              value={qualityFilter}
              onChange={e => setQualityFilter(e.target.value)}
            >
              <option value="all">Todas las Calidades</option>
              <option value="HD+">HD y superior (720p+)</option>
              <option value="FHD">Full HD (1080p)</option>
              <option value="HD">HD (720p)</option>
              <option value="SD">Calidad Estándar (SD)</option>
            </select>
          </div>
        </header>

        {/* Workspace Body */}
        <div className={`workspace ${selectedChannel ? 'with-player' : ''}`}>
          
          {/* Scrollable Channels Grid */}
          <div className="channels-wrapper">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem' }}>
                {activeTitle}
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Encontrados: {filteredChannels.length} canales
              </span>
            </div>

            {isLoading ? (
              <div className="channels-grid">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div key={idx} className="channel-card shimmer"></div>
                ))}
              </div>
            ) : filteredChannels.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)', gap: '12px' }}>
                <Tv size={48} style={{ opacity: 0.3 }} />
                <p>No se encontraron canales que coincidan con los filtros activos.</p>
              </div>
            ) : (
              <>
                <div className="channels-grid">
                  {filteredChannels.slice(0, visibleCount).map(c => {
                    const countryMeta = catalog?.countries[c.countries[0] || ''];
                    return (
                      <ChannelCard
                        key={c.id}
                        channel={c}
                        countryFlag={countryMeta?.flag}
                        countryName={countryMeta?.name}
                        isSelected={selectedChannel?.id === c.id}
                        isFavorite={favorites.includes(c.id)}
                        onSelect={() => selectChannel(c)}
                        onToggleFavorite={(e) => toggleFavorite(c.id, e)}
                      />
                    );
                  })}
                </div>

                {/* Pagination Load More Button */}
                {visibleCount < filteredChannels.length && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 40px 0' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => setVisibleCount(prev => prev + 40)}
                      style={{ padding: '12px 32px', borderRadius: '30px' }}
                    >
                      Ver más canales
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar Split Video Player Panel */}
          {selectedChannel && selectedStream && (
            <aside className="player-aside glass-panel animate-fade-in">
              <div className="player-header">
                <span className="player-title">Transmisión en Vivo</span>
                <button className="player-close-btn" onClick={() => setSelectedChannel(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="player-body">
                {/* Embedded Video Element */}
                <VideoPlayer
                  stream={selectedStream}
                  channelName={selectedChannel.name}
                  onCopySuccess={() => triggerToast('Enlace copiado al portapapeles!')}
                />

                {/* Channel Details */}
                <div className="channel-detail-card">
                  <div className="channel-detail-meta">
                    {selectedChannel.logo ? (
                      <img src={selectedChannel.logo} className="channel-detail-logo" alt="" />
                    ) : (
                      <div className="channel-detail-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                        <Tv size={24} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    <div>
                      <h3 className="channel-detail-name">{selectedChannel.name}</h3>
                      <div className="channel-detail-badges">
                        {selectedChannel.categories.map(cat => (
                          <span key={cat} className="badge badge-quality" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                            {catalog?.categories[cat] || cat}
                          </span>
                        ))}
                        {selectedChannel.countries.map(country => (
                          <span key={country} className="badge badge-country">
                            {catalog?.countries[country]?.flag} {catalog?.countries[country]?.name || country}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Stream Selection List */}
                  {selectedChannel.streams.length > 1 && (
                    <div className="channel-detail-streams">
                      <div className="detail-streams-title">Servidores / Calidades Disponibles</div>
                      {selectedChannel.streams.map((stream, idx) => (
                        <div
                          key={idx}
                          className={`stream-selector-row ${selectedStream.url === stream.url ? 'active' : ''}`}
                          onClick={() => setSelectedStream(stream)}
                        >
                          <div className="stream-selector-info">
                            <Play size={12} style={{ color: selectedStream.url === stream.url ? 'var(--primary)' : 'var(--text-muted)' }} />
                            <span className="stream-selector-quality">{stream.quality}</span>
                            <span className="stream-selector-label">({stream.label})</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            #Link {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}

        </div>
      </main>
    </div>
  );
};
