import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {config} from '../src/core.js';
const mocks=vi.hoisted(()=>({query:vi.fn(),searchconsole:vi.fn()}));
vi.mock('googleapis',()=>({google:{searchconsole:mocks.searchconsole,auth:{OAuth2:class{setCredentials(){}}}}}));
import {siteQueryRows} from '../src/google.js';
const period={start:'2026-10-01',end:'2026-10-30'};
beforeEach(()=>{vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','synthetic');vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','synthetic');vi.stubEnv('PAGE_EVIDENCE_DATA_DIR','/tmp/nonexistent-brand-synthetic');vi.stubEnv('GSC_PROPERTY','sc-domain:example.test');vi.stubEnv('GSC_ROW_CAP','3');mocks.query.mockReset();mocks.searchconsole.mockReturnValue({searchanalytics:{query:mocks.query}})});
afterEach(()=>vi.unstubAllEnvs());
const row=(query='acme')=>({keys:[query],clicks:0,impressions:100,ctr:0,position:4});
it('requests final web query-only by-property evidence and preserves zero',async()=>{
  mocks.query.mockResolvedValue({data:{responseAggregationType:'byProperty',rows:[row()]}});
  expect(await siteQueryRows(config(),period)).toMatchObject({truncated:false,rows:[{query:'acme',clicks:0,impressions:100,ctr:0,position:4}]});
  expect(mocks.query).toHaveBeenCalledWith({siteUrl:'sc-domain:example.test',requestBody:{startDate:period.start,endDate:period.end,dimensions:['query'],aggregationType:'byProperty',dataState:'final',type:'web',rowLimit:3,startRow:0}});
});
it('paginates up to the configured cap and labels cap-bound evidence',async()=>{
  vi.stubEnv('GSC_ROW_CAP','25001');
  mocks.query.mockResolvedValueOnce({data:{rows:Array.from({length:25000},()=>row())}}).mockResolvedValueOnce({data:{rows:[row('other')]}});
  const result=await siteQueryRows(config(),period);
  expect(result.rows).toHaveLength(25001);expect(result.truncated).toBe(true);
  expect(mocks.query.mock.calls[1][0].requestBody).toMatchObject({startRow:25000,rowLimit:1});
});
it('does not invent missing numbers or silently accept the wrong aggregation',async()=>{
  mocks.query.mockResolvedValueOnce({data:{rows:[{...row(),clicks:undefined}]}});
  await expect(siteQueryRows(config(),period)).rejects.toThrow('numeric');
  mocks.query.mockResolvedValueOnce({data:{responseAggregationType:'byPage',rows:[row()]}});
  await expect(siteQueryRows(config(),period)).rejects.toThrow('aggregation');
  vi.stubEnv('GSC_ROW_CAP','NaN');await expect(siteQueryRows(config(),period)).rejects.toThrow('positive integer');
});
