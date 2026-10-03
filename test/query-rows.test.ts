import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {config,periods,rankQueries,snapshotId,Store} from '../src/core.js';

const queryRows=vi.hoisted(()=>vi.fn());
vi.mock('../src/google.js',()=>({gsc:vi.fn(),pageSegments:vi.fn(),queryPageRows:vi.fn(),queryRows}));
const {clearQueryRowCache,contentOpportunities,pageContext,queryEntryExit}=await import('../src/service.js');

const row=(query:string,clicks:number,impressions:number)=>({query,clicks,impressions,ctr:impressions?clicks/impressions:0,position:impressions?5:0});
const envKeys=['SITE_SIGNAL_DATA_DIR','SITE_SIGNAL_PROFILE','SITE_DOMAIN','GSC_PROPERTY','ANALYTICS_PROVIDER'];
const previousEnv:Record<string,string|undefined>={};
let dataDir='';

beforeEach(()=>{
  dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'site-signal-query-rows-'));
  for(const key of envKeys)previousEnv[key]=process.env[key];
  Object.assign(process.env,{SITE_SIGNAL_DATA_DIR:dataDir,SITE_SIGNAL_PROFILE:'query-rows-test',SITE_DOMAIN:'example.com',GSC_PROPERTY:'sc-domain:example.com',ANALYTICS_PROVIDER:'none'});
  const c=config(),range=periods(c.lag,30),page={url:'https://example.com/page',key:'/page',clicks:3,impressions:1000,ctr:.003,position:5},empty={provider:'none',metricLabels:{},rows:[],sourceSummaries:[],coverage:{complete:true,limitations:[]}};
  new Store(dataDir).save(snapshotId(c,range.current),{profile:c.profile,analyticsProvider:'none',range,gsc:[page],previousGsc:[page],analytics:{current:empty,previous:empty},coverage:{gscTruncated:false},createdAt:new Date().toISOString()});
  queryRows.mockReset();
  clearQueryRowCache();
});

afterEach(()=>{
  for(const key of envKeys){const value=previousEnv[key];if(value===undefined)delete process.env[key];else process.env[key]=value}
  fs.rmSync(dataDir,{recursive:true,force:true});
});

describe('query rows are ranked locally, not sampled by Google',()=>{
  it('orders by impressions, then clicks, then query text',()=>{
    expect(rankQueries([row('b',0,10),row('a',0,10),row('c',5,10),row('d',0,90)]).map(x=>x.query)).toEqual(['d','c','a','b']);
  });

  it('returns the highest-impression queries even when Google returned them after zero-click rows',async()=>{
    const current=[row('alpha zero click',0,1),row('enterprise cms',0,800),row('beta zero click',0,2),row('with a click',2,150)];
    queryRows.mockResolvedValue({rows:current,truncated:false});
    const context:any=await pageContext('https://example.com/page',undefined,2,30);
    expect(context.queryEvidence.current.map((x:any)=>x.query)).toEqual(['enterprise cms','with a click']);
    expect(context.queryEvidence.coverage.current.fetched).toMatchObject({fetchedRows:4,fetchCapReached:false});
    expect(queryRows).toHaveBeenCalledTimes(2);
  });

  it('computes entered, exited and retained on the full row sets and bounds only the output',async()=>{
    const now=[row('kept',1,100),row('new big',1,500),...Array.from({length:30},(_,i)=>row(`new small ${String(i).padStart(2,'0')}`,0,1))];
    const before=[row('kept',2,120),row('gone big',3,700),row('gone small',0,2)];
    queryRows.mockImplementation(async(_c:any,period:any)=>({rows:period.start===periods(config().lag,30).current.start?now:before,truncated:false}));
    const result:any=await queryEntryExit('https://example.com/page',30,3);
    expect(result.counts).toEqual({entered:31,exited:2,retained:1});
    expect(result.entered.map((x:any)=>x.query)).toEqual(['new big','new small 00','new small 01']);
    expect(result.exited.map((x:any)=>x.query)).toEqual(['gone big','gone small']);
    expect(result.retained.map((x:any)=>x.query)).toEqual(['kept']);
    expect(result.coverage.current).toMatchObject({fetchedRows:32,fetchCapReached:false,pageTotal:{impressions:1000}});
    expect(result.entered[0]).toEqual({query:'new big',current:row('new big',1,500),previous:row('new big',0,0),clickChange:1,impressionChange:500,positionChange:null,baseline:'new/no baseline'});
    expect(result.retained[0]).toMatchObject({baseline:'comparable',current:row('kept',1,100),previous:row('kept',2,120)});
    expect(result.limitation).not.toContain('cap was reached');
  });

  it('defaults to twenty full rows per group',async()=>{
    const rows=Array.from({length:25},(_,i)=>row(`query ${i}`,1,100-i));
    queryRows.mockResolvedValue({rows,truncated:false});
    const result=await queryEntryExit('https://example.com/page');
    expect(result.retained).toHaveLength(20);
    expect(result.counts.retained).toBe(25);
    expect(result.retained[0]).toMatchObject({baseline:'comparable',current:rows[0],previous:rows[0]});
  });

  it('says so when the fetch cap was reached',async()=>{
    queryRows.mockResolvedValue({rows:[row('a',0,5)],truncated:true});
    const result:any=await queryEntryExit('https://example.com/page',30,3);
    expect(result.coverage.current.fetchCapReached).toBe(true);
    expect(result.limitation).toContain('fetch cap was reached');
  });

  it('fetches once per page and period across repeated questions in the same process',async()=>{
    queryRows.mockResolvedValue({rows:[row('a',0,5)],truncated:false});
    await queryEntryExit('https://example.com/page',30,3);
    await pageContext('https://example.com/page',undefined,5,30);
    expect(queryRows).toHaveBeenCalledTimes(2);
  });
});

describe('content opportunities response',()=>{
  it('preserves the snapshot fields alongside bounded candidates and counts',async()=>{
    const result:any=await contentOpportunities(false,1,30);
    expect(result.gsc).toHaveLength(1);
    expect(result.previousGsc).toEqual(result.gsc);
    expect(result.analytics.current).toMatchObject({provider:'none',rows:[]});
    expect(result.analytics.previous).toMatchObject({provider:'none',rows:[]});
    expect(result).toMatchObject({profile:'query-rows-test',cached:true,pagesConsidered:{current:1,previous:1}});
    expect(result.coverage).toBeDefined();
    expect(Array.isArray(result.candidates)).toBe(true);
    expect(result.candidates.length).toBeLessThanOrEqual(1);
  });
});
