import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {config,periods,snapshotId,Store} from '../src/core.js';

const queryRows=vi.hoisted(()=>vi.fn());
vi.mock('../src/google.js',()=>({gsc:vi.fn(),queryRows,pageSegments:vi.fn(),queryPageRows:vi.fn()}));
const {findSearchOpportunities,importExternalSearchEvidence,clearQueryRowCache}=await import('../src/service.js');
let dataDir='';
const fixture=path.join(process.cwd(),'fixtures/ahrefs-organic-keywords.csv');
beforeEach(()=>{
  dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'page-evidence-search-'));
  vi.stubEnv('PAGE_EVIDENCE_DATA_DIR',dataDir);vi.stubEnv('PAGE_EVIDENCE_PROFILE','search-test');vi.stubEnv('SITE_DOMAIN','example.com');vi.stubEnv('GSC_PROPERTY','sc-domain:example.com');vi.stubEnv('ANALYTICS_PROVIDER','none');vi.stubEnv('REPORTING_LAG_DAYS','3');vi.stubEnv('PAGE_EVIDENCE_REPOSITORY_PATH','');
  const c=config(),range=periods(c.lag,30),pages=[{url:'https://example.com/cms',key:'/cms',clicks:10,impressions:1500,position:10,ctr:10/1500},{url:'https://example.com/other',key:'/other',clicks:1,impressions:150,position:12,ctr:1/150}];
  const analytics={provider:'none',metricLabels:{},rows:[],sourceSummaries:[],coverage:{complete:true,limitations:[]}};
  const store=new Store(dataDir);try{store.save(snapshotId(c,range.current),{profile:c.profile,analyticsProvider:'none',createdAt:new Date().toISOString(),range,gsc:pages,previousGsc:pages,analytics:{current:analytics,previous:analytics},coverage:{gscTruncated:false}})}finally{store.db.close()}
  queryRows.mockReset();queryRows.mockResolvedValue({rows:[{query:'enterprise cms',clicks:5,impressions:500,position:10,ctr:.01}],truncated:false});clearQueryRowCache();
});
afterEach(()=>{clearQueryRowCache();vi.unstubAllEnvs();fs.rmSync(dataDir,{recursive:true,force:true})});
describe('external import and progressive page enrichment',()=>{
  it('persists reusable profile-scoped evidence without fetching providers',()=>{
    const imported=importExternalSearchEvidence(fixture),again=importExternalSearchEvidence(fixture);expect(again.id).toBe(imported.id);expect(imported.observationCount).toBe(7);expect(queryRows).not.toHaveBeenCalled();
    const store=new Store(dataDir);try{expect(store.external(imported.id).observations).toHaveLength(7)}finally{store.db.close()}
  });
  it('bounds page enrichment and reuses cached query fetches across analyses',async()=>{
    const imported=importExternalSearchEvidence(fixture);
    const result=await findSearchOpportunities({externalDatasetId:imported.id,pageBudget:1});
    expect(result.coverage.pagesInspected).toBe(1);expect(result.coverage.knownPages).toBe(2);expect(result.opportunities[0].targetUrl).toBe('https://example.com/cms');expect(queryRows).toHaveBeenCalledTimes(2);
    await findSearchOpportunities({externalDatasetId:imported.id,pageBudget:1});expect(queryRows).toHaveBeenCalledTimes(2);
  });
  it('reports query-provider failures instead of inventing evidence',async()=>{
    queryRows.mockRejectedValue(Error('Query provider unavailable'));
    const result=await findSearchOpportunities({pageBudget:1});expect(result.opportunities).toHaveLength(0);expect(result.ignored[0].decisionReadiness.state).toBe('incomplete_coverage');
  });
  it('rejects invalid arguments and unknown datasets before fetching queries',async()=>{
    await expect(findSearchOpportunities({pageBudget:100})).rejects.toThrow('pageBudget');
    await expect(findSearchOpportunities({minimumDemand:NaN})).rejects.toThrow('thresholds');
    await expect(findSearchOpportunities({externalDatasetId:'missing'})).rejects.toThrow('No imported');expect(queryRows).not.toHaveBeenCalled();
  });
  it('rejects a persisted dataset after the site scope changes',async()=>{
    const imported=importExternalSearchEvidence(fixture);vi.stubEnv('SITE_DOMAIN','other.example');
    await expect(findSearchOpportunities({externalDatasetId:imported.id})).rejects.toThrow('different profile');
  });
  it('does not use dependency backup documentation as page source evidence',async()=>{
    const repo=path.join(dataDir,'repo');fs.mkdirSync(path.join(repo,'node_modules.nosync'),{recursive:true});
    fs.writeFileSync(path.join(repo,'cms.md'),'---\ntitle: CMS guide\n---\n\n## Enterprise CMS\n\nThis source belongs to /cms.');
    fs.writeFileSync(path.join(repo,'node_modules.nosync','dependency.md'),'Documentation linking to /cms.');
    vi.stubEnv('PAGE_EVIDENCE_REPOSITORY_PATH',repo);
    const result=await findSearchOpportunities({pageBudget:1});
    const evidence=result.opportunities[0].supportingEvidence.find(x=>x.source==='page_evidence')!;
    expect((evidence.data as any).sources).toHaveLength(1);expect((evidence.data as any).sources[0].file).toBe(path.join(repo,'cms.md'));
  });
});
describe('CLI output',()=>{
  const cli=(args:string[])=>execFileSync(process.execPath,['--import','tsx','src/cli.ts',...args],{cwd:process.cwd(),encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe'],env:{...process.env,GOOGLE_OAUTH_CLIENT_ID:'',GOOGLE_OAUTH_CLIENT_SECRET:'',PAGE_EVIDENCE_REPOSITORY_PATH:'',SITE_SIGNAL_REPOSITORY_PATH:'',MINIMUM_BASELINE_IMPRESSIONS:'25'}});
  it('imports JSON diagnostics and reuses the dataset in structured analysis',()=>{
    const imported=JSON.parse(cli(['external-import',fixture]));expect(imported.diagnostics.rowsAccepted).toBe(7);
    const result=JSON.parse(cli(['opportunities',`--external-id=${imported.id}`,'--page-budget=1']));
    expect(result.externalDatasetId).toBe(imported.id);expect(result.opportunities).toEqual([]);expect(result.ignored.length).toBeGreaterThan(0);expect(result.untrustedText).toBeDefined();
    expect(result.ignored.find((x:any)=>x.targetUrl==='https://example.com/cms').missingEvidence).toContain('Complete query retrieval within the configured cap.');
  });
  it('renders terminal output and rejects invalid formats',()=>{
    const text=cli(['opportunities','--format=text','--page-budget=1']);expect(text).toContain('Page Evidence search opportunities');expect(text).toContain('IGNORE');
    expect(()=>cli(['opportunities','--format=html'])).toThrow();
  });
});
