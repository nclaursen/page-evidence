import {afterEach,describe,expect,it,vi} from 'vitest';
import type {AnalyticsEvidence,Config} from '../src/core.js';
import {comparisonReadiness} from '../src/core.js';
import {acquisitionEvidence,MatomoProvider} from '../src/analytics.js';
import {metricEvidence} from '../src/measurement.js';

const seams=vi.hoisted(()=>({landing:vi.fn(),outcomes:vi.fn()}));
vi.mock('../src/analytics.js',async original=>({...await original<typeof import('../src/analytics.js')>(),analyticsProvider:()=>({landingEvidence:seams.landing}),configuredOutcomeEvents:seams.outcomes}));
import {measurementReadiness} from '../src/service.js';
const period={start:'2026-01-01',end:'2026-01-30'};
const evidence=(provider:AnalyticsEvidence['provider'],values:(number|null)[]=[0,null]):AnalyticsEvidence=>({provider,period,metricLabels:{visits:'Provider visits'},rows:values.map((value,index)=>({url:`/${index}`,acquisition:provider==='ga4'?{type:'GA4 session source / medium',value:'google / organic'}:null,metrics:{visits:value}})),sourceSummaries:[],coverage:{complete:true,limitations:[]}});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks()});

describe('provider-scoped readiness',()=>{
  it.each(['ga4','matomo','engage','none'] as const)('preserves zero and missing values for %s',provider=>{
    expect(metricEvidence(evidence(provider))).toMatchObject({visits:{state:'observed',observedRows:1,missingRows:1,zeroRows:1}});
    expect(metricEvidence(evidence(provider,[null]))).toMatchObject({visits:{state:'missing',zeroRows:0}});
  });
  it('uses GA4 source semantics only for GA4 evidence',()=>{
    expect(acquisitionEvidence(evidence('ga4')).googleOrganic).toMatchObject({state:'observed',scope:'landing_page'});
    for(const provider of ['matomo','engage','none'] as const)expect(acquisitionEvidence({...evidence(provider),sourceSummaries:[{type:'Matomo referrer type',value:'Search Engines',metrics:{visits:9}}]}).googleOrganic.state).toBe('unsupported');
  });
  it('distinguishes missing source dimensions and absent labels in bounded rows',()=>{
    expect(acquisitionEvidence({...evidence('ga4'),rows:[{url:'/',acquisition:null,metrics:{}}]}).googleOrganic.state).toBe('missing');
    expect(acquisitionEvidence(evidence('ga4',[])).googleOrganic.state).toBe('not_observed');
  });
  it('does not mark missing Matomo metrics as available or malformed reports as empty',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>new Response(JSON.stringify(String(init.body).includes('Actions.getPageUrls')?[{label:'/a',nb_visits:0}]:[]))));
    const c={matomoUrl:'https://analytics.test',matomoSiteId:'1',matomoTokenAuth:'synthetic',analyticsCap:100} as Config;
    const result=await new MatomoProvider(c).landingEvidence(period);
    expect(result.metricAvailability).toMatchObject({visits:{available:true},pageviews:{available:false}});
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));
    await expect(new MatomoProvider(c).landingEvidence(period)).rejects.toThrow('invalid report shape');
  });
  it('reports one failed period and failed outcomes while preserving the other period',async()=>{
    vi.stubEnv('ANALYTICS_PROVIDER','ga4');vi.stubEnv('SITE_DOMAIN','example.test');
    seams.landing.mockResolvedValueOnce(evidence('ga4')).mockRejectedValueOnce(Error('private credential details'));
    seams.outcomes.mockRejectedValueOnce(Error('private credential details'));
    const result=await measurementReadiness();
    expect(result.analyticsEvidence.current).toMatchObject({state:'available',metrics:{visits:{zeroRows:1}}});
    expect(result.analyticsEvidence.previous.state).toBe('failed');
    expect(result.lensEvidence.previous.googleOrganic.state).toBe('failed');
    expect(result.configuredOutcomes).toMatchObject({available:false,state:'failed'});
    expect(result.lenses.googleOrganic).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private credential details');
    expect(result.analyticsEvidence.current).not.toHaveProperty('rows');
  });
  it.each(['ga4','matomo','engage','none'] as const)('returns provider-specific unsupported and available states for %s',async provider=>{
    vi.stubEnv('ANALYTICS_PROVIDER',provider);
    seams.landing.mockResolvedValue(evidence(provider));seams.outcomes.mockResolvedValue({available:false,reason:'Not configured.',events:[]});
    const result=await measurementReadiness();
    expect(result.provider).toBe(provider);
    expect(result.analyticsEvidence.current.state).toBe(provider==='none'?'unsupported':'available');
    expect(result.lensEvidence.current.googleOrganic.state).toBe(provider==='ga4'?'observed':'unsupported');
    expect(result.configuredOutcomes.state).toBe(provider==='ga4'?'missing':'unsupported');
  });
  it('keeps partial provider coverage and missing period readiness explicit',async()=>{
    vi.stubEnv('ANALYTICS_PROVIDER','matomo');
    seams.landing.mockResolvedValue({...evidence('matomo'),coverage:{complete:false,limitations:['Capped report.']}});
    seams.outcomes.mockResolvedValue({available:false,reason:'Unsupported.',events:[]});
    expect((await measurementReadiness()).analyticsEvidence.current).toMatchObject({coverage:{complete:false,limitations:['Capped report.']}});
    expect(comparisonReadiness({analyticsProvider:'matomo',lag:3} as Config,false,{current:evidence('matomo')}).state).toBe('incomplete_coverage');
    expect(comparisonReadiness({analyticsProvider:'none',lag:3} as Config,false,{}).state).toBe('ready');
  });
});
