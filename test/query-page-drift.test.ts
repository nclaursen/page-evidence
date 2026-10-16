import {describe,expect,it} from 'vitest';
import {queryPageDrift} from '../src/query-page-drift.js';

const c={domain:'example.test',trackingParams:['utm_source']};
const row=(url:string,impressions:number,clicks=0,query='cms guide',position=5)=>({query,url,impressions,clicks,ctr:impressions?clicks/impressions:0,position});

describe('observed query-to-page drift',()=>{
  it('returns both periods and page metrics for a changed unique impression leader',()=>{
    const result=queryPageDrift([row('/a',20,1),row('/b',200,10)],[row('/a',100,5),row('/b',10,0)],c);
    expect(result.counts).toMatchObject({queriesObserved:1,changedQueries:1});
    expect(result.candidates[0]).toMatchObject({query:'cms guide',state:'leading_page_changed',flags:{leadingPageChanged:true,observedPageSetChanged:false},current:{impressions:220,clicks:11},previous:{impressions:110,clicks:5}});
    expect(result.candidates[0].pages.find(p=>p.key==='example.test/b')).toMatchObject({current:{clicks:10,impressions:200},previous:{clicks:0,impressions:10},clickChange:10,impressionChange:190});
  });
  it('keeps an absent page unavailable instead of inventing zeroes',()=>{
    const result=queryPageDrift([row('/b',100)],[row('/a',100)],c);
    expect(result.candidates[0].pages.find(p=>p.key==='example.test/a')).toMatchObject({current:null,previous:{impressions:100},clickChange:null,impressionChange:null});
    expect(result.candidates[0].flags).toMatchObject({leadingPageChanged:true,observedPageSetChanged:true});
  });
  it('does not discover drift from queries seen in only one period, but exposes selected-query gaps',()=>{
    expect(queryPageDrift([row('/a',1)],[],c)).toMatchObject({candidates:[],counts:{insufficientComparison:1}});
    const selected=queryPageDrift([row('/a',1)],[],c,{query:'cms guide'});
    expect(selected.candidates[0]).toMatchObject({state:'insufficient_comparison',previous:null,flags:{leadingPageChanged:null,observedPageSetChanged:null}});
    expect(queryPageDrift([],[],c,{query:'missing'}).selection).toEqual({mode:'exact_query',query:'missing',observed:false});
  });
  it('never assigns an arbitrary unique leader to tied pages',()=>{
    const now=[row('/a',100),row('/b',100)],before=[row('/a',100),row('/b',90)];
    expect(queryPageDrift(now,before,c).candidates).toEqual([]);
    const selected=queryPageDrift(now,before,c,{query:'cms guide'}).candidates[0];
    expect(selected).toMatchObject({state:'unchanged',flags:{leadingPageChanged:null,ambiguousLeader:true},current:{leadingPageCount:2}});
    const changedSet=queryPageDrift([row('/b',100),row('/c',100)],before,c).candidates[0];
    expect(changedSet).toMatchObject({state:'observed_page_set_changed',flags:{leadingPageChanged:null,observedPageSetChanged:true}});
  });
  it('keeps exact query strings separate rather than grouping case or intent variants',()=>{
    const result=queryPageDrift([row('/b',100,0,'CMS guide')],[row('/a',100,0,'cms guide')],c);
    expect(result.candidates).toEqual([]);expect(result.counts.insufficientComparison).toBe(2);
    expect(queryPageDrift([row('/a',10,0,'another query')],[],c,{query:'cms guide'}).candidates).toEqual([]);
  });
  it('aggregates aliases with weighted position and recomputed CTR while keeping subdomains distinct',()=>{
    const now=[row('https://example.test/a?utm_source=x',100,10,'cms guide',4),row('http://www.example.test/a?utm_source=y',100,0,'cms guide',8),row('https://docs.example.test/a',50,1)];
    const result=queryPageDrift(now,[row('/a',100)],c,{query:'cms guide'}).candidates[0];
    expect(result.pages.find(p=>p.key==='example.test/a')).toMatchObject({sourceUrlCount:3,current:{clicks:10,impressions:200,ctr:.05,position:6}});
    expect(result.pages.find(p=>p.key==='docs.example.test/a')?.current?.impressions).toBe(50);
  });
  it('preserves meaningful URL differences and excludes foreign hosts and empty queries',()=>{
    const now=[row('/A?q=x',10),row('/A?q=y',10),row('/A/',10),row('https://foreign.test/A/',100),row('/empty',10,0,'')];
    const result=queryPageDrift(now,[row('/A?q=x',100)],c,{query:'cms guide'});
    expect(result.candidates[0].coverage.observedPageCount).toBe(3);
    expect(result.coverage.excludedRows.current).toBe(1);
    expect(queryPageDrift(now,[],c).coverage.excludedRows.current).toBe(2);
  });
  it('bounds output but keeps both unique leaders visible and reports truncated URL variants',()=>{
    const now=[row('/a?utm_source=1',1),row('/a?utm_source=2',1),row('/a?utm_source=3',1),row('/a?utm_source=4',1),row('/b',1000),row('/c',900)];
    const before=[row('/a',100),row('/b',1),row('/c',99)];
    const result=queryPageDrift(now,before,c,{pageLimit:2}).candidates[0];
    expect(result.pages.map(p=>p.key).sort()).toEqual(['example.test/a','example.test/b']);
    expect(result.coverage).toMatchObject({observedPageCount:3,pagesReturned:2,pagesTruncated:true});
    expect(result.pages.find(p=>p.key==='example.test/a')).toMatchObject({sourceUrlCount:5,sourceUrlsTruncated:true});
  });
  it('reports considered/changed counts before limiting results and sorts deterministically',()=>{
    const now=[row('/new',100,0,'b'),row('/new',200,0,'a')],before=[row('/old',100,0,'b'),row('/old',200,0,'a')];
    const result=queryPageDrift(now,before,c,{limit:1});
    expect(result.candidates.map(x=>x.query)).toEqual(['a']);expect(result.counts.changedQueries).toBe(2);expect(result.coverage.eligibleQueries).toBe(2);
  });
  it('does not treat zero-impression rows as a comparable leadership observation',()=>{
    expect(queryPageDrift([row('/a',0)],[row('/b',0)],c,{query:'cms guide'}).candidates[0]).toMatchObject({state:'insufficient_comparison',current:{ctr:null,position:null}});
  });
});
