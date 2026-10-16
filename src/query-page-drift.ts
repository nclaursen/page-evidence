import {pageKey,type Config,type Query} from './core.js';
import type {QueryPageRow} from './google.js';

export type DriftOptions={query?:string;limit?:number;pageLimit?:number};
type Metrics={clicks:number;impressions:number;ctr:number|null;position:number|null};
type Totals={clicks:number;impressions:number;weightedPosition:number};
type PageEvidence={key:string;url:string;urls:Set<string>;current:Totals|null;previous:Totals|null};
type QueryEvidence={query:string;pages:Map<string,PageEvidence>};
const totals=():Totals=>({clicks:0,impressions:0,weightedPosition:0});
const add=(target:Totals,row:Query)=>{target.clicks+=row.clicks;target.impressions+=row.impressions;target.weightedPosition+=row.position*row.impressions};
const metrics=(value:Totals|null):Metrics|null=>value?{clicks:value.clicks,impressions:value.impressions,ctr:value.impressions?value.clicks/value.impressions:null,position:value.impressions?value.weightedPosition/value.impressions:null}:null;

/** Descriptive changes in bounded GSC observations, not cannibalization or cause. */
export function queryPageDrift(current:QueryPageRow[],previous:QueryPageRow[],c:Pick<Config,'domain'|'trackingParams'>,options:DriftOptions={}){
  const limit=options.limit??5,pageLimit=options.pageLimit??5,groups=new Map<string,QueryEvidence>();
  const excluded={current:0,previous:0};
  for(const [side,rows]of [['current',current],['previous',previous]] as const)for(const row of rows){
    if(options.query!==undefined&&row.query!==options.query)continue;
    const key=pageKey(row.url,c);
    if(!key||!row.query){excluded[side]++;continue}
    let group=groups.get(row.query);if(!group){group={query:row.query,pages:new Map()};groups.set(row.query,group)}
    let page=group.pages.get(key);if(!page){page={key,url:row.url,urls:new Set(),current:null,previous:null};group.pages.set(key,page)}
    page.urls.add(row.url);if(row.url.localeCompare(page.url)<0)page.url=row.url;
    const sum=page[side]??totals();add(sum,row);page[side]=sum;
  }
  const evidence=[...groups.values()].map(group=>{
    const pages=[...group.pages.values()];
    const period=(side:'current'|'previous')=>{
      const observed=pages.filter(page=>page[side]!==null);if(!observed.length)return null;
      const sum=totals();for(const page of observed){const value=page[side]!;sum.clicks+=value.clicks;sum.impressions+=value.impressions;sum.weightedPosition+=value.weightedPosition}
      const maximum=observed.reduce((maximum,page)=>Math.max(maximum,page[side]!.impressions),0);
      const leaders=observed.filter(page=>page[side]!.impressions===maximum).sort((a,b)=>a.key.localeCompare(b.key));
      return{...metrics(sum)!,observedPages:observed.length,leadingPages:leaders.slice(0,pageLimit).map(page=>({key:page.key,url:page.url,impressions:page[side]!.impressions})),leadingPageCount:leaders.length,leadingPagesTruncated:leaders.length>pageLimit};
    };
    const now=period('current'),before=period('previous'),hasBoth=Boolean(now&&before&&now.impressions>0&&before.impressions>0);
    const leadingPageChanged=hasBoth&&now!.leadingPageCount===1&&before!.leadingPageCount===1?now!.leadingPages[0].key!==before!.leadingPages[0].key:null;
    const observedPageSetChanged=hasBoth?pages.some(page=>!page.current||!page.previous):null;
    const state=!hasBoth?'insufficient_comparison':leadingPageChanged?'leading_page_changed':observedPageSetChanged?'observed_page_set_changed':'unchanged';
    // Keep changed unique leaders visible before filling remaining page slots by volume.
    const leaderKeys=new Set([...(now?.leadingPageCount===1?now.leadingPages:[]),...(before?.leadingPageCount===1?before.leadingPages:[])].map(page=>page.key));
    pages.sort((a,b)=>Number(leaderKeys.has(b.key))-Number(leaderKeys.has(a.key))||Math.max(b.current?.impressions??0,b.previous?.impressions??0)-Math.max(a.current?.impressions??0,a.previous?.impressions??0)||a.key.localeCompare(b.key));
    const returned=pages.slice(0,pageLimit).map(page=>({key:page.key,url:page.url,sourceUrls:[...page.urls].sort().slice(0,3),sourceUrlCount:page.urls.size,sourceUrlsTruncated:page.urls.size>3,current:metrics(page.current),previous:metrics(page.previous),clickChange:page.current&&page.previous?page.current.clicks-page.previous.clicks:null,impressionChange:page.current&&page.previous?page.current.impressions-page.previous.impressions:null}));
    return{query:group.query,state,current:now,previous:before,flags:{leadingPageChanged,observedPageSetChanged,ambiguousLeader:hasBoth&&(now!.leadingPageCount>1||before!.leadingPageCount>1)},pages:returned,coverage:{observedPageCount:pages.length,pagesReturned:returned.length,pagesTruncated:pages.length>pageLimit}};
  }).sort((a,b)=>Math.max(b.current?.impressions??0,b.previous?.impressions??0)-Math.max(a.current?.impressions??0,a.previous?.impressions??0)||a.query.localeCompare(b.query));
  const changed=evidence.filter(item=>item.state==='leading_page_changed'||item.state==='observed_page_set_changed');
  return{candidates:(options.query===undefined?changed:evidence).slice(0,limit),counts:{queriesObserved:evidence.length,changedQueries:changed.length,insufficientComparison:evidence.filter(item=>item.state==='insufficient_comparison').length,ambiguousLeader:evidence.filter(item=>item.flags.ambiguousLeader).length},coverage:{excludedRows:excluded,resultLimit:limit,pageLimit,eligibleQueries:options.query===undefined?changed.length:evidence.length},selection:options.query===undefined?{mode:'discovery' as const}:{mode:'exact_query' as const,query:options.query,observed:evidence.length>0}};
}
