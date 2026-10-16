import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {config} from '../src/core.js';
import {queryPageRows} from '../src/google.js';

const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('googleapis',()=>({google:{auth:{OAuth2:class{}},searchconsole:()=>({searchanalytics:{query:mocks.query}})}}));
beforeEach(()=>{
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','synthetic-client');vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','synthetic-secret');
  mocks.query.mockReset();
});
afterEach(()=>vi.unstubAllEnvs());
const period={start:'2026-09-01',end:'2026-09-30'};
const c=()=>({...config(),domain:'example.test',gscProperty:'sc-domain:example.test',dataDir:'/nonexistent-page-evidence-synthetic-fixture',cap:5});
const returned={keys:['cms guide','https://example.test/guide'],clicks:3,impressions:100,ctr:.03,position:5};

describe('GSC query/page adapter',()=>{
  it('filters an exact selected query before applying the row cap and maps source metrics',async()=>{
    mocks.query.mockResolvedValue({data:{rows:[returned]}});
    expect(await queryPageRows(c(),period,'cms guide')).toEqual({rows:[{query:'cms guide',url:'https://example.test/guide',clicks:3,impressions:100,ctr:.03,position:5}],truncated:false});
    expect(mocks.query).toHaveBeenCalledWith({siteUrl:'sc-domain:example.test',requestBody:{startDate:period.start,endDate:period.end,dimensions:['query','page'],aggregationType:'byPage',dataState:'final',rowLimit:5,startRow:0,dimensionFilterGroups:[{filters:[{dimension:'query',operator:'equals',expression:'cms guide'}]}]}});
  });
  it('preserves unfiltered discovery behaviour and exposes cap hits',async()=>{
    mocks.query.mockResolvedValue({data:{rows:Array(5).fill(returned)}});
    expect((await queryPageRows(c(),period)).truncated).toBe(true);
    expect(mocks.query.mock.calls[0][0].requestBody).not.toHaveProperty('dimensionFilterGroups');
  });
  it('paginates to the configured cap while retaining the query filter',async()=>{
    mocks.query.mockResolvedValueOnce({data:{rows:Array(25000).fill(returned)}}).mockResolvedValueOnce({data:{rows:[returned]}});
    const result=await queryPageRows({...c(),cap:25002},period,'cms guide');
    expect(result.rows).toHaveLength(25001);expect(result.truncated).toBe(false);
    expect(mocks.query.mock.calls[1][0].requestBody).toMatchObject({startRow:25000,rowLimit:2,dimensionFilterGroups:[{filters:[{dimension:'query',operator:'equals',expression:'cms guide'}]}]});
  });
  it('keeps provider failures visible',async()=>{
    mocks.query.mockRejectedValue(Error('Synthetic GSC permission error'));
    await expect(queryPageRows(c(),period)).rejects.toThrow('permission error');
  });
});
