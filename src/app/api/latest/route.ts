import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/api-guard';
import { cmsRequestHeaders, parseSearchList, filterAdultResults } from '@/lib/cms-parser';
import { fetchUpstream, getCache, setCache } from '@/lib/fetch-utils';
import { checkUpstreamAllowed } from '@/lib/ssrf';
import type { SearchResultItem, SourceConfig } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * 最新影片：聚合所选点播源 ac=list（最新入库第一页）并展示海报。
 * 注意：这 4 个源的 ac=list 只返回精简字段（无 vod_pic），
 * 因此对每源再发一次 ac=detail&ids= 批量请求补全海报地址。
 * 单源失败不影响整体；detail 失败则保留无海报的基础条目（不影响播放）。
 */
const CACHE_TTL = 10 * 60 * 1000; // 与上游实时同步：服务端缓存 10 分钟，前端定期刷新

interface LatestBody {
  sources?: SourceConfig[];
  filterAdult?: boolean;
}

/** 拉取单源最新影片并尽力补全海报 */
async function fetchLatestWithPoster(source: SourceConfig): Promise<SearchResultItem[]> {
  if (!/^https?:\/\//.test(source.url || '')) return [];
  const verdict = await checkUpstreamAllowed(source.url);
  if (!verdict.ok) return [];

  const base = source.url.replace(/\/+$/, '');
  const headers = cmsRequestHeaders();

  // 1) ac=list 拿最新入库（精简字段）
  let items: SearchResultItem[] = [];
  try {
    const listRes = await fetchUpstream(`${base}?ac=list&pg=1`, { timeoutMs: 8000, headers });
    if (!listRes.ok) return [];
    const data = await listRes.json();
    items = parseSearchList(data, source);
  } catch {
    return [];
  }
  if (items.length === 0) return items;

  // 2) ac=detail&ids= 批量补海报（失败不致命）
  try {
    const ids = items.map((i) => i.vodId).join(',');
    const detailRes = await fetchUpstream(`${base}?ac=detail&ids=${encodeURIComponent(ids)}`, {
      timeoutMs: 8000,
      headers,
    });
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      const dl = (detailData as { list?: unknown }).list;
      const byId = new Map<string, string>();
      if (Array.isArray(dl)) {
        for (const v of dl) {
          const record = v as Record<string, unknown>;
          const id = String(record.vod_id ?? '');
          if (id && typeof record.vod_pic === 'string' && record.vod_pic) {
            byId.set(id, record.vod_pic);
          }
        }
      }
      if (byId.size > 0) {
        items = items.map((it) => (byId.has(it.vodId) ? { ...it, pic: byId.get(it.vodId) } : it));
      }
    }
  } catch {
    // detail 失败则保留无海报条目
  }

  return items;
}

export async function POST(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  let body: LatestBody;
  try {
    body = (await req.json()) as LatestBody;
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const sources = (body.sources ?? []).slice(0, 50);
  const filterAdult = body.filterAdult !== false;
  if (sources.length === 0) {
    return NextResponse.json({ list: [], failures: [] });
  }

  const cacheKey = `latest:${filterAdult ? 1 : 0}\n${sources.map((s) => s.url.replace(/\/+$/, '')).sort().join('|')}`;
  const cached = getCache<SearchResultItem[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ list: cached });
  }

  const outcomes = await Promise.all(
    sources.map(async (source) => {
      const list = await fetchLatestWithPoster(source);
      return { ok: list.length > 0, list };
    })
  );

  let list = outcomes.flatMap((o) => o.list);
  if (filterAdult) list = filterAdultResults(list, filterAdult);
  const failures = outcomes
    .filter((o) => !o.ok)
    .map((o, i) => ({ sourceKey: sources[i].key, error: '请求失败' }));

  setCache(cacheKey, list, CACHE_TTL);
  return NextResponse.json({ list, failures });
}
