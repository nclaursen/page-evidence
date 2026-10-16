import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {config} from '../src/core.js';
import {Ga4Provider} from '../src/analytics.js';

const mocks=vi.hoisted(()=>({runReport:vi.fn(),analyticsdata:vi.fn()}));
vi.mock('googleapis',()=>({google:{analyticsdata:mocks.analyticsdata}}));
vi.mock('../src/google.js',()=>({oauth:()=>({client:{synthetic:true}})}));
beforeEach(()=>{
  vi.stubEnv('ANALYTICS_PROVIDER','ga4');vi.stubEnv('GA4_PROPERTY_ID','123');vi.stubEnv('ANALYTICS_ROW_CAP','2');
  mocks.analyticsdata.mockReturnValue({properties:{runReport:mocks.runReport}});
  mocks.runReport.mockReset();
});
afterEach(()=>vi.unstubAllEnvs());
const period={start:'2026-09-01',end:'2026-09-30'};
const row=(url:string,source:string,values:(string|undefined)[])=>({dimensionValues:[{value:url},{value:source}],metricValues:values.map(value=>({value}))});

describe('GA4 landing evidence mapping',()=>{
  it('preserves URL, source/medium, zero and missing metrics with the configured property, dates and cap',async()=>{
    mocks.runReport.mockResolvedValue({data:{rows:[row('/Guide?utm_source=chatgpt.com','chatgpt.com / referral',['0',undefined,'0'])]}});
    const evidence=await new Ga4Provider(config()).landingEvidence(period);
    expect(mocks.runReport).toHaveBeenCalledWith({property:'properties/123',requestBody:{dateRanges:[{startDate:period.start,endDate:period.end}],dimensions:[{name:'landingPagePlusQueryString'},{name:'sessionSourceMedium'}],metrics:[{name:'sessions'},{name:'engagedSessions'},{name:'engagementRate'}],limit:'2'}});
    expect(evidence.rows).toEqual([{url:'/Guide?utm_source=chatgpt.com',acquisition:{type:'GA4 session source / medium',value:'chatgpt.com / referral'},metrics:{sessions:0,engagedSessions:null,engagementRate:0}}]);
    expect(evidence).toMatchObject({provider:'ga4',period,sourceSummaries:[],coverage:{complete:true,fetchedRows:1}});
    expect(evidence.metricLabels.sessions).toBe('GA4 sessions');
  });
  it('marks a capped response incomplete and keeps provider failures visible',async()=>{
    mocks.runReport.mockResolvedValueOnce({data:{rows:[row('/a','google / organic',['5','3','.6']),row('/b','(direct) / (none)',['2','1','.5'])]}});
    expect((await new Ga4Provider(config()).landingEvidence(period)).coverage).toMatchObject({complete:false,fetchedRows:2});
    mocks.runReport.mockRejectedValueOnce(Error('Synthetic permission failure'));
    await expect(new Ga4Provider(config()).landingEvidence(period)).rejects.toThrow('permission failure');
  });
});
