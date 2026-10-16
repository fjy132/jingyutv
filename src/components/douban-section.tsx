'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { DoubanItem } from '@/lib/types';
import { DoubanCard } from './video-card';
import { SmartImage } from './smart-image';
import { Icon } from './icon';

const MOVIE_TAGS = ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动画'];
const TV_TAGS = ['热门', '美剧', '英剧', '韩剧', '日剧', '国产剧', '港剧', '日本动画', '综艺', '纪录片'];
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 首页推荐区：数据源由设置决定（豆瓣热门 / Bangumi 新番放送 / 影视热榜），二选一展示 */
export function RecommendSection({ onPick }: { onPick: (title: string) => void }) {
  const doubanEnabled = useAppStore((s) => s.doubanEnabled);
  const recommendSource = useAppStore((s) => s.recommendSource);

  if (!doubanEnabled) return null;
  if (recommendSource === 'bangumi') return <BangumiView onPick={onPick} />;
  if (recommendSource === 'hot-list') return <HotListView onPick={onPick} />;
  return <DoubanView onPick={onPick} />;
}

/**
 * 豆瓣推荐：影视切换 + 标签筛选。
 * 一次性渲染全部条目：数据本就一次拉全（50 条），卡片图片又是 lazy 加载，
 * 视口外的图不会请求，因此不需要「加载更多」这类本地切片分页来打断浏览。
 */
function DoubanView({ onPick }: { onPick: (title: string) => void }) {
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [tag, setTag] = useState('热门');

  const query = useQuery({
    queryKey: ['douban', type, tag],
    queryFn: ({ signal }) => api.douban(type, tag, 0, 50, signal),
  });

  const tags = type === 'movie' ? MOVIE_TAGS : TV_TAGS;
  const items = query.data?.items ?? [];

  const switchType = (t: 'movie' | 'tv') => {
    if (t === type) return;
    setType(t);
    setTag('热门');
  };

  return (
    <section aria-label="影视推荐">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-chip rounded-lg p-0.5">
            <TypeButton active={type === 'movie'} onClick={() => switchType('movie')}>
              电影
            </TypeButton>
            <TypeButton active={type === 'tv'} onClick={() => switchType('tv')}>
              剧集
            </TypeButton>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tags.map((t) => (
          <button
            key={t}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs transition-colors',
              t === tag ? 'bg-accent text-on-accent' : 'bg-chip text-muted hover:text-content hover:bg-hover'
            )}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-faint py-8">该分类暂无推荐内容</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Bangumi 每日放送：星期筛选，一次拉全量无分页 */
function BangumiView({ onPick }: { onPick: (title: string) => void }) {
  const [weekday, setWeekday] = useState<number | 'all'>('all');

  const query = useQuery({
    queryKey: ['bangumi-calendar'],
    queryFn: ({ signal }) => api.bangumiCalendar(signal),
  });

  let items: DoubanItem[] = [];
  if (query.data) {
    items = weekday === 'all'
      ? query.data.days.flatMap((d) => d.items)
      : (query.data.days.find((d) => d.weekday === weekday)?.items ?? []);
  }

  return (
    <section aria-label="新番放送推荐">
      <div className="flex flex-wrap gap-1.5 mb-4">
        <ChipButton active={weekday === 'all'} onClick={() => setWeekday('all')}>
          全部
        </ChipButton>
        {WEEKDAYS.map((name, i) => (
          <ChipButton key={name} active={weekday === i + 1} onClick={() => setWeekday(i + 1)}>
            {name}
          </ChipButton>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

const HOT_LISTS: { id: string; name: string }[] = [
  { id: 'douban_movie_weekly', name: '电影周榜' },
  { id: 'douban_tv_chinese', name: '国产剧周榜' },
  { id: 'douban_tv_global', name: '海外剧周榜' },
  { id: 'douban_show_chinese', name: '国内综艺' },
  { id: 'douban_show_global', name: '海外综艺' },
  { id: 'baidu_teleplay', name: '百度热播剧' },
];

/** 侧栏「电影 / 剧集 / 综艺」分类 → 默认展开的榜单 */
const CAT_TO_LIST: Record<string, string> = {
  movie: 'douban_movie_weekly',
  tv: 'douban_tv_chinese',
  show: 'douban_show_chinese',
};

/** 榜单数据 5 小时内不重复拉取（与站点刷新频率对齐） */
const HOT_STALE = 5 * 60 * 60 * 1000;
/** 横滑预览每行展示的海报数，其余进「更多」完整榜单 */
const ROW_PREVIEW = 12;

/** 影视热榜：单个 Hero 精选 + 多榜单横滑；点「更多」进入完整榜单（约 50 部） */
function HotListView({ onPick }: { onPick: (title: string) => void }) {
  const searchParams = useSearchParams();
  const cat = searchParams.get('cat') || '';
  const [activeList, setActiveList] = useState<string | null>(CAT_TO_LIST[cat] || null);

  useEffect(() => {
    setActiveList(CAT_TO_LIST[cat] || null);
  }, [cat]);

  if (activeList) {
    const meta = HOT_LISTS.find((l) => l.id === activeList) ?? HOT_LISTS[0];
    return <FullListView meta={meta} onPick={onPick} onBack={() => setActiveList(null)} />;
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      <HeroSection onPick={onPick} />
      {HOT_LISTS.map((list) => (
        <HotRow key={list.id} list={list} onPick={onPick} onMore={() => setActiveList(list.id)} />
      ))}
    </div>
  );
}

/** 顶部单个静态 Hero（不轮播）：取电影周榜冠军做精选，点击进入搜索/播放链路 */
function HeroSection({ onPick }: { onPick: (title: string) => void }) {
  const imageProxyMode = useAppStore((s) => s.imageProxyMode);
  const customImageProxy = useAppStore((s) => s.customImageProxy);
  const [bgFailed, setBgFailed] = useState(false);

  const query = useQuery({
    queryKey: ['hot-list', 'douban_movie_weekly'],
    queryFn: ({ signal }) => api.hotList('douban_movie_weekly', signal),
    staleTime: HOT_STALE,
  });
  const item = query.data?.items?.[0];
  useEffect(() => setBgFailed(false), [item?.cover]);

  if (query.isLoading) {
    return <div className="rounded-2xl lg:rounded-[20px] h-[240px] lg:h-[340px] bg-chip animate-pulse" aria-hidden />;
  }
  if (query.isError || !item) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl lg:rounded-[20px] h-[240px] lg:h-[340px] bg-surface-raised shadow-lg">
      {item.cover && !bgFailed && (
        <SmartImage
          url={item.cover}
          mode={imageProxyMode}
          customProxy={customImageProxy}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-[1.06] blur-[2px] brightness-[0.7]"
          onExhausted={() => setBgFailed(true)}
        />
      )}
      {/* 压暗渐变：左侧 + 底部，保证文字清晰，明暗主题下均成立 */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="relative h-full flex flex-col justify-end p-5 lg:p-10 max-w-[640px]">
        <span className="inline-flex items-center gap-1.5 w-fit text-[11px] lg:text-xs font-semibold tracking-wider text-[#8fe6ff] bg-white/10 backdrop-blur px-2.5 py-1 rounded-full mb-3">
          <Icon name="sparkles" className="w-3.5 h-3.5" />
          本周精选 · 电影周榜冠军
        </span>
        <h1 className="text-2xl lg:text-[42px] leading-tight font-bold text-white drop-shadow-lg">
          {item.title}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-white/85 text-xs lg:text-sm">
          {item.rating && <span className="text-rating font-semibold">★ {item.rating}</span>}
          <span className="text-white/70">豆瓣热门 · 高分推荐</span>
        </div>
        <div className="mt-4 lg:mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onPick(item.title)}
            className="inline-flex items-center gap-1.5 h-10 lg:h-11 px-5 lg:px-6 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            <Icon name="play" className="w-4 h-4" />
            立即播放
          </button>
          <button
            type="button"
            onClick={() => onPick(item.title)}
            className="inline-flex items-center gap-1.5 h-10 lg:h-11 px-4 lg:px-5 rounded-xl text-sm font-medium text-white bg-white/15 backdrop-blur border border-white/25 hover:bg-white/25 transition-colors"
          >
            查看详情
          </button>
        </div>
      </div>
    </section>
  );
}

/** 单个榜单的横滑预览行 */
function HotRow({
  list,
  onPick,
  onMore,
}: {
  list: { id: string; name: string };
  onPick: (title: string) => void;
  onMore: () => void;
}) {
  const query = useQuery({
    queryKey: ['hot-list', list.id],
    queryFn: ({ signal }) => api.hotList(list.id, signal),
    staleTime: HOT_STALE,
  });
  const items = (query.data?.items ?? []).slice(0, ROW_PREVIEW);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-base lg:text-lg font-bold text-content">
          <span className="w-1 h-4 lg:h-5 rounded-full bg-accent" />
          {list.name}
        </h2>
        <button
          type="button"
          onClick={onMore}
          className="inline-flex items-center gap-0.5 text-xs lg:text-sm text-muted hover:text-accent transition-colors shrink-0"
        >
          更多 <span aria-hidden className="text-base leading-none">›</span>
        </button>
      </div>
      {query.isLoading ? (
        <RowSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-faint py-6">榜单加载失败，可稍后重试</p>
      ) : (
        <div className="flex gap-3 lg:gap-4 overflow-x-auto scrollbar-thin pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x">
          {items.map((item) => (
            <div key={item.id} className="snap-start flex-[0_0_auto] w-[124px] lg:w-[150px]">
              <DoubanCard item={item} onClick={() => onPick(item.title)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** 完整榜单（约 50 部网格），含返回 */
function FullListView({
  meta,
  onPick,
  onBack,
}: {
  meta: { id: string; name: string };
  onPick: (title: string) => void;
  onBack: () => void;
}) {
  const query = useQuery({
    queryKey: ['hot-list', meta.id],
    queryFn: ({ signal }) => api.hotList(meta.id, signal),
    staleTime: HOT_STALE,
  });
  const items = query.data?.items ?? [];

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 mb-4 text-sm text-muted hover:text-accent transition-colors"
      >
        <Icon name="undo" className="w-4 h-4" /> 返回首页
      </button>
      <h1 className="flex items-center gap-2.5 text-xl lg:text-2xl font-bold text-content mb-5">
        <span className="w-1.5 h-6 rounded-full bg-accent" />
        {meta.name}
      </h1>
      {query.isError ? (
        <p className="text-center text-sm text-faint py-10">榜单加载失败，可稍后重试</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 lg:gap-3">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 lg:gap-4 overflow-hidden pb-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex-[0_0_auto] w-[124px] lg:w-[150px]">
          <div className="aspect-[2/3] rounded-lg bg-chip animate-pulse" />
          <div className="h-3 mt-2 rounded bg-chip animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] rounded-lg bg-chip animate-pulse" />
          <div className="h-3 mt-2 rounded bg-chip animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cn(
        'px-2.5 py-1 rounded-full text-xs transition-colors',
        active ? 'bg-accent text-on-accent' : 'bg-chip text-muted hover:text-content hover:bg-hover'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TypeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cn('px-3.5 py-1.5 rounded-md text-sm transition-colors', active ? 'bg-accent text-on-accent' : 'text-muted hover:text-content')}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
