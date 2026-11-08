import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>vi.fn());
vi.mock('../src/service.js',async original=>({...await original<typeof import('../src/service.js')>(),brandSearchPerformance:mock}));
const argv=process.argv;
beforeEach(()=>{vi.resetModules();mock.mockReset().mockResolvedValue({state:'needs_configuration'});vi.spyOn(console,'log').mockImplementation(()=>{})});
afterEach(()=>{process.argv=argv;vi.restoreAllMocks()});
it('forwards explicit JSON phrases and bounded options',async()=>{
  process.argv=['node','cli','brand-search','--brand-terms=["Acme","Acme Cloud"]','--days=7','--limit=2','--refresh'];await import('../src/cli.js');
  expect(mock).toHaveBeenCalledWith({brandTerms:['Acme','Acme Cloud'],windowDays:7,limit:2,refresh:true});
});
it('retains defaults and private configuration fallback when phrases are omitted',async()=>{
  process.argv=['node','cli','brand-search'];await import('../src/cli.js');
  expect(mock).toHaveBeenCalledWith({brandTerms:undefined,windowDays:30,limit:5,refresh:false});
});
