import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {config,periods,snapshotId,Store} from '../src/core.js';
import {digestChanges} from '../src/digest.js';
import {freshness,QUERY_TTL_MS,SNAPSHOT_TTL_MS} from '../src/freshness.js';

const mocks=vi.hoisted(()=>({gsc:vi.fn(),queryRows:vi.fn(),landingEvidence:vi.fn()}));
vi.mock('../src/google.js',()=>({...mocks,pageSegments:vi.fn(),queryPageRows:vi.fn()}));
vi.mock('../src/analytics.js',()=>({analyticsProvider:()=>({landingEvidence:mocks.landingEvidence}),configuredOutcomeEvents:()=>[]}));
const {cacheStatus,changeDigest,clearQueryRowCache,pageContext,refreshEvidence,sync}=await import('../src/service.js');
let dir:string;
const page=(name:string,clicks=10,impressions=200)=>({url:`https://example.test/${name}`,clicks,impressions,ctr:clicks/impressions,position:5});
const empty={provider:'none',rows:[],sourceSummaries:[],metricLabels:{},coverage:{complete:true,limitations:[]}};
function save(rows=[page('a')],createdAt=new Date().toISOString(),truncated=false){
  const c=config(),range=periods(c.lag,30),store=new Store(c.dataDir);
  const value={profile:c.profile,analyticsProvider:c.analyticsProvider,range,gsc:rows,previousGsc:rows,analytics:{current:empty,previous:empty},coverage:{gscTruncated:truncated},createdAt};
  store.save(snapshotId(c,range.current),value);store.db.close();return value;
}
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'site-signal-digest-'));
  for(const [key,value]of Object.entries({SITE_SIGNAL_DATA_DIR:dir,SITE_SIGNAL_PROFILE:'synthetic',SITE_DOMAIN:'example.test',GSC_PROPERTY:'sc-domain:example.test',ANALYTICS_PROVIDER:'none',REPORTING_LAG_DAYS:'3',MINIMUM_BASELINE_IMPRESSIONS:'25'}))vi.stubEnv(key,value);
  vi.clearAllMocks();clearQueryRowCache();
  mocks.gsc.mockReset().mockResolvedValue({rows:[page('a')],truncated:false});
  mocks.queryRows.mockReset().mockResolvedValue({rows:[{query:'synthetic phrase',clicks:10,impressions:200,ctr:0.05,position:5}],truncated:false});
  mocks.landingEvidence.mockReset().mockResolvedValue(empty);
  save();
});
afterEach(()=>{clearQueryRowCache();vi.unstubAllEnvs();vi.useRealTimers();fs.rmSync(dir,{recursive:true,force:true})});

it('reports freshness, unknown age and the exact expiry boundary',()=>{
  const at=new Date().toISOString();
  expect(freshness(at,1000,true)).toMatchObject({ageSeconds:0,stale:false,cached:true});
  expect(freshness(at,1000,true,Date.now()+1000).stale).toBe(true);
  expect(freshness(undefined,1000,true)).toMatchObject({ageSeconds:null,stale:true});
});

it('does not contact providers for fresh snapshots or cache status',async()=>{
  expect(cacheStatus().snapshot).toMatchObject({present:true,stale:false});
  expect((await sync()).freshness.cached).toBe(true);
  expect(mocks.gsc).not.toHaveBeenCalled();
});

it('refetches expired snapshots automatically',async()=>{
  save(undefined,new Date(Date.now()-SNAPSHOT_TTL_MS).toISOString());
  expect(cacheStatus().snapshot.stale).toBe(true);
  expect((await sync()).freshness).toMatchObject({cached:false,ageSeconds:0});
  expect(mocks.gsc).toHaveBeenCalledTimes(2);
});

it('reports query-cache hits, expires them and isolates profiles',async()=>{
  // pageContext uses normalized keys on stored rows.
  const c=config(),store=new Store(dir),id=snapshotId(c,periods(c.lag,30).current),snapshot=store.get(id);
  snapshot.gsc[0].key='/a';snapshot.previousGsc[0].key='/a';store.save(id,snapshot);store.db.close();
  const first=await pageContext(page('a').url);
  expect(first.queryEvidence.coverage.current.fetched.freshness.cached).toBe(false);
  const second=await pageContext(page('a').url);
  expect(second.queryEvidence.coverage.current.fetched.freshness.cached).toBe(true);
  expect(mocks.queryRows).toHaveBeenCalledTimes(2);
  vi.setSystemTime(Date.now()+QUERY_TTL_MS);
  expect(cacheStatus().queryCache.expiredEntries).toBe(2);
  await pageContext(page('a').url);
  expect(mocks.queryRows).toHaveBeenCalledTimes(4);
  vi.stubEnv('SITE_SIGNAL_PROFILE','second-profile');
  await sync(true);await pageContext(page('a').url);
  expect(mocks.queryRows).toHaveBeenCalledTimes(6);
  await refreshEvidence();
  expect(cacheStatus().queryCache.entries).toBe(0);
  vi.stubEnv('SITE_SIGNAL_PROFILE','synthetic');
  expect(cacheStatus().queryCache.entries).toBe(2);
});

it('manual refresh invalidates query rows and preserves checkpoints and actions',async()=>{
  await sync(true);await pageContext(page('a').url);await changeDigest();
  const store=new Store(dir);const action=store.action({url:page('a').url,status:'Proposed'});store.db.close();
  expect(cacheStatus().queryCache.entries).toBe(2);
  expect(await refreshEvidence()).toMatchObject({queryCacheInvalidated:true,queryRowsRefetched:false});
  expect(cacheStatus().queryCache.entries).toBe(0);
  expect((await changeDigest()).status).toBe('compared');
  const after=new Store(dir);expect(after.actionById(action)).toBeDefined();after.db.close();
});

it('retries failed query fetches instead of caching a rejected promise',async()=>{
  await sync(true);
  mocks.queryRows.mockRejectedValueOnce(new Error('synthetic query failure'));
  await expect(pageContext(page('a').url)).rejects.toThrow('synthetic query failure');
  await pageContext(page('a').url);
  expect(mocks.queryRows).toHaveBeenCalledTimes(3);
});

it('isolates digest checkpoints by profile and reporting window',async()=>{
  await changeDigest();
  expect((await changeDigest(60)).status).toBe('baseline_needed');
  vi.stubEnv('SITE_SIGNAL_PROFILE','second-profile');save();
  expect((await changeDigest()).status).toBe('baseline_needed');
  vi.stubEnv('SITE_SIGNAL_PROFILE','synthetic');
  expect((await changeDigest()).status).toBe('compared');
});

it('keeps explicitly requested historical snapshots even when stale',async()=>{
  await sync(true);
  const c=config(),id=snapshotId(c,periods(c.lag,30).current),store=new Store(dir),saved=store.get(id);
  saved.createdAt=new Date(Date.now()-2*SNAPSHOT_TTL_MS).toISOString();store.save(id,saved);store.db.close();
  mocks.gsc.mockClear();
  const result=await pageContext(page('a').url,id);
  expect(result.freshness.stale).toBe(true);
  expect(mocks.gsc).not.toHaveBeenCalled();
});

it('establishes a baseline, supports preview and advances only on request',async()=>{
  expect(await changeDigest(30,5,false,false)).toMatchObject({status:'baseline_needed',checkpointAdvanced:false});
  expect((await changeDigest()).status).toBe('baseline_needed');
  save([page('a',20,300)]);
  const preview=await changeDigest(30,5,false,false);
  expect(preview.counts.gains).toBe(1);
  expect(preview.gains[0].clickChange).toBe(10);
  expect((await changeDigest()).counts.gains).toBe(1);
  expect((await changeDigest()).counts.gains).toBe(0);
});

it('keeps a checkpoint independent of same-period snapshot refreshes and failures',async()=>{
  await changeDigest();
  mocks.gsc.mockRejectedValueOnce(new Error('synthetic provider failure'));
  await expect(changeDigest(30,5,true)).rejects.toThrow('synthetic provider failure');
  mocks.gsc.mockResolvedValue({rows:[page('a',30,400)],truncated:false});
  const result=await changeDigest(30,5,true,false);
  expect(result.gains[0].clickChange).toBe(20);
});

it('reports current and previous measurement issues separately',async()=>{
  save(undefined,undefined,true);await changeDigest();
  save();const result=await changeDigest();
  expect(result.measurementIssues).toEqual([]);
  expect(result.previousMeasurementIssues.length).toBeGreaterThan(0);
});

it('bounds meaningful changes, labels low baselines and never zero-fills absent pages',()=>{
  const previous={gsc:[page('gain'),page('decline',30,400),page('noise'),page('small',0,10),page('missing')]};
  const current={gsc:[page('gain',20,300),page('decline',10,200),page('noise',11,210),page('small',1,150),page('new',1,150)]};
  const result=digestChanges(current,previous,config(),1);
  expect(result.counts).toEqual({gains:1,declines:1,maturing:2,missing:1});
  expect(result.maturing).toHaveLength(1);
  expect(result.missing[0]).not.toHaveProperty('current');
});

it('rejects invalid limits and windows before calling providers',async()=>{
  await expect(changeDigest(30,0)).rejects.toThrow('limit');
  await expect(changeDigest(14)).rejects.toThrow('windowDays');
  expect(()=>cacheStatus(14)).toThrow('windowDays');
  expect(mocks.gsc).not.toHaveBeenCalled();
});

it('supports seven complete days excluding the three most recent complete days',async()=>{
  const range=periods(3,7);
  expect(range).toEqual({current:{start:'2026-09-23',end:'2026-09-29'},previous:{start:'2026-09-16',end:'2026-09-22'}});
  const result=await changeDigest(7);
  expect(result.windowDays).toBe(7);
  expect(result.periods.current).toEqual(range.current);
  expect(result.readiness.state).toBe('ready');
  expect(cacheStatus(7).snapshot.present).toBe(true);
  expect((await refreshEvidence(7)).periods).toEqual(range);
});
