import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {periods} from '../src/core.js';
import {QUERY_TTL_MS} from '../src/freshness.js';

const mocks=vi.hoisted(()=>({queryPageRows:vi.fn(),gsc:vi.fn(),landingEvidence:vi.fn()}));
vi.mock('../src/google.js',()=>({...mocks,queryRows:vi.fn(),pageSegments:vi.fn()}));
vi.mock('../src/analytics.js',()=>({analyticsProvider:()=>({landingEvidence:mocks.landingEvidence}),configuredOutcomeEvents:vi.fn()}));
const {findQueryPageDrift,clearQueryRowCache,cacheStatus,refreshEvidence}=await import('../src/service.js');
let dir:string;
const row=(url:string)=>({query:'cms guide',url,clicks:5,impressions:100,ctr:.05,position:5});
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'query-page-drift-'));
  for(const [key,value]of Object.entries({PAGE_EVIDENCE_DATA_DIR:dir,PAGE_EVIDENCE_PROFILE:'drift-test',SITE_DOMAIN:'example.test',GSC_PROPERTY:'sc-domain:example.test',ANALYTICS_PROVIDER:'none',REPORTING_LAG_DAYS:'3',GSC_ROW_CAP:'5000'}))vi.stubEnv(key,value);
  vi.clearAllMocks();clearQueryRowCache();
  mocks.queryPageRows.mockReset().mockImplementation(async(_c,period)=>({rows:[row(period.start===periods(3,30).current.start?'/new':'/old')],truncated:false}));
  mocks.gsc.mockResolvedValue({rows:[],truncated:false});
  mocks.landingEvidence.mockResolvedValue({provider:'none',rows:[],sourceSummaries:[],metricLabels:{},coverage:{complete:true,limitations:[]}});
});
afterEach(()=>{clearQueryRowCache();vi.unstubAllEnvs();vi.useRealTimers();fs.rmSync(dir,{recursive:true,force:true})});

describe('query/page drift orchestration',()=>{
  it.each(['ga4','matomo','engage','none'])('returns GSC-only evidence with instance identity in a %s profile',async provider=>{
    vi.stubEnv('ANALYTICS_PROVIDER',provider);
    const result=await findQueryPageDrift();
    expect(result).toMatchObject({profile:'drift-test',site:{domain:'example.test',gscProperty:'sc-domain:example.test'},analyticsProvider:provider,identity:{version:1},source:{provider:'gsc',analyticsUsed:false,timezone:'America/Los_Angeles'},windowDays:30});
    expect(result.candidates[0].state).toBe('leading_page_changed');
    expect(mocks.landingEvidence).not.toHaveBeenCalled();expect(mocks.gsc).not.toHaveBeenCalled();expect(mocks.queryPageRows).toHaveBeenCalledTimes(2);
  });
  it('filters a selected query, trims only outer whitespace and does not reuse discovery as an exact-query response',async()=>{
    await findQueryPageDrift();const result=await findQueryPageDrift({query:' cms guide '});
    expect(mocks.queryPageRows).toHaveBeenCalledTimes(4);
    expect(mocks.queryPageRows.mock.calls[2][2]).toBe('cms guide');
    expect(result.selection).toMatchObject({mode:'exact_query',query:'cms guide',observed:true});
    await findQueryPageDrift({query:'cms guide'});expect(mocks.queryPageRows).toHaveBeenCalledTimes(4);
  });
  it('retains fetch timestamps on cache hits, expires at the boundary, and refreshes explicitly',async()=>{
    const first=await findQueryPageDrift();vi.setSystemTime(Date.now()+1000);
    const cached=await findQueryPageDrift();expect(cached.freshness.current).toMatchObject({cached:true,ageSeconds:1});expect(cached.coverage.current.fetchedAt).toBe(first.coverage.current.fetchedAt);
    expect(cacheStatus().queryPageCache.entries).toBe(2);
    vi.setSystemTime(Date.parse(first.coverage.current.fetchedAt)+QUERY_TTL_MS);
    await findQueryPageDrift();expect(mocks.queryPageRows).toHaveBeenCalledTimes(4);
    await findQueryPageDrift({refresh:true});expect(mocks.queryPageRows).toHaveBeenCalledTimes(6);
    await refreshEvidence();expect(cacheStatus().queryPageCache.entries).toBe(0);
  });
  it('isolates caches by exact configuration and reporting window',async()=>{
    await findQueryPageDrift();vi.stubEnv('GSC_PROPERTY','https://example.test/');await findQueryPageDrift();
    vi.stubEnv('GSC_ROW_CAP','100');await findQueryPageDrift();
    await findQueryPageDrift({windowDays:7});expect(mocks.queryPageRows).toHaveBeenCalledTimes(8);
    expect(mocks.queryPageRows.mock.calls[6][1]).toEqual(periods(3,7).current);
    expect(mocks.landingEvidence).not.toHaveBeenCalled();
  });
  it('reports capped periods and output bounds without calling them complete',async()=>{
    mocks.queryPageRows.mockImplementation(async(_c,period)=>({rows:[row(period.start===periods(3,30).current.start?'/new':'/old')],truncated:period.start===periods(3,30).current.start}));
    const result=await findQueryPageDrift({limit:1,pageLimit:2});
    expect(result.coverage).toMatchObject({resultLimit:1,pageLimit:2,queriesReturned:1,boundedTopRows:true,current:{capReached:true,fetchedRows:1},previous:{capReached:false}});
    expect(result.limitations.join(' ')).toContain('omit low-volume queries');
  });
  it('propagates provider failures and retries a failed period instead of caching a rejection',async()=>{
    mocks.queryPageRows.mockRejectedValueOnce(Error('Synthetic GSC failure'));
    await expect(findQueryPageDrift()).rejects.toThrow('Synthetic GSC failure');
    await findQueryPageDrift();expect(mocks.queryPageRows).toHaveBeenCalledTimes(3);
  });
  it.each([{windowDays:14},{limit:0},{limit:21},{pageLimit:1},{pageLimit:21},{query:''},{query:'   '},{query:'x'.repeat(201)}])('rejects invalid input before any fetch: %j',async input=>{
    await expect(findQueryPageDrift(input)).rejects.toThrow();expect(mocks.queryPageRows).not.toHaveBeenCalled();
  });
  it('keeps the site-query cache bounded across many selected queries',async()=>{
    for(let n=0;n<8;n++)await findQueryPageDrift({query:`query ${n}`});
    expect(cacheStatus().queryPageCache.entries).toBe(10);
  });
});
