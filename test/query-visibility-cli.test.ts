import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({findSearchOpportunities:vi.fn()}));
vi.mock('../src/service.js',async original=>({...await original<typeof import('../src/service.js')>(),findSearchOpportunities:mocks.findSearchOpportunities}));
const argv=process.argv;
beforeEach(()=>{vi.resetModules();mocks.findSearchOpportunities.mockResolvedValue({opportunities:[],ignored:[]})});
afterEach(()=>{process.argv=argv;vi.restoreAllMocks()});
it('forwards optional visibility ranges to the existing opportunity service',async()=>{
  process.argv=['node','cli','opportunities','--query-minimum-impressions=50','--query-minimum-position=3','--query-maximum-position=12','--minimum-impressions=200'];
  vi.spyOn(console,'log').mockImplementation(()=>{});await import('../src/cli.js');
  expect(mocks.findSearchOpportunities).toHaveBeenCalledWith(expect.objectContaining({minimumImpressions:200,queryVisibility:{minimumImpressions:50,minimumPosition:3,maximumPosition:12}}));
});
it('enables visibility defaults only when explicitly requested',async()=>{
  process.argv=['node','cli','opportunities','--query-visibility'];vi.spyOn(console,'log').mockImplementation(()=>{});await import('../src/cli.js');
  expect(mocks.findSearchOpportunities).toHaveBeenCalledWith(expect.objectContaining({queryVisibility:{}}));
});
it('preserves the default CLI request without visibility filtering',async()=>{
  process.argv=['node','cli','opportunities'];vi.spyOn(console,'log').mockImplementation(()=>{});await import('../src/cli.js');
  expect(mocks.findSearchOpportunities.mock.calls.at(-1)?.[0]).not.toHaveProperty('queryVisibility');
});
