import React, { useState } from 'react';
import { Tv, Heart, Folder, Globe, Languages, ChevronDown, ChevronRight, List, X } from 'lucide-react';

interface SidebarProps {
  categories: Record<string, string>;
  countries: Record<string, { name: string; flag: string }>;
  languages: Record<string, string>;
  activeFilter: {
    type: 'all' | 'favorites' | 'category' | 'country' | 'language';
    value?: string;
  };
  onSelectFilter: (filter: { type: 'all' | 'favorites' | 'category' | 'country' | 'language'; value?: string }) => void;
  counts: {
    all: number;
    favorites: number;
    categories: Record<string, number>;
    countries: Record<string, number>;
    languages: Record<string, number>;
  };
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  categories,
  countries,
  languages,
  activeFilter,
  onSelectFilter,
  counts,
  isOpen = false,
  onClose
}) => {
  const [collapsedSections, setCollapsedSections] = useState({
    categories: false,
    countries: true,
    languages: true,
  });

  const toggleSection = (section: 'categories' | 'countries' | 'languages') => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Sort helper to sort dictionary keys by count descending or alphabetically
  const getSortedKeys = (dict: Record<string, any>, countMap: Record<string, number>) => {
    return Object.keys(dict).sort((a, b) => {
      // Primary: count descending
      const countDiff = (countMap[b] || 0) - (countMap[a] || 0);
      if (countDiff !== 0) return countDiff;
      // Secondary: alphabetical name
      const nameA = typeof dict[a] === 'string' ? dict[a] : dict[a].name;
      const nameB = typeof dict[b] === 'string' ? dict[b] : dict[b].name;
      return nameA.localeCompare(nameB);
    });
  };

  return (
    <aside className={`sidebar glass-panel ${isOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="logo-section">
        <Tv className="logo-icon" size={28} />
        <div>
          <h1 className="logo-text">Catalogo TVIP</h1>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            IPTV Player & Catalog
          </span>
        </div>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} title="Cerrar menú">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation Menus */}
      <div className="nav-menu">
        {/* General Options */}
        <div
          className={`nav-item ${activeFilter.type === 'all' ? 'active' : ''}`}
          onClick={() => onSelectFilter({ type: 'all' })}
        >
          <div className="nav-item-content">
            <List size={18} />
            <span>Todos los Canales</span>
          </div>
          <span className="nav-badge">{counts.all}</span>
        </div>

        <div
          className={`nav-item ${activeFilter.type === 'favorites' ? 'active' : ''}`}
          onClick={() => onSelectFilter({ type: 'favorites' })}
        >
          <div className="nav-item-content">
            <Heart size={18} />
            <span>Mis Favoritos</span>
          </div>
          <span className="nav-badge">{counts.favorites}</span>
        </div>

        {/* Categories Section */}
        <div>
          <div
            className="nav-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => toggleSection('categories')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Folder size={14} /> Categorías
            </span>
            {collapsedSections.categories ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>

          {!collapsedSections.categories && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', marginTop: '4px' }}>
              {getSortedKeys(categories, counts.categories).map(catId => {
                const isActive = activeFilter.type === 'category' && activeFilter.value === catId;
                const count = counts.categories[catId] || 0;
                if (count === 0) return null;

                return (
                  <div
                    key={catId}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectFilter({ type: 'category', value: catId })}
                    style={{ padding: '8px 12px', borderRadius: '8px' }}
                  >
                    <span style={{ fontSize: '0.85rem' }}>{categories[catId]}</span>
                    <span className="nav-badge" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Countries Section */}
        <div>
          <div
            className="nav-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => toggleSection('countries')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} /> Países
            </span>
            {collapsedSections.countries ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>

          {!collapsedSections.countries && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', marginTop: '4px' }}>
              {getSortedKeys(countries, counts.countries).map(countryCode => {
                const isActive = activeFilter.type === 'country' && activeFilter.value === countryCode;
                const count = counts.countries[countryCode] || 0;
                if (count === 0) return null;

                const country = countries[countryCode];
                return (
                  <div
                    key={countryCode}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectFilter({ type: 'country', value: countryCode })}
                    style={{ padding: '8px 12px', borderRadius: '8px' }}
                  >
                    <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{country.flag}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {country.name}
                      </span>
                    </span>
                    <span className="nav-badge" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Languages Section */}
        <div>
          <div
            className="nav-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => toggleSection('languages')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Languages size={14} /> Idiomas
            </span>
            {collapsedSections.languages ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>

          {!collapsedSections.languages && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', marginTop: '4px' }}>
              {getSortedKeys(languages, counts.languages).map(langCode => {
                const isActive = activeFilter.type === 'language' && activeFilter.value === langCode;
                const count = counts.languages[langCode] || 0;
                if (count === 0) return null;

                return (
                  <div
                    key={langCode}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectFilter({ type: 'language', value: langCode })}
                    style={{ padding: '8px 12px', borderRadius: '8px' }}
                  >
                    <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{languages[langCode]}</span>
                    <span className="nav-badge" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
