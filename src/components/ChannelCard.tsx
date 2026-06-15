import React, { useState } from 'react';
import { Heart, Tv } from 'lucide-react';

interface Stream {
  url: string;
  quality: string;
  label: string;
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

interface ChannelCardProps {
  channel: Channel;
  countryFlag?: string;
  countryName?: string;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  countryFlag = '🏳️',
  countryName = 'Desconocido',
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite
}) => {
  const [logoFailed, setLogoFailed] = useState(!channel.logo);

  // Determine highest stream quality
  const getHighestQuality = () => {
    if (!channel.streams || channel.streams.length === 0) return 'SD';
    const qualities = channel.streams.map(s => s.quality);
    if (qualities.some(q => q.toLowerCase().includes('1080') || q.toLowerCase().includes('fhd'))) return 'FHD';
    if (qualities.some(q => q.toLowerCase().includes('720') || q.toLowerCase().includes('hd'))) return 'HD';
    return 'SD';
  };

  const highestQuality = getHighestQuality();

  return (
    <div
      className={`channel-card animate-fade-in ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {/* Favorite Button */}
      <button
        className={`card-favorite-btn ${isFavorite ? 'active' : ''}`}
        onClick={onToggleFavorite}
        title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <Heart size={18} fill={isFavorite ? '#ef4444' : 'transparent'} />
      </button>

      {/* Logo Area */}
      <div className="card-logo-container">
        {!logoFailed ? (
          <img
            src={channel.logo}
            alt={`${channel.name} logo`}
            className="card-logo"
            onError={() => setLogoFailed(true)}
            loading="lazy"
          />
        ) : (
          <div className="card-logo-placeholder">
            <Tv size={32} />
          </div>
        )}
      </div>

      {/* Info Area */}
      <div className="card-info">
        <h3 className="card-title" title={channel.name}>
          {channel.name}
        </h3>
        
        <div className="card-meta">
          <span className="badge badge-quality">{highestQuality}</span>
          <span className="badge badge-country" title={countryName}>
            <span>{countryFlag}</span>
            <span>{channel.countries[0] || 'Int'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
