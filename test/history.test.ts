import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {Store} from '../src/core.js';
import {actionReviewContext,pageHistory,queryCoverage,recordAction,status} from '../src/service.js';

let dataDir='';
const previousEnv:Record<string,string|undefined>={};
const envKeys=['SITE_SIGNAL_DATA_DIR','SITE_SIGNAL_PROFILE','SITE_DOMAIN','GSC_PROPERTY','ANALYTICS_PROVIDER','SITE_SIGNAL_REPOSITORY_PATH','SITE_SIGNAL_SITEMAP_URL','GA4_OUTCOME_EVENT_NAMES'];

function snapshot(start:string,end:string,clicks:number,impressions:number){
  return{profile:'history-test',analyticsProvider:'none',range:{current:{start,end},previous:{start:'2025-12-01',end:'2025-12-30'}},gsc:[{url:'https://example.com/page',key:'/page',clicks,impressions,ctr:clicks/impressions,position:5}],previousGsc:[],analytics:{current:{provider:'none',metricLabels:{},rows:[],sourceSummaries:[],coverage:{complete:true,limitations:[]}},previous:{provider:'none',metricLabels:{},rows:[],sourceSummaries:[],coverage:{complete:true,limitations:[]}}},coverage:{gscTruncated:false},createdAt:`${end}T12:00:00.000Z`};
}

beforeEach(()=>{
  dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'site-signal-history-'));
  for(const key of envKeys)previousEnv[key]=process.env[key];
  process.env.SITE_SIGNAL_DATA_DIR=dataDir;
  process.env.SITE_SIGNAL_PROFILE='history-test';
  process.env.SITE_DOMAIN='example.com';
  process.env.GSC_PROPERTY='sc-domain:example.com';
  process.env.ANALYTICS_PROVIDER='none';
  delete process.env.SITE_SIGNAL_REPOSITORY_PATH;
  delete process.env.SITE_SIGNAL_SITEMAP_URL;
  delete process.env.GA4_OUTCOME_EVENT_NAMES;
});

afterEach(()=>{
  for(const key of envKeys){const value=previousEnv[key];if(value===undefined)delete process.env[key];else process.env[key]=value}
  fs.rmSync(dataDir,{recursive:true,force:true});
});

describe('stored history and review evidence',()=>{
  it('returns comparable stored page observations and typed annotations',()=>{
    const store=new Store(dataDir);
    store.save('older',snapshot('2025-11-01','2025-11-30',2,70));
    store.save('baseline',snapshot('2026-01-01','2026-01-30',4,100));
    store.save('after',snapshot('2026-02-02','2026-03-03',7,140));
    recordAction({id:'action-1',url:'https://example.com/page',description:'Improve opening',hypothesis:'More useful answer',status:'Implemented',action_type:'content_update',implementation_date:'2026-02-01',baseline_snapshot:'baseline',review_date:'2026-03-10',outcome_notes:''});
    const history=pageHistory('https://example.com/page',30,6);
    expect(history.observations.map((item:any)=>item.snapshotId)).toEqual(['after','baseline','older']);
    expect(history.annotations[0]).toMatchObject({id:'action-1',action_type:'content_update'});
    const review=actionReviewContext('action-1');
    expect(review.evidence.baseline).toMatchObject({snapshotId:'baseline',performance:{clicks:4}});
    expect(review.evidence.after).toMatchObject({snapshotId:'after',performance:{clicks:7}});
    expect(review.limitation).toContain('do not establish');
    recordAction({id:'action-2',url:'https://example.com/page',description:'Unpinned baseline',hypothesis:'Test nearest snapshot',status:'Implemented',action_type:'technical_change',implementation_date:'2026-02-01',review_date:'2026-03-10',outcome_notes:''});
    expect(actionReviewContext('action-2').evidence.baseline).toMatchObject({snapshotId:'baseline'});
  });

  it('reports optional capabilities separately from required setup',async()=>{
    const result=await status();
    expect(result.configured).toBe(true);
    expect(result.optionalCapabilities).toMatchObject({repository:{configured:false},sitemap:{configured:false},outcomeEvents:{configured:false},analytics:{configured:false}});
  });
});

describe('query example coverage',()=>it('shows the measured difference from the page total without assigning a cause',()=>{
  expect(queryCoverage([{clicks:2,impressions:20},{clicks:1,impressions:10}],{clicks:5,impressions:50},5)).toEqual({displayedRowLimit:5,displayedRows:2,displayed:{clicks:3,impressions:30},pageTotal:{clicks:5,impressions:50},differenceNotExplainedByDisplayedRows:{clicks:2,impressions:20}});
}));
