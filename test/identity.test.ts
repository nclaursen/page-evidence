import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {config,evidenceIdentity,pageKey,periods,snapshotId,snapshotMatches,Store} from '../src/core.js';
import {digestChanges} from '../src/digest.js';
import {sitePageKey} from '../src/search-opportunities.js';

const mocks=vi.hoisted(()=>({gsc:vi.fn(),queryRows:vi.fn(),landingEvidence:vi.fn()}));
vi.mock('../src/google.js',()=>({...mocks,pageSegments:vi.fn(),queryPageRows:vi.fn()}));
vi.mock('../src/analytics.js',()=>({analyticsProvider:()=>({landingEvidence:mocks.landingEvidence}),configuredOutcomeEvents:()=>[]}));
const {sync,cacheStatus,pageContext,pageHistory,pageLifecycle,actionReviewContext,recordAction,changeDigest,clearQueryRowCache}=await import('../src/service.js');
let dir:string;
const page=(host='example.test',clicks=10)=>({url:`https://${host}/guide`,clicks,impressions:200,ctr:clicks/200,position:5});
const analytics=(provider:string)=>({provider,metricLabels:{sessions:'Synthetic sessions'},rows:[{url:'/guide',acquisition:null,metrics:{sessions:10}},{url:'https://docs.example.test/guide',acquisition:null,metrics:{sessions:99}}],sourceSummaries:[],coverage:{complete:true,limitations:[]}});
beforeEach(()=>{
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'page-evidence-identity-'));
  for(const [key,value]of Object.entries({PAGE_EVIDENCE_DATA_DIR:dir,PAGE_EVIDENCE_PROFILE:'identity',SITE_DOMAIN:'example.test',GSC_PROPERTY:'sc-domain:example.test',ANALYTICS_PROVIDER:'none',GA4_PROPERTY_ID:'123',MATOMO_URL:'https://analytics.example.test/',MATOMO_SITE_ID:'7',UMBRACO_BASE_URL:'https://cms.example.test',REPORTING_LAG_DAYS:'3',GSC_ROW_CAP:'5000',ANALYTICS_ROW_CAP:'10000',TRACKING_PARAMETERS:'utm_source,gclid'}))vi.stubEnv(key,value);
  vi.clearAllMocks();clearQueryRowCache();
  mocks.gsc.mockResolvedValue({rows:[page(),page('docs.example.test',20)],truncated:false});
  mocks.queryRows.mockResolvedValue({rows:[],truncated:false});
  mocks.landingEvidence.mockImplementation(async()=>analytics(config().analyticsProvider));
});
afterEach(()=>{clearQueryRowCache();vi.unstubAllEnvs();fs.rmSync(dir,{recursive:true,force:true})});

describe('shared page identity',()=>{
  it('preserves subdomains, ports, case, slashes and meaningful queries while aliasing root/www and HTTP/HTTPS',()=>{
    const c=config();
    expect(pageKey('http://www.example.test/Guide?utm_source=x&q=y#top',c)).toBe('example.test/Guide?q=y');
    expect(pageKey('/guide',c)).toBe(pageKey('https://example.test/guide',c));
    for(const url of ['https://docs.example.test/guide','https://example.test:8443/guide','https://example.test/Guide','https://example.test/guide/','https://example.test/guide?q=y'])expect(pageKey(url,c)).not.toBe(pageKey('/guide',c));
    expect(pageKey('https://docs.example.test/guide',{...c,domain:'www.example.test'})).toBe('docs.example.test/guide');
    expect(sitePageKey('/guide',c)).toBe(pageKey('/guide',c));
    for(const url of ['https://example.test.evil.test/guide','https://foreign.test/guide','javascript:alert(1)','https://user:secret@example.test/guide'])expect(pageKey(url,c)).toBeNull();
  });
  it('does not invent a change by comparing different hosts with the same path',()=>{
    const result=digestChanges({gsc:[page('docs.example.test',30)]},{gsc:[page()]},config(),5);
    expect(result.counts).toEqual({gains:0,declines:0,maturing:1,missing:1});
  });
});

describe('persisted evidence identity',()=>{
  it.each(['none','ga4','matomo','engage'])('keeps %s cache reuse scoped to the selected analytics connection',async(provider)=>{
    vi.stubEnv('ANALYTICS_PROVIDER',provider);
    const original=await sync();expect((await sync()).cached).toBe(true);
    const changed=provider==='ga4'?['GA4_PROPERTY_ID','456']:provider==='matomo'?['MATOMO_SITE_ID','8']:provider==='engage'?['UMBRACO_BASE_URL','https://other-cms.example.test']:['GSC_PROPERTY','https://example.test/'];
    vi.stubEnv(changed[0],changed[1]);
    expect(cacheStatus().snapshot.present).toBe(false);
    const next=await sync();expect(next.cached).toBe(false);expect(next.id).not.toBe(original.id);
    await expect(pageContext(page().url,original.id)).rejects.toThrow('identity');
    expect(pageHistory(page().url).coverage.excludedIncompatibleSnapshots).toBe(1);
    vi.stubEnv(changed[0],provider==='ga4'?'123':provider==='matomo'?'7':provider==='engage'?'https://cms.example.test':'sc-domain:example.test');
    expect((await sync()).id).toBe(original.id);expect(mocks.gsc).toHaveBeenCalledTimes(4);
  });
  it('changes identity for retrieval policy and exact profile, without including secrets or irrelevant providers',()=>{
    const c=config(),id=evidenceIdentity(c),period=periods(c.lag).current;
    for(const patch of [{domain:'other.test'},{gscProperty:'https://example.test/'},{profile:'identity!'},{cap:10},{analyticsCap:10},{lag:4},{trackingParams:['different']}])expect(evidenceIdentity({...c,...patch})).not.toEqual(id);
    expect(snapshotId({...c,profile:'a!'},period)).not.toBe(snapshotId({...c,profile:'a?'},period));
    expect(evidenceIdentity({...c,trackingParams:['gclid','utm_source','gclid']})).toEqual(id);
    expect(evidenceIdentity({...c,ga4PropertyId:'irrelevant',matomoTokenAuth:'rotated',umbracoClientSecret:'rotated'})).toEqual(id);
    const matomo={...c,analyticsProvider:'matomo' as const,matomoTokenAuth:'secret'};
    expect(evidenceIdentity({...matomo,matomoTokenAuth:'rotated'})).toEqual(evidenceIdentity(matomo));
    expect(evidenceIdentity({...matomo,matomoUrl:'https://user:secret@analytics.example.test/?token=secret#secret'})).toEqual(evidenceIdentity(matomo));
    expect(JSON.stringify(evidenceIdentity(matomo))).not.toContain('secret');
    expect(snapshotMatches({profile:c.profile,analyticsProvider:c.analyticsProvider,identity:id},c)).toBe(true);
  });
  it('retains legacy snapshots and annotations without silently adopting them into verified history',async()=>{
    const c=config(),store=new Store(dir),range=periods(c.lag,7);
    const legacy={profile:c.profile,analyticsProvider:c.analyticsProvider,range,gsc:[page()],previousGsc:[page()],createdAt:new Date().toISOString()};
    store.save('legacy',legacy);
    recordAction({id:'note',url:page().url,status:'Implemented',implementation_date:range.current.end,baseline_snapshot:'legacy',description:'Preserve me'});
    expect(pageHistory(page().url,7)).toMatchObject({observations:[],annotations:[{id:'note',description:'Preserve me'}],coverage:{excludedIncompatibleSnapshots:1}});
    await expect(pageContext(page().url,'legacy')).rejects.toThrow('Legacy snapshots are retained');
    const review=actionReviewContext('note',7);expect(review.evidence.baseline).toBeNull();expect(review.gaps.join(' ')).toContain('legacy');
    await sync(false,7);expect(store.get('legacy')).toEqual(legacy);store.db.close();
  });
  it('validates payload identity even under the expected snapshot ID',async()=>{
    const original=await sync(),store=new Store(dir),saved=store.get(original.id);delete saved.identity;store.save(original.id,saved);store.db.close();
    expect(cacheStatus().snapshot.present).toBe(false);
    expect((await sync()).cached).toBe(false);
  });
  it('starts fresh after a site change and rejects a pinned baseline after a GSC property change',async()=>{
    const original=await sync();
    recordAction({id:'pinned',url:page().url,status:'Implemented',implementation_date:'2099-01-01',baseline_snapshot:original.id});
    vi.stubEnv('GSC_PROPERTY','https://example.test/');await sync();
    const review=actionReviewContext('pinned');
    expect(review.evidence.baseline).toBeNull();expect(review.deltas).toBeNull();expect(review.coverage.excludedIncompatibleSnapshots).toBe(1);
    vi.stubEnv('SITE_DOMAIN','other.test');vi.stubEnv('GSC_PROPERTY','sc-domain:other.test');
    mocks.gsc.mockResolvedValue({rows:[page('other.test')],truncated:false});
    const other=await sync();expect(other.cached).toBe(false);expect(other.id).not.toBe(original.id);
    expect(pageHistory(page('other.test').url).coverage.excludedIncompatibleSnapshots).toBe(2);
  });
  it('isolates query caches and digest checkpoints after a retrieval-policy change',async()=>{
    await pageContext(page().url);await changeDigest();expect((await changeDigest()).status).toBe('compared');
    vi.stubEnv('TRACKING_PARAMETERS','utm_source');
    expect((await changeDigest()).status).toBe('baseline_needed');await pageContext(page().url);
    expect(mocks.queryRows).toHaveBeenCalledTimes(4);
  });
  it('matches page evidence, history, lifecycle and annotations by host rather than persisted path keys',async()=>{
    await sync();
    recordAction({id:'root',url:page().url,status:'Implemented',implementation_date:periods(config().lag).current.start});
    recordAction({id:'docs',url:page('docs.example.test').url,status:'Implemented',implementation_date:periods(config().lag).current.start});
    const root=await pageContext(page().url),docs=await pageContext(page('docs.example.test').url);
    expect(root.pagePerformance.current?.clicks).toBe(10);expect(docs.pagePerformance.current?.clicks).toBe(20);
    expect(root.analyticsEvidence.current[0].metrics.sessions).toBe(10);expect(root.analyticsEvidence.current).toHaveLength(1);
    expect(docs.operationalAnnotations.map((x:any)=>x.id)).toEqual(['docs']);
    expect(pageHistory(page().url).annotations.map((x:any)=>x.id)).toEqual(['root']);
    expect((await pageLifecycle(page('docs.example.test').url)).windows.every(x=>x.current?.clicks===20)).toBe(true);
    await expect(pageContext('https://foreign.test/guide')).rejects.toThrow('configured site');
    expect(actionReviewContext('root').overlappingChanges).toEqual([]);
  });
});
