import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {QUERY_TTL_MS} from '../src/freshness.js';
const mocks=vi.hoisted(()=>({siteQueryRows:vi.fn(),gsc:vi.fn(),queryPageRows:vi.fn()}));
vi.mock('../src/google.js',()=>({...mocks,queryRows:vi.fn(),pageSegments:vi.fn()}));
import {brandSearchPerformance,clearQueryRowCache} from '../src/service.js';
const row={query:'acme cms',clicks:0,impressions:100,ctr:0,position:6};
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  for(const [key,value] of Object.entries({PAGE_EVIDENCE_PROFILE:'brand-test',PAGE_EVIDENCE_DATA_DIR:'/tmp/brand-test',SITE_DOMAIN:'example.test',GSC_PROPERTY:'sc-domain:example.test',ANALYTICS_PROVIDER:'none',REPORTING_LAG_DAYS:'3',GSC_ROW_CAP:'5000',PAGE_EVIDENCE_BRAND_TERMS:''}))vi.stubEnv(key,value);
  vi.clearAllMocks();clearQueryRowCache();mocks.siteQueryRows.mockReset().mockResolvedValue({rows:[row],truncated:false});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();clearQueryRowCache()});
describe('brand evidence orchestration',()=>{
  it.each(['ga4','matomo','engage','none'])('uses GSC-only data for a %s instance with explicit identity',async provider=>{
    vi.stubEnv('ANALYTICS_PROVIDER',provider);
    const result=await brandSearchPerformance({brandTerms:['Acme']});
    expect(result).toMatchObject({profile:'brand-test',site:{domain:'example.test'},analyticsProvider:provider,source:{aggregationType:'byProperty',dimensions:['query'],analyticsUsed:false},rules:{source:'request',terms:['acme']}});
    expect(result.evidence?.current.summary?.groups.branded.clicks).toBe(0);
    expect(mocks.siteQueryRows).toHaveBeenCalledTimes(2);expect(mocks.gsc).not.toHaveBeenCalled();expect(mocks.queryPageRows).not.toHaveBeenCalled();
  });
  it('requires explicit valid rules before contacting any provider',async()=>{
    expect(await brandSearchPerformance()).toMatchObject({state:'needs_configuration'});
    await expect(brandSearchPerformance({brandTerms:['!!!']})).rejects.toThrow();
    await expect(brandSearchPerformance({brandTerms:['acme'],windowDays:31})).rejects.toThrow('windowDays');
    await expect(brandSearchPerformance({brandTerms:['acme'],limit:6})).rejects.toThrow('limit');
    expect(mocks.siteQueryRows).not.toHaveBeenCalled();
    vi.stubEnv('PAGE_EVIDENCE_BRAND_TERMS','["Acme"]');expect((await brandSearchPerformance()).rules.source).toBe('configuration');
  });
  it('reclassifies cached rows for different rules, expires and explicitly refreshes',async()=>{
    const first=await brandSearchPerformance({brandTerms:['acme']});
    vi.setSystemTime(Date.now()+1000);
    const hit=await brandSearchPerformance({brandTerms:['other']});
    expect(hit.evidence?.current.freshness).toMatchObject({cached:true,fetchedAt:first.evidence?.current.freshness?.fetchedAt});
    expect(hit.evidence?.current.summary?.groups.nonBranded.impressions).toBe(100);
    expect(mocks.siteQueryRows).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now()+QUERY_TTL_MS);await brandSearchPerformance({brandTerms:['acme']});expect(mocks.siteQueryRows).toHaveBeenCalledTimes(4);
    await brandSearchPerformance({brandTerms:['acme'],refresh:true});expect(mocks.siteQueryRows).toHaveBeenCalledTimes(6);
  });
  it('isolates caches by data directory and GSC identity and bounds entries',async()=>{
    await brandSearchPerformance({brandTerms:['acme']});
    vi.stubEnv('PAGE_EVIDENCE_DATA_DIR','/tmp/brand-test-other');await brandSearchPerformance({brandTerms:['acme']});
    vi.stubEnv('GSC_PROPERTY','sc-domain:other.test');await brandSearchPerformance({brandTerms:['acme']});
    expect(mocks.siteQueryRows).toHaveBeenCalledTimes(6);
    for(let i=0;i<6;i++){vi.stubEnv('PAGE_EVIDENCE_DATA_DIR',`/tmp/brand-test-${i}`);await brandSearchPerformance({brandTerms:['acme']})}
    vi.stubEnv('GSC_PROPERTY','sc-domain:example.test');vi.stubEnv('PAGE_EVIDENCE_DATA_DIR','/tmp/brand-test');
    await brandSearchPerformance({brandTerms:['acme']});expect(mocks.siteQueryRows).toHaveBeenCalledTimes(20);
  });
  it('preserves partial failures without exposing provider error text and retries failures',async()=>{
    mocks.siteQueryRows.mockRejectedValueOnce(Error('secret provider details')).mockResolvedValueOnce({rows:[row],truncated:true});
    const result=await brandSearchPerformance({brandTerms:['acme']});
    expect(result).toMatchObject({state:'partial',evidence:{current:{state:'failed'},previous:{coverage:{capReached:true}}}});
    expect(result.comparison?.branded).toMatchObject({state:'unavailable',clickChange:null});
    expect(JSON.stringify(result)).not.toContain('secret provider details');
    await brandSearchPerformance({brandTerms:['acme']});expect(mocks.siteQueryRows).toHaveBeenCalledTimes(3);
  });
  it('keeps empty groups unavailable and period failure distinct',async()=>{
    mocks.siteQueryRows.mockResolvedValue({rows:[],truncated:false});
    const empty=await brandSearchPerformance({brandTerms:['acme']});
    expect(empty.evidence?.current).toMatchObject({state:'empty',summary:{groups:{branded:{state:'unavailable',clicks:null}}}});
    mocks.siteQueryRows.mockRejectedValue(Error('unavailable'));const failed=await brandSearchPerformance({brandTerms:['acme'],refresh:true});expect(failed.state).toBe('failed');
  });
});
