'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from './theme';
import { SourceManagerDrawer } from './source-manager';
import { HistoryPanel } from './history-panel';
import { requestShowDownloadManager } from './download-manager';
import { Icon, type IconName } from './icon';
import { SearchHistoryDropdown, useSearchHistory } from './search-history';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/**
 * 方案④「侧栏影院」外壳：
 * - 桌面（lg+）：左侧固定侧栏（logo / 影视库 / 我的 / 主题与用户卡），右侧顶部搜索条。
 * - 移动端：顶部精简条（logo + 可展开搜索 + 图标），底部固定 Tab 栏。
 * 各页面根容器需加 `lg:pl-60`（桌面给侧栏留位）与 `pb-16 lg:pb-0`（移动给底栏留位）。
 */
export function Header({ showSearch = false }: { showSearch?: boolean }) {
  return (
    <Suspense fallback={null}>
      <HeaderInner showSearch={showSearch} />
    </Suspense>
  );
}

function HeaderInner({ showSearch: _showSearch }: { showSearch: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cat = searchParams.get('cat') || '';
  const isSearch = Boolean(searchParams.get('s'));

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchHistory = useSearchHistory(query);

  const envSources = useAppStore((s) => s.envSources);
  const customAPIs = useAppStore((s) => s.customAPIs);
  const sourceCount = envSources.length + customAPIs.length;

  const submitSearch = (text: string) => {
    const q = text.trim().slice(0, 100);
    if (!q) return;
    searchHistory.close();
    setMobileSearchOpen(false);
    router.push(`/?s=${encodeURIComponent(q)}`, { scroll: false });
    searchHistory.record(q);
  };

  const pickHistory = (text: string) => {
    setQuery(text);
    submitSearch(text);
  };

  const navActive = (key: string) => {
    if (key === 'home') return pathname === '/' && !cat && !isSearch;
    if (key === 'movie') return pathname === '/' && cat === 'movie';
    if (key === 'tv') return pathname === '/' && cat === 'tv';
    if (key === 'show') return pathname === '/' && cat === 'show';
    if (key === 'live') return pathname === '/live';
    return false;
  };

  return (
    <>
      {/* ===== 桌面侧栏 ===== */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-surface/90 backdrop-blur border-r border-line z-40">
        <Link href="/" aria-label="鲸鱼TV 首页" className="h-16 flex items-center gap-2.5 px-5 shrink-0 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="鲸鱼TV" className="w-8 h-8 rounded-full transition-transform group-hover:scale-105" />
          <span className="text-lg font-bold text-content">鲸鱼TV</span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
          <p className="px-3.5 pt-3 pb-2 text-[11px] font-semibold tracking-[0.18em] text-faint">影视库</p>
          <SideLink href="/" icon="home" label="首页" active={navActive('home')} />
          <SideLink href="/?cat=movie" icon="film" label="电影" active={navActive('movie')} />
          <SideLink href="/?cat=tv" icon="tv" label="剧集" active={navActive('tv')} />
          <SideLink href="/?cat=show" icon="mic" label="综艺" active={navActive('show')} />
          <SideLink href="/live" icon="broadcast" label="直播" active={navActive('live')} />

          <p className="px-3.5 pt-5 pb-2 text-[11px] font-semibold tracking-[0.18em] text-faint">我的</p>
          <SideButton icon="clock" label="观看历史" onClick={() => setHistoryOpen(true)} />
          <SideButton icon="download" label="下载管理" onClick={requestShowDownloadManager} />
          <SideButton icon="gear" label="设置" onClick={() => setSettingsOpen(true)} />
        </nav>

        <div className="px-3 pb-4">
          <div className="flex items-center gap-2 px-2 pb-3">
            <ThemeToggle />
            <Link
              href="/about"
              className={cn(
                'ml-auto px-3 py-1.5 rounded-lg text-xs transition-colors',
                pathname === '/about' ? 'text-accent bg-accent/10' : 'text-muted hover:text-content hover:bg-hover'
              )}
            >
              关于
            </Link>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-chip/70 px-3 py-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5bd8ff] to-[#0096c4] flex items-center justify-center text-[#04121d] font-bold text-sm shrink-0">
              鲸
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-content truncate">鲸鱼TV会员</div>
              <div className="text-[11px] text-faint truncate">{sourceCount} 个点播源 · 直播已开启</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== 顶部条（右栏 / 移动）===== */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-line">
        <div className="h-16 flex items-center gap-3 px-4">
          {/* 移动 logo（桌面由侧栏承载） */}
          <Link href="/" aria-label="鲸鱼TV 首页" className="lg:hidden flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-512.png" alt="鲸鱼TV" className="w-7 h-7 rounded-full" />
            <span className="text-base font-semibold text-content">鲸鱼TV</span>
          </Link>

          {/* 桌面搜索框：始终显示 */}
          <form
            className="hidden lg:flex flex-1 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(query);
            }}
          >
            <div ref={searchHistory.containerRef} className="relative w-full">
              <input
                className={cn(
                  'input w-full h-10 pl-10',
                  searchHistory.visible && 'rounded-b-none border-accent border-b-line bg-surface-raised focus-visible:ring-0'
                )}
                aria-label="搜索影片"
                placeholder="搜索片名 / 导演 / 演员..."
                value={query}
                maxLength={100}
                onChange={(e) => {
                  setQuery(e.target.value);
                  searchHistory.resetActive();
                }}
                onFocus={searchHistory.onFocus}
                onKeyDown={(e) => searchHistory.onKeyDown(e, pickHistory)}
              />
              <Icon name="search" className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchHistory.visible && (
                <SearchHistoryDropdown
                  id="header-search-history"
                  matches={searchHistory.matches}
                  activeIndex={searchHistory.activeIndex}
                  onPick={pickHistory}
                  onRemove={searchHistory.remove}
                  onClearAll={searchHistory.clearAll}
                />
              )}
            </div>
          </form>

          {/* 移动搜索展开态 */}
          {mobileSearchOpen && (
            <form
              className="lg:hidden flex-1 flex items-center"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(query);
              }}
            >
              <div ref={searchHistory.containerRef} className="relative w-full">
                <input
                  autoFocus
                  className={cn(
                    'input w-full h-10 pl-10',
                    searchHistory.visible && 'rounded-b-none border-accent border-b-line bg-surface-raised focus-visible:ring-0'
                  )}
                  aria-label="搜索影片"
                  placeholder="输入影片名称..."
                  value={query}
                  maxLength={100}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    searchHistory.resetActive();
                  }}
                  onFocus={searchHistory.onFocus}
                  onKeyDown={(e) => searchHistory.onKeyDown(e, pickHistory)}
                />
                <Icon name="search" className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchHistory.visible && (
                  <SearchHistoryDropdown
                    id="header-search-history-mobile"
                    matches={searchHistory.matches}
                    activeIndex={searchHistory.activeIndex}
                    onPick={pickHistory}
                    onRemove={searchHistory.remove}
                    onClearAll={searchHistory.clearAll}
                  />
                )}
              </div>
              <button
                type="button"
                className="shrink-0 ml-2 text-sm text-muted hover:text-content"
                onClick={() => {
                  setMobileSearchOpen(false);
                  searchHistory.close();
                }}
              >
                取消
              </button>
            </form>
          )}

          {/* 右侧图标 */}
          {!mobileSearchOpen && (
            <div className="flex items-center gap-0.5 ml-auto">
              <button
                type="button"
                className="lg:hidden p-2 rounded-lg text-muted hover:text-content hover:bg-hover transition-colors"
                aria-label="搜索"
                onClick={() => setMobileSearchOpen(true)}
              >
                <Icon name="search" className="w-5 h-5" />
              </button>
              <ThemeToggle />
              <IconButton label="观看历史" onClick={() => setHistoryOpen(true)}>
                <Icon name="clock" className="w-5 h-5" />
              </IconButton>
              <IconButton label="下载管理" onClick={requestShowDownloadManager}>
                <Icon name="download" className="w-5 h-5" />
              </IconButton>
              <IconButton label="设置" onClick={() => setSettingsOpen(true)}>
                <Icon name="gear" className="w-5 h-5" />
              </IconButton>
            </div>
          )}
        </div>
      </header>

      {/* ===== 移动底部 Tab 栏 ===== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line">
        <div className="h-16 grid grid-cols-4">
          <TabItem href="/" icon="home" label="首页" active={navActive('home')} />
          <TabItem href="/?cat=movie" icon="film" label="电影" active={navActive('movie')} />
          <TabItem href="/live" icon="broadcast" label="直播" active={navActive('live')} />
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-1 text-[11px] text-muted"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="user" className="w-[22px] h-[22px]" />
            我的
          </button>
        </div>
      </nav>

      <SourceManagerDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}

function SideLink({ href, icon, label, active }: { href: string; icon: IconName; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-colors mb-0.5',
        active ? 'text-accent bg-accent/10' : 'text-muted hover:text-content hover:bg-hover'
      )}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-accent" />}
      <Icon name={icon} className="w-5 h-5 shrink-0" />
      {label}
    </Link>
  );
}

function SideButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium text-muted hover:text-content hover:bg-hover transition-colors mb-0.5"
    >
      <Icon name={icon} className="w-5 h-5 shrink-0" />
      {label}
    </button>
  );
}

function TabItem({ href, icon, label, active }: { href: string; icon: IconName; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
        active ? 'text-accent' : 'text-muted hover:text-content'
      )}
    >
      <Icon name={icon} className="w-[22px] h-[22px]" />
      {label}
    </Link>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="p-2 rounded-lg text-muted hover:text-content hover:bg-hover transition-colors"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
