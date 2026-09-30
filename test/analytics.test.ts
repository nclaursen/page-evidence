import{afterEach,describe,expect,it,vi}from'vitest';
import{analyticsProvider,EngageProvider,EngageProviderError,MatomoProvider,NoneProvider}from'../src/analytics.js';
import{Config,snapshotId}from'../src/core.js';

afterEach(()=>vi.unstubAllGlobals());
const baseConfig:Config={profile:'umbraco',domain:'umbraco.test',gscProperty:'sc-domain:umbraco.test',ga4PropertyId:'',analyticsProvider:'none',matomoUrl:'',matomoSiteId:'',matomoTokenAuth:'',umbracoBaseUrl:'',umbracoClientId:'',umbracoClientSecret:'',outcomeEvents:[],dataDir:'/tmp/site-signal-umbraco',reportDir:'/tmp/site-signal-umbraco/reports',lag:3,cap:5000,analyticsCap:10000,minimumBaselineImpressions:25,trackingParams:['utm_source']};
const matomoConfig={...baseConfig,analyticsProvider:'matomo' as const,matomoUrl:'https://analytics.umbraco.test/',matomoSiteId:'7',matomoTokenAuth:'secret-token'};
const engageConfig={...baseConfig,analyticsProvider:'engage' as const,umbracoBaseUrl:'https://cms.umbraco.test',umbracoClientId:'site-signal-reader',umbracoClientSecret:'top-secret',analyticsCap:500};
const columns=['pageUrl','pageviews','pageSessions','pageVisitors','bounceRate','avgTimeOnPage','avgEngagedTimeOnPage','goalCompletionsAll'];
const query=(rows:unknown[][],extra:Record<string,unknown>={})=>({columns,rows,currentPage:1,rowsPerPage:500,totalRows:rows.length,totalPages:1,reportsExist:true,...extra});
const okPackage={version:'18.0.0',isPackageEnabled:true,featureAnalyticsEnabled:true};

function mockEngage(handler:(url:string,init:RequestInit)=>Response|Promise<Response>){
  const calls:{url:string;init:RequestInit}[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:unknown,init:RequestInit={})=>{const call={url:String(url),init};calls.push(call);return handler(call.url,init)}));
  return calls;
}

describe('analytics providers',()=>{
  it('normalizes Matomo page and referrer reports without exposing the token in the URL',async()=>{const calls:any[]=[];vi.stubGlobal('fetch',vi.fn(async(url:any,init:any)=>{calls.push({url:String(url),body:String(init.body)});const params=new URLSearchParams(String(init.body));if(params.get('method')==='Actions.getPageUrls')return new Response(JSON.stringify([{label:'/docs/?utm_source=x',nb_visits:8,nb_hits:12,nb_uniq_pageviews:7,entry_nb_visits:3,bounce_rate:0.25}]));return new Response(JSON.stringify([{label:'Search Engines',nb_visits:5,nb_actions:9,nb_conversions:1}]));}));const evidence=await new MatomoProvider(matomoConfig).landingEvidence({start:'2026-01-01',end:'2026-01-28'});expect(evidence.rows).toEqual([{url:'/docs/?utm_source=x',acquisition:null,metrics:{visits:8,pageviews:12,uniquePageviews:7,entries:3,bounceRate:.25}}]);expect(evidence.sourceSummaries[0]).toMatchObject({type:'Matomo referrer type',value:'Search Engines',metrics:{visits:5}});expect(calls).toHaveLength(2);expect(calls[0].url).not.toContain('secret-token');expect(calls[0].body).toContain('token_auth=secret-token');});
  it('supports GSC-only analytics evidence',async()=>{const evidence=await new NoneProvider().landingEvidence({start:'2026-01-01',end:'2026-01-28'});expect(evidence).toMatchObject({provider:'none',rows:[],coverage:{complete:true}});});
  it('includes profile and provider in a snapshot id',()=>expect(snapshotId(matomoConfig,{start:'2026-01-01',end:'2026-01-28'})).toBe('umbraco_matomo_2026-01-01_2026-01-28'));
});

describe('Umbraco Engage provider',()=>{
  it('authenticates, queries aggregated page analytics, and never sends secrets in URLs',async()=>{
    const calls=mockEngage((url,init)=>{
      if(url.endsWith('/security/back-office/token'))return new Response(JSON.stringify({access_token:'access-token',expires_in:300}));
      if(url.endsWith('/package'))return new Response(JSON.stringify(okPackage));
      return new Response(JSON.stringify(query([['/guide/',12,8,7,0.25,42,18,2]])));
    });
    const evidence=await new EngageProvider(engageConfig).landingEvidence({start:'2026-01-01',end:'2026-01-30'});
    expect(evidence).toMatchObject({provider:'engage',source:{version:'18.0.0'},rows:[{url:'/guide/',metrics:{pageviews:12,pageSessions:8,pageVisitors:7,bounceRate:.25,avgTimeOnPage:42,avgEngagedTimeOnPage:18,goalCompletionsAll:2}}],coverage:{complete:true,totalRows:1,reportsExist:true}});
    expect(calls.map(call=>call.url)).toEqual(['https://cms.umbraco.test/umbraco/management/api/v1/security/back-office/token','https://cms.umbraco.test/umbraco/engage/management/api/v1/package','https://cms.umbraco.test/umbraco/engage/management/api/v1/analytics/query']);
    expect(calls.every(call=>!call.url.includes('top-secret')&&!call.url.includes('access-token'))).toBe(true);
    expect(String(calls[0].init.body)).toContain('client_secret=top-secret');
    expect((calls[2].init.headers as Record<string,string>).authorization).toBe('Bearer access-token');
    expect(calls.every(call=>['GET','POST',undefined].includes(call.init.method))).toBe(true);
  });

  it('reports authentication failure without exposing credentials',async()=>{
    mockEngage(()=>new Response('{}',{status:401}));
    const provider=new EngageProvider(engageConfig);
    const health=await provider.health();
    expect(health).toMatchObject({state:'authentication_failed',authenticated:false});
    expect(health.reason).not.toContain('top-secret');
    await expect(provider.landingEvidence({start:'2026-01-01',end:'2026-01-30'})).rejects.toMatchObject({kind:'authentication_failed'});
  });

  it('distinguishes missing Engage permissions',async()=>{
    mockEngage(url=>url.endsWith('/token')?new Response(JSON.stringify({access_token:'access-token',expires_in:300})):new Response('{}',{status:403}));
    expect(await new EngageProvider(engageConfig).health()).toMatchObject({state:'missing_permissions',authenticated:true});
  });

  it('retrieves current and previous periods separately while reusing authentication',async()=>{
    const requestBodies:any[]=[];
    const calls=mockEngage((url,init)=>{
      if(url.endsWith('/token'))return new Response(JSON.stringify({access_token:'access-token',expires_in:300}));
      if(url.endsWith('/package'))return new Response(JSON.stringify(okPackage));
      requestBodies.push(JSON.parse(String(init.body)));return new Response(JSON.stringify(query([])));
    });
    const provider=new EngageProvider(engageConfig);
    await provider.landingEvidence({start:'2026-01-01',end:'2026-01-30'});
    await provider.landingEvidence({start:'2025-12-02',end:'2025-12-31'});
    expect(requestBodies.map(body=>[body.startDate,body.endDate])).toEqual([['2026-01-01T00:00:00Z','2026-01-30T23:59:59Z'],['2025-12-02T00:00:00Z','2025-12-31T23:59:59Z']]);
    expect(calls.filter(call=>call.url.endsWith('/token'))).toHaveLength(1);
  });

  it('paginates and preserves coverage metadata',async()=>{
    let queryCall=0;
    mockEngage(url=>{
      if(url.endsWith('/token'))return new Response(JSON.stringify({access_token:'access-token',expires_in:300}));
      if(url.endsWith('/package'))return new Response(JSON.stringify(okPackage));
      queryCall++;const rows=queryCall===1?[['/a',1,1,1,0,1,1,0]]:[['/b',2,2,2,0,2,2,0]];
      return new Response(JSON.stringify(query(rows,{currentPage:queryCall,totalRows:2,totalPages:2,rowsPerPage:1})));
    });
    const evidence=await new EngageProvider({...engageConfig,analyticsCap:10}).landingEvidence({start:'2026-01-01',end:'2026-01-30'});
    expect(evidence.rows.map(row=>row.url)).toEqual(['/a','/b']);
    expect(evidence.coverage).toMatchObject({complete:true,totalRows:2,fetchedRows:2,pagesFetched:2});
  });

  it('collapses normalized duplicate URLs without inventing non-additive totals',async()=>{
    mockEngage(url=>url.endsWith('/token')?new Response(JSON.stringify({access_token:'access-token',expires_in:300})):url.endsWith('/package')?new Response(JSON.stringify(okPackage)):new Response(JSON.stringify(query([['/guide/?utm_source=a',5,4,4,.2,20,10,1],['/guide/?utm_source=b',7,5,5,.3,30,15,2]]))));
    const evidence=await new EngageProvider(engageConfig).landingEvidence({start:'2026-01-01',end:'2026-01-30'});
    expect(evidence.rows).toEqual([{url:'/guide/',acquisition:null,metrics:{pageviews:12,pageSessions:null,pageVisitors:null,bounceRate:null,avgTimeOnPage:null,avgEngagedTimeOnPage:null,goalCompletionsAll:3}}]);
    expect(evidence.coverage.limitations.join(' ')).toContain('normalized duplicate');
  });

  it('keeps genuine zeros distinct from missing or unavailable values',async()=>{
    const partialColumns=['pageUrl','pageviews','pageSessions','pageVisitors','bounceRate','avgTimeOnPage'];
    mockEngage(url=>url.endsWith('/token')?new Response(JSON.stringify({access_token:'access-token',expires_in:300})):url.endsWith('/package')?new Response(JSON.stringify(okPackage)):new Response(JSON.stringify(query([['/zero',0,0,0,0,null]],{columns:partialColumns}))));
    const evidence=await new EngageProvider(engageConfig).landingEvidence({start:'2026-01-01',end:'2026-01-30'});
    expect(evidence.rows[0].metrics).toMatchObject({pageviews:0,pageSessions:0,pageVisitors:0,bounceRate:0,avgTimeOnPage:null,avgEngagedTimeOnPage:null,goalCompletionsAll:null});
    expect(evidence.metricAvailability).toMatchObject({avgEngagedTimeOnPage:{available:false},goalCompletionsAll:{available:false}});
  });

  it('returns incomplete empty evidence when reporting tables do not exist and never starts generation',async()=>{
    const calls=mockEngage(url=>url.endsWith('/token')?new Response(JSON.stringify({access_token:'access-token',expires_in:300})):url.endsWith('/package')?new Response(JSON.stringify(okPackage)):new Response(JSON.stringify(query([],{reportsExist:false,totalRows:0,totalPages:0,currentPage:0}))));
    const evidence=await new EngageProvider(engageConfig).landingEvidence({start:'2026-01-01',end:'2026-01-30'});
    expect(evidence).toMatchObject({rows:[],coverage:{complete:false,reportsExist:false}});
    expect(calls.some(call=>call.url.includes('/reporting/generation/'))).toBe(false);
  });

  it('rejects malformed responses and unsupported versions',async()=>{
    mockEngage(url=>url.endsWith('/token')?new Response(JSON.stringify({access_token:'access-token',expires_in:300})):url.endsWith('/package')?new Response(JSON.stringify({...okPackage,version:''})):new Response('{}'));
    await expect(new EngageProvider(engageConfig).landingEvidence({start:'2026-01-01',end:'2026-01-30'})).rejects.toMatchObject({kind:'incompatible'});
    vi.unstubAllGlobals();
    mockEngage(url=>url.endsWith('/token')?new Response(JSON.stringify({access_token:'access-token',expires_in:300})):url.endsWith('/package')?new Response(JSON.stringify({...okPackage,version:'19.0.0'})):new Response('{}'));
    await expect(new EngageProvider(engageConfig).landingEvidence({start:'2026-01-01',end:'2026-01-30'})).rejects.toMatchObject({kind:'incompatible'});
    vi.unstubAllGlobals();
    mockEngage(url=>url.endsWith('/token')?new Response(JSON.stringify({access_token:'access-token',expires_in:300})):url.endsWith('/package')?new Response(JSON.stringify(okPackage)):new Response(JSON.stringify({columns:'bad',rows:[]})));
    await expect(new EngageProvider(engageConfig).landingEvidence({start:'2026-01-01',end:'2026-01-30'})).rejects.toBeInstanceOf(EngageProviderError);
  });

  it('selects Engage without changing the other providers',()=>{
    expect(analyticsProvider(engageConfig)).toBeInstanceOf(EngageProvider);
    expect(analyticsProvider(matomoConfig)).toBeInstanceOf(MatomoProvider);
    expect(analyticsProvider(baseConfig)).toBeInstanceOf(NoneProvider);
  });
});
