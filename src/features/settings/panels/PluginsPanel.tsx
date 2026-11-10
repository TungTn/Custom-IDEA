import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  CheckCheck,
  Search,
  X,
  RefreshCw,
  Boxes,
  Star,
  ArrowDownToLine,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { SettingPanelProps } from './types';
import { MarketplacePlugin, InstalledPluginItem } from '../SettingsModal';
import { ThemeDefinition } from '../../../types/theme';
import { getAllThemes, saveCustomTheme, applyIdeTheme, MARKETPLACE_THEMES } from '../../../themes/themeManager';
import { usePluginStore } from '../../../stores/pluginStore';

export const PluginsPanel: React.FC<SettingPanelProps> = ({
  selectedId,
  updateSetting,
  setIsDirty,
  onShowToast,
}) => {
  const [pluginTab, setPluginTab] = useState<'marketplace' | 'installed'>('marketplace');
  const [pluginSearch, setPluginSearch] = useState('');
  const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([]);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(false);
  const [selectedMarketplacePlugin, setSelectedMarketplacePlugin] = useState<MarketplacePlugin | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<number | string | null>(null);

  // Installed Plugins Store (global reactive state)
  const {
    installedPlugins,
    installPlugin,
    uninstallPlugin,
    togglePlugin,
  } = usePluginStore();

  const mapPluginItem = (item: any): MarketplacePlugin => {
    const isPaid = item.paid === true || item.pricingModel === 'PAID';
    const isFreemium = item.pricingModel === 'FREEMIUM';
    const pricingModel = isFreemium ? 'FREEMIUM' : isPaid ? 'PAID' : 'FREE';
    const vendorName = item.vendorInfo?.name || item.vendor?.name || item.organization || 'JetBrains s.r.o.';
    const isVerified = item.vendorInfo?.isVerified ?? item.vendor?.isVerified ?? true;
    const previewText = item.preview || item.description?.replace(/<[^>]+>/g, '').slice(0, 240) || `${item.name} plugin for IntelliJ IDEA.`;

    let tags: string[] = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags.map((t: any) => typeof t === 'string' ? t : t?.name || '');
    } else if (typeof item.tags === 'string') {
      tags = [item.tags];
    } else {
      tags = ['Tools'];
    }

    return {
      id: item.id,
      xmlId: item.xmlId || String(item.id),
      name: item.name,
      preview: previewText,
      downloads: item.downloads || 0,
      pricingModel,
      icon: item.icon,
      rating: typeof item.rating === 'number' ? item.rating : undefined,
      tags,
      vendor: {
        name: vendorName,
        isVerified,
      },
    };
  };

  const getPluginIconUrl = (icon?: string) => {
    if (!icon) return '';
    if (icon.startsWith('http')) return icon;
    return `https://plugins.jetbrains.com${icon.startsWith('/') ? '' : '/'}${icon}`;
  };

  const fetchMarketplace = async (query = '') => {
    setIsMarketplaceLoading(true);
    let results: MarketplacePlugin[] = [];

    // 1. Primary: invoke Tauri Rust backend
    try {
      const data: any = await invoke('fetch_marketplace_plugins', { query: query.trim(), max: 20 });
      let list: any[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray(data.plugins)) {
        list = data.plugins;
      }
      if (list.length > 0) {
        results = list.map(mapPluginItem);
      }
    } catch (err) {
      console.warn('Tauri invoke fetch_marketplace_plugins:', err);
    }

    // 2. Secondary: direct browser fetch to plugins.jetbrains.com
    if (results.length === 0) {
      try {
        const url = query.trim() 
          ? `https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&search=${encodeURIComponent(query.trim())}&max=20`
          : `https://plugins.jetbrains.com/api/search/plugins?build=IU-241.14494.240&max=20`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          let list: any[] = [];
          if (Array.isArray(json)) {
            list = json;
          } else if (json && Array.isArray(json.plugins)) {
            list = json.plugins;
          }
          if (list.length > 0) {
            results = list.map(mapPluginItem);
          }
        }
      } catch (fetchErr) {
        console.warn('Direct fetch to plugins.jetbrains.com:', fetchErr);
      }
    }

    setMarketplacePlugins(results);
    if (results.length > 0) {
      setSelectedMarketplacePlugin(prev => {
        if (!prev) return results[0];
        const match = results.find(p => p.id === prev.id);
        return match || results[0];
      });
    } else {
      setSelectedMarketplacePlugin(null);
    }
    setIsMarketplaceLoading(false);
  };

  useEffect(() => {
    if (!selectedMarketplacePlugin?.id) return;
    const pluginId = selectedMarketplacePlugin.id;

    let isMounted = true;
    const enrichDetails = async () => {
      try {
        let detailData: any = null;
        try {
          detailData = await invoke('fetch_plugin_details', { id: pluginId });
        } catch {
          const res = await fetch(`https://plugins.jetbrains.com/api/plugins/${pluginId}`);
          if (res.ok) detailData = await res.json();
        }

        if (isMounted && detailData && detailData.id === pluginId) {
          setSelectedMarketplacePlugin(curr => {
            if (!curr || curr.id !== pluginId) return curr;
            return {
              ...curr,
              icon: detailData.icon || curr.icon,
              preview: detailData.preview || (detailData.description ? detailData.description.replace(/<[^>]+>/g, '') : curr.preview),
              downloads: detailData.downloads || curr.downloads,
              rating: detailData.rating ?? curr.rating,
              pricingModel: detailData.pricingModel || curr.pricingModel,
            };
          });

          if (detailData.icon) {
            setMarketplacePlugins(prev => prev.map(p => p.id === pluginId ? { ...p, icon: detailData.icon } : p));
          }
        }
      } catch (err) {
        // Ignore details fetch error
      }
    };

    enrichDetails();
    return () => { isMounted = false; };
  }, [selectedMarketplacePlugin?.id]);

  useEffect(() => {
    if (selectedId === 'plugins' && pluginTab === 'marketplace' && marketplacePlugins.length === 0) {
      fetchMarketplace();
    }
  }, [selectedId, pluginTab]);

  const searchTimeoutRef = useRef<any>(null);
  const handleMarketplaceSearch = (val: string) => {
    setPluginSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchMarketplace(val);
    }, 400);
  };

  const isPluginInstalled = (id: number | string, name?: string) => {
    return installedPlugins.some(p => p.id === id || (name && p.name.toLowerCase() === name.toLowerCase()));
  };

  const handleInstallPlugin = async (plugin: MarketplacePlugin) => {
    setInstallingPluginId(plugin.id);
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    let localDownloadPath: string | undefined;
    if (isTauri) {
      try {
        const res = await invoke<{ success: boolean; plugin_id: number; name: string; local_path: string; is_theme: boolean; message: string }>(
          'download_and_install_plugin',
          { pluginId: plugin.id, pluginName: plugin.name }
        );
        localDownloadPath = res.local_path;
        onShowToast?.('Plugin Downloaded', res.message, 'success');
      } catch (err: any) {
        console.warn('download_and_install_plugin warning:', err);
      }
    }

    const newInstalled: InstalledPluginItem = {
      id: plugin.id,
      name: plugin.name,
      author: plugin.vendor?.name || 'JetBrains Marketplace',
      version: '1.0.0',
      desc: localDownloadPath ? `${plugin.preview || ''} (Saved: ${localDownloadPath})` : plugin.preview,
      installed: true,
      enabled: true,
      icon: plugin.icon ? `https://plugins.jetbrains.com${plugin.icon}` : undefined,
      downloads: plugin.downloads,
      rating: plugin.rating,
    };
    installPlugin(newInstalled);

    const pLower = plugin.name.toLowerCase();
    // Auto-detect theme plugins & register to active themes list
    const isThemePlugin = (Array.isArray(plugin.tags) ? plugin.tags.some((t: string) => t.toLowerCase().includes('theme')) : typeof plugin.tags === 'string' && (plugin.tags as string).toLowerCase().includes('theme')) || pLower.includes('theme');

    if (pLower.includes('sonar')) {
      onShowToast?.('SonarLint Activated', 'SonarQube quality gate & rules are now ready in the bottom panel!', 'success');
    } else if (pLower.includes('rainbow')) {
      onShowToast?.('Rainbow Brackets Activated', 'Rainbow brackets colorization is now active in the editor!', 'success');
    } else if (pLower.includes('key promoter')) {
      onShowToast?.('Key Promoter X Activated', 'Key Promoter X is now tracking mouse clicks and suggesting shortcuts!', 'success');
    } else if (pLower.includes('nyan')) {
      onShowToast?.('Nyan Progress Bar Activated', 'Nyan cat progress bar will appear during builds and runs!', 'success');
    } else if (pLower.includes('git')) {
      onShowToast?.('GitToolBox Activated', 'Git inline blame and branch sync status are now active!', 'success');
    } else if (isThemePlugin) {
      const preset = MARKETPLACE_THEMES.find(t =>
        plugin.name.toLowerCase().includes(t.name.toLowerCase()) ||
        t.name.toLowerCase().includes(plugin.name.toLowerCase()) ||
        plugin.id.toString() === t.id
      );
      const themeDef: ThemeDefinition = preset || {
        id: `plugin-${plugin.id}`,
        name: plugin.name,
        type: 'dark',
        description: plugin.preview || 'Installed theme from Marketplace',
        badge: 'Plugin',
        colors: {
          bgPrimary: '#1E1F22',
          bgSecondary: '#2B2D30',
          bgTertiary: '#26282B',
          bgHover: '#35373B',
          borderColor: '#393B40',
          textPrimary: '#DFE1E5',
          textSecondary: '#868A91',
          accentColor: '#3574F0',
          selectionBg: '#214283',
          statusBarBg: '#2B2D30',
          gutterBg: '#1E1F22',
          badgeBg: '#3574F022',
        },
        syntaxColors: {
          keyword: '#CC7832',
          string: '#6A8759',
          number: '#6897BB',
          function: '#FFC66D',
          comment: '#7A7E85',
          type: '#299999',
          variable: '#9876AA',
          operator: '#A9B7C6',
          annotation: '#BBB529',
        }
      };
      saveCustomTheme(themeDef);
      updateSetting('theme', themeDef.id);
      applyIdeTheme(themeDef.id);
      onShowToast?.('Theme Installed & Applied', `Theme "${plugin.name}" is now active!`, 'success');
    } else {
      if (!localDownloadPath) {
        onShowToast?.('Plugin Installed', `${plugin.name} installed successfully`, 'success');
      }
    }

    setInstallingPluginId(null);
    setIsDirty(true);
  };

  const handleUninstallPlugin = (id: number | string, name: string) => {
    uninstallPlugin(id);
    onShowToast?.('Plugin Uninstalled', `${name} uninstalled`, 'info');
    setIsDirty(true);
  };

  const formatDownloads = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  if (selectedId !== 'plugins') return null;

  return (
    <div className="flex flex-col h-full -m-6 p-6">
      {/* Header bar with Marketplace / Installed tabs */}
      <div className="flex items-center justify-between border-b border-[#393B40] pb-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPluginTab('marketplace')}
            className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
              pluginTab === 'marketplace' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'
            }`}
          >
            <Globe size={13} />
            Marketplace
          </button>
          <button
            onClick={() => setPluginTab('installed')}
            className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
              pluginTab === 'installed' ? 'bg-[#3574F0] text-white font-medium' : 'text-[#868A91] hover:text-white'
            }`}
          >
            <CheckCheck size={13} />
            Installed ({installedPlugins.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#2B2D30] border border-[#393B40] focus-within:border-[#3574F0] rounded px-2.5 py-1">
            <Search size={12} className="text-[#868A91]" />
            <input
              type="text"
              placeholder={pluginTab === 'marketplace' ? "Search JetBrains Marketplace..." : "Search installed plugins..."}
              value={pluginSearch}
              onChange={(e) => {
                if (pluginTab === 'marketplace') {
                  handleMarketplaceSearch(e.target.value);
                } else {
                  setPluginSearch(e.target.value);
                }
              }}
              className="bg-transparent text-xs text-[#DFE1E5] outline-none w-52 placeholder:text-[#868A91]"
            />
            {pluginSearch && (
              <button onClick={() => { setPluginSearch(''); if (pluginTab === 'marketplace') fetchMarketplace(''); }} className="text-[#868A91] hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>
          {pluginTab === 'marketplace' && (
            <button
              onClick={() => fetchMarketplace(pluginSearch)}
              className="p-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#868A91] hover:text-white rounded border border-[#393B40]"
              title="Reload from JetBrains Marketplace"
            >
              <RefreshCw size={13} className={isMarketplaceLoading ? 'animate-spin text-[#3574F0]' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Main Master-Detail Split Pane for Plugins */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left: Plugin List */}
        <div className="w-[380px] flex flex-col border border-[#393B40] rounded-lg bg-[#26282B] overflow-hidden">
          <div className="h-7 bg-[#212226] border-b border-[#393B40] px-3 flex items-center justify-between text-[11px] text-[#868A91] font-semibold uppercase">
            <span>{pluginTab === 'marketplace' ? 'Marketplace Plugins' : 'Installed Plugins'}</span>
            {pluginTab === 'marketplace' && (
              <span className="text-[10px] text-[#3574F0] normal-case flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" /> plugins.jetbrains.com
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#393B40]/50">
            {pluginTab === 'marketplace' ? (
              isMarketplaceLoading && marketplacePlugins.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#868A91] space-y-2">
                  <RefreshCw size={20} className="animate-spin text-[#3574F0] mx-auto" />
                  <p>Connecting to JetBrains Marketplace...</p>
                </div>
              ) : marketplacePlugins.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#868A91]">
                  No plugins found matching "{pluginSearch}"
                </div>
              ) : (
                marketplacePlugins.map((plugin) => {
                  const isInstalled = isPluginInstalled(plugin.id, plugin.name);
                  const isSelected = selectedMarketplacePlugin?.id === plugin.id;
                  const isInstalling = installingPluginId === plugin.id;

                  return (
                    <div
                      key={plugin.id}
                      onClick={() => setSelectedMarketplacePlugin(plugin)}
                      className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#2E436E]' : 'hover:bg-[#35373B]'
                      }`}
                    >
                      {/* Plugin Icon */}
                      <div className="w-9 h-9 rounded-md bg-[#1E1F22] border border-[#393B40] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {plugin.icon ? (
                          <img 
                            src={getPluginIconUrl(plugin.icon)} 
                            alt={plugin.name}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Boxes size={18} className="text-[#3574F0]" />
                        )}
                      </div>

                      {/* Plugin Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-white truncate">{plugin.name}</div>
                          {plugin.pricingModel && plugin.pricingModel !== 'FREE' && (
                            <span className="text-[10px] text-[#EDA200] px-1 bg-[#EDA200]/10 rounded border border-[#EDA200]/30 font-medium">
                              {plugin.pricingModel}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-[#868A91] truncate">
                          by {plugin.vendor?.name || 'JetBrains'}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[10.5px] text-[#868A91]">
                          <span className="flex items-center gap-0.5 text-[#EDA200]">
                            <Star size={11} fill="#EDA200" />
                            {plugin.rating ? plugin.rating.toFixed(1) : '4.8'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <ArrowDownToLine size={10} />
                            {formatDownloads(plugin.downloads)}
                          </span>
                        </div>
                      </div>

                      {/* Install Button */}
                      <div>
                        {isInstalled ? (
                          <span className="text-[10.5px] text-[#59A869] font-medium bg-[#59A869]/10 px-2 py-0.5 rounded border border-[#59A869]/30 flex items-center gap-0.5">
                            <Check size={11} /> Installed
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInstallPlugin(plugin);
                            }}
                            disabled={isInstalling}
                            className="px-2.5 py-1 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-50 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                          >
                            {isInstalling ? <RefreshCw size={11} className="animate-spin" /> : null}
                            Install
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* Installed Plugins List */
              installedPlugins
                .filter(p => !pluginSearch || p.name.toLowerCase().includes(pluginSearch.toLowerCase()) || p.desc.toLowerCase().includes(pluginSearch.toLowerCase()))
                .map((plugin) => (
                  <div
                    key={plugin.id}
                    className="p-2.5 flex items-start gap-2.5 hover:bg-[#35373B] transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-[#1E1F22] border border-[#393B40] flex items-center justify-center text-[#3574F0] flex-shrink-0">
                      <Boxes size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{plugin.name}</div>
                      <div className="text-[11px] text-[#868A91]">v{plugin.version} • by {plugin.author}</div>
                      <p className="text-[11px] text-[#868A91] mt-0.5 line-clamp-1">{plugin.desc}</p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => togglePlugin(plugin.id)}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                          plugin.enabled 
                            ? 'text-[#59A869] bg-[#59A869]/10 border-[#59A869]/30' 
                            : 'text-[#868A91] bg-[#393B40]/20 border-[#393B40]'
                        }`}
                      >
                        {plugin.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => handleUninstallPlugin(plugin.id, plugin.name)}
                        className="p-1 text-[#868A91] hover:text-[#E05555] rounded hover:bg-[#2B2D30]"
                        title="Uninstall"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Right: Plugin Detail View (JetBrains Plugin Marketplace Detail Header & Body) */}
        <div className="flex-1 border border-[#393B40] rounded-lg bg-[#26282B] p-5 flex flex-col overflow-y-auto">
          {selectedMarketplacePlugin ? (
            <div className="space-y-4">
              {/* Detail Header */}
              <div className="flex items-start gap-4 pb-4 border-b border-[#393B40]">
                <div className="w-14 h-14 rounded-lg bg-[#1E1F22] border border-[#393B40] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {selectedMarketplacePlugin.icon ? (
                    <img 
                      src={getPluginIconUrl(selectedMarketplacePlugin.icon)} 
                      alt={selectedMarketplacePlugin.name}
                      className="w-full h-full object-contain p-1.5"
                    />
                  ) : (
                    <Boxes size={28} className="text-[#3574F0]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedMarketplacePlugin.name}</span>
                    {selectedMarketplacePlugin.pricingModel && (
                      <span className="text-[10.5px] font-normal px-2 py-0.5 rounded bg-[#3574F0]/20 text-[#85B1F8] border border-[#3574F0]/30">
                        {selectedMarketplacePlugin.pricingModel}
                      </span>
                    )}
                  </h3>

                  <div className="text-xs text-[#3574F0] flex items-center gap-1 mt-0.5 hover:underline cursor-pointer">
                    <span>{selectedMarketplacePlugin.vendor?.name || 'JetBrains'}</span>
                    <ExternalLink size={11} />
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-[#868A91]">
                    <span className="flex items-center gap-1 text-[#EDA200]">
                      <Star size={13} fill="#EDA200" />
                      {selectedMarketplacePlugin.rating ? selectedMarketplacePlugin.rating.toFixed(2) : '4.80'}
                    </span>
                    <span>•</span>
                    <span>{formatDownloads(selectedMarketplacePlugin.downloads)} downloads</span>
                    <span>•</span>
                    <span className="text-[#59A869]">Compatible with IntelliJ IDEA 2024.1+</span>
                  </div>
                </div>

                <div>
                  {isPluginInstalled(selectedMarketplacePlugin.id, selectedMarketplacePlugin.name) ? (
                    <button
                      onClick={() => handleUninstallPlugin(selectedMarketplacePlugin.id, selectedMarketplacePlugin.name)}
                      className="px-4 py-1.5 bg-[#35373B] hover:bg-[#3E4146] text-[#E05555] rounded text-xs font-medium border border-[#43454A] transition-colors"
                    >
                      Uninstall
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstallPlugin(selectedMarketplacePlugin)}
                      disabled={installingPluginId === selectedMarketplacePlugin.id}
                      className="px-5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] disabled:opacity-50 text-white rounded text-xs font-medium shadow transition-colors flex items-center gap-1.5"
                    >
                      {installingPluginId === selectedMarketplacePlugin.id ? <RefreshCw size={13} className="animate-spin" /> : null}
                      Install
                    </button>
                  )}
                </div>
              </div>

              {/* Detail Body */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white uppercase tracking-wider">Description</div>
                <p className="text-xs text-[#C4C7C5] leading-relaxed whitespace-pre-wrap">
                  {selectedMarketplacePlugin.preview || 'No description provided.'}
                </p>

                {selectedMarketplacePlugin.tags && (
                  <div className="pt-3 border-t border-[#393B40] flex flex-wrap gap-1.5">
                    {(Array.isArray(selectedMarketplacePlugin.tags) 
                      ? selectedMarketplacePlugin.tags 
                      : String(selectedMarketplacePlugin.tags).split(' ')
                    ).map((t, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-[#1E1F22] border border-[#393B40] text-[11px] text-[#868A91]">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-xs text-[#868A91]">
              <Boxes size={32} className="text-[#393B40] mb-2" />
              <span>Select a plugin from the list to view JetBrains Marketplace details</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
