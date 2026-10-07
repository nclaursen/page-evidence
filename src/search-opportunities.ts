import {createHash} from 'node:crypto';
import * as z from 'zod/v4';
import {normalize,type AnalyticsEvidence,type Config,type DecisionReadiness,type Page,type Period,type Query} from './core.js';
import type {ExternalSearchDataset,ExternalSearchObservation} from './external-search.js';
import {isInstructionLike,queryTextMode} from './query-safety.js';

export const searchActions=['IMPROVE','EXPAND','CREATE','CONSOLIDATE','IGNORE'] as const;
export type SearchAction=typeof searchActions[number];
export type Level='low'|'medium'|'high';
export const assessmentSchema=z.object({
  candidateId:z.string().regex(/^search_[a-f0-9]{16}$/),action:z.enum(['EXPAND','CREATE','CONSOLIDATE']),
  source:z.enum(['model_inference','derived']),rationale:z.string().min(1).max(1000),
  evidenceRefs:z.array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)).min(2).max(30),relevant:z.boolean(),intentFit:z.boolean(),
  coverageGap:z.boolean().optional(),inventoryReviewed:z.boolean().optional(),
  redundantIntent:z.boolean().optional(),relatedUrls:z.array(z.string().url()).max(5).optional()
});
export type SearchAssessment=z.infer<typeof assessmentSchema>;
export type SearchSourceContext={configured:boolean;sources?:{file:string;mapping:string;title:string|null;matchingHeadings:{heading:string;matchedTerms:string[]}[];excerpts:{text:string;matchedTerms:string[]}[]}[]};
export type SearchPageContext={url:string;current:Query[];previous:Query[];truncated:boolean;fetchedAt?:string;sourceContext?:SearchSourceContext;error?:string};
export type SearchSnapshot={id:string;profile:string;analyticsProvider:Config['analyticsProvider'];createdAt:string;range:{current:Period;previous:Period};gsc:Page[];previousGsc:Page[];analytics:{current:AnalyticsEvidence;previous:AnalyticsEvidence};coverage:{readiness:DecisionReadiness}};
export type SearchEvidence={id:string;source:string;kind:'observed'|'derived'|'model_inference'|'user_inference';summary:string;data:unknown;inputRefs?:string[]};
export type SearchOpportunity={
  id:string;action:SearchAction;targetUrl:string|null;relatedUrls:string[];
  queries:{query:string;match:'exact'|'external_only'|'gsc_only'}[];
  grouping:{kind:'verified_page'|'exact_query_overlap'|'unmatched_query';semanticCluster:false};
  potential:Level;confidence:Level;effort:null;reviewRequired:boolean;
  recommendedAction:string;reasoningSummary:string;reasonCode:string;
  decisionReadiness:DecisionReadiness;supportingEvidence:SearchEvidence[];contradictingEvidence:SearchEvidence[];missingEvidence:string[];
  independentSupport:boolean;prioritySignals:{firstPartyImpressions:number;exactQueryImpressions:number;externalDemandLowerBound:number|null};
  externalContribution:{matchedObservations:number;independentDemandSupport:boolean};
};
export type SearchOptions={limit?:number;action?:SearchAction;requireIndependentSupport?:boolean;minimumImpressions?:number;minimumDemand?:number;maxExternalAgeDays?:number};

export function queryKey(query:string){return query.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()}
// Retain host identity in the key. Reusing the path normalizer without this
// boundary would equate a competitor's /guide with the configured site's /guide.
export function sitePageKey(raw:string,c:Pick<Config,'domain'|'trackingParams'>){
  try{const domain=new URL(`https://${c.domain}`).hostname.toLowerCase(),url=new URL(raw,`https://${domain}`);
    if(!['http:','https:'].includes(url.protocol)||!(url.hostname===domain||url.hostname===`www.${domain}`||domain.startsWith('www.')&&url.hostname===domain.slice(4)||url.hostname.endsWith(`.${domain}`)))return null;
    const host=url.hostname===`www.${domain}`?domain:domain.startsWith('www.')&&url.hostname===domain.slice(4)?domain:url.hostname;
    return host+normalize(url.toString(),c as Config);
  }catch{return null}
}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex').slice(0,16);
const usableQuery=(query:string)=>!isInstructionLike(query);
const monthlyDemand=(observation:ExternalSearchObservation)=>observation.searchDemand?.unit==='searches_per_month'?(observation.searchDemand.value??observation.searchDemand.range?.min??0):null;
function boundedSource(context:SearchSourceContext):SearchSourceContext{return{configured:context.configured,sources:context.sources?.slice(0,2).map(source=>({...source,matchingHeadings:source.matchingHeadings.slice(0,3),excerpts:source.excerpts.slice(0,2).map(x=>({...x,text:x.text.slice(0,300)}))}))}}
export function discoverSearchPages(snapshot:SearchSnapshot,external:ExternalSearchDataset|undefined,c:Config,budget:number,minimumImpressions=100){
  const externalKeys=new Set(external?.observations.filter(x=>x.state==='current'&&x.rankingUrl).map(x=>sitePageKey(x.rankingUrl!,c)).filter(Boolean));
  return snapshot.gsc.filter(page=>sitePageKey(page.url,c)).sort((a,b)=>{
    const tier=(p:Page)=>p.impressions>=minimumImpressions?2:externalKeys.has(sitePageKey(p.url,c))?1:0;
    return tier(b)-tier(a)||b.impressions-a.impressions||a.url.localeCompare(b.url);
  }).slice(0,budget);
}

type Group={key:string;pages:Page[];external:ExternalSearchObservation[];queries:Map<string,string>};
export function analyzeSearchOpportunities(input:{snapshot:SearchSnapshot;contexts:SearchPageContext[];external?:ExternalSearchDataset;config:Config;assessments?:SearchAssessment[];options?:SearchOptions;now?:Date}){
  const {snapshot,contexts,external,config:c}=input,options=input.options??{},limit=options.limit??10;
  const thresholds={minimumImpressions:options.minimumImpressions??100,minimumDemand:options.minimumDemand??100,maxExternalAgeDays:options.maxExternalAgeDays??90};
  if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('limit must be a whole number from 1 to 20.');
  for(const value of Object.values(thresholds))if(!Number.isFinite(value)||value<1)throw Error('Opportunity thresholds must be positive finite numbers.');
  if(options.action&&!searchActions.includes(options.action))throw Error('Unknown search action.');
  if(external&&(external.profile!==c.profile||external.siteScope.domain!==c.domain||external.siteScope.gscProperty!==c.gscProperty))throw Error('External dataset belongs to a different profile or site scope.');
  const assessments=(input.assessments??[]).map(x=>assessmentSchema.parse(x));
  if(new Set(assessments.map(x=>x.candidateId)).size!==assessments.length)throw Error('Duplicate candidate assessments are ambiguous.');
  const contextByKey=new Map(contexts.map(x=>[sitePageKey(x.url,c),x]));
  const pageByKey=new Map(snapshot.gsc.flatMap(p=>{const key=sitePageKey(p.url,c);return key?[[key,p] as const]:[]}));
  const gscQueryPages=new Map<string,Set<string>>(),groups=new Map<string,Group>();
  for(const [key,page]of pageByKey){const context=contextByKey.get(key),queries=new Map<string,string>();
    for(const row of context?.current??[])if(usableQuery(row.query)){const q=queryKey(row.query);queries.set(q,row.query);const pages=gscQueryPages.get(q)??new Set();pages.add(key);gscQueryPages.set(q,pages)}
    groups.set(key,{key,pages:[page],external:[],queries});
  }
  for(const row of external?.observations??[]){
    if(!usableQuery(row.query))continue;
    const q=queryKey(row.query),urlKey=row.rankingUrl?sitePageKey(row.rankingUrl,c):null;
    const exactPages=gscQueryPages.get(q);
    const targets=urlKey&&groups.has(urlKey)?[urlKey]:exactPages?.size?[...exactPages]:[];
    if(targets.length)for(const key of targets){const group=groups.get(key)!;group.external.push(row);group.queries.set(q,row.query)}
    else{const key='unmatched:'+q;const group:Group=groups.get(key)??{key,pages:[],external:[],queries:new Map()};group.external.push(row);group.queries.set(q,row.query);groups.set(key,group)}
  }
  // Shared queries are evidence of overlap only. Consolidation requires an
  // explicit, referenced intent assessment and measured performance concern.
  const opportunities:SearchOpportunity[]=[],assessmentWarnings:string[]=[];
  const now=input.now??new Date();
  for(const group of groups.values()){
    const id='search_'+hash(group.key),page=group.pages[0],context=page?contextByKey.get(sitePageKey(page.url,c)):undefined;
    const currentQueries=context?.current.filter(x=>usableQuery(x.query))??[];
    const queryMetrics=new Map<string,Query>();for(const query of currentQueries){const key=queryKey(query.query);if(query.impressions>(queryMetrics.get(key)?.impressions??-1))queryMetrics.set(key,query)}
    // The actual decision inputs are bounded along with their returned evidence,
    // rather than scoring hidden rows and returning unrelated examples.
    const selectedExternal=[...group.external].sort((a,b)=>{
      const exact=(x:ExternalSearchObservation)=>x.state!=='historical'&&(queryMetrics.get(queryKey(x.query))?.impressions??0)>=25?1:0;
      return exact(b)-exact(a)||(monthlyDemand(b)??0)-(monthlyDemand(a)??0)||a.id.localeCompare(b.id);
    }).slice(0,10);
    const refs:SearchEvidence[]=[],contradicting:SearchEvidence[]=[],missing:string[]=[];
    const relatedKeys=new Set<string>();for(const q of group.queries.keys())for(const key of gscQueryPages.get(q)??[])if(key!==group.key)relatedKeys.add(key);
    const relatedPages=[...relatedKeys].map(x=>pageByKey.get(x)!).filter(Boolean);
    let relatedUrls=relatedPages.map(x=>x.url).slice(0,5);
    const pageEvidence=(p:Page)=>({id:'gsc_page_'+hash(sitePageKey(p.url,c)!),source:'gsc',kind:'observed' as const,summary:'Measured page performance; all countries, devices and search appearances.',data:{snapshotId:snapshot.id,period:snapshot.range.current,...p}});
    if(page)refs.push(pageEvidence(page));
    for(const p of relatedPages.slice(0,5))refs.push(pageEvidence(p));
    const selectedExternalKeys=new Set(selectedExternal.map(x=>queryKey(x.query)));
    const selectedQueries=currentQueries.filter(x=>group.queries.has(queryKey(x.query))).sort((a,b)=>Number(selectedExternalKeys.has(queryKey(b.query)))-Number(selectedExternalKeys.has(queryKey(a.query)))||b.impressions-a.impressions).slice(0,10);
    for(const row of selectedQueries){
      const e={id:'gsc_query_'+hash(group.key+'\0'+row.query),source:'gsc',kind:'observed' as const,summary:'Measured query on this page; bounded fetched rows, not complete coverage.',data:{...row,snapshotId:snapshot.id,period:snapshot.range.current,fetchedAt:context?.fetchedAt}};refs.push(e);
    }
    const sourceContext=context?.sourceContext;
    if(sourceContext?.sources?.length)refs.push({id:'page_evidence_'+hash(group.key),source:'page_evidence',kind:'observed',summary:'Bounded local source headings and excerpts; source mapping does not prove answer quality.',data:boundedSource(sourceContext)});
    else missing.push('Verified page content and answer-quality assessment.');
    for(const related of relatedPages.slice(0,5)){const key=sitePageKey(related.url,c)!,source=contextByKey.get(key)?.sourceContext;
      if(source?.sources?.length)refs.push({id:'page_evidence_'+hash(key),source:'page_evidence',kind:'observed',summary:'Bounded source context for an overlapping page; shared intent remains a review judgment.',data:boundedSource(source)});
    }
    if(page){const key=sitePageKey(page.url,c),rows=snapshot.analytics.current.rows.filter(x=>sitePageKey(x.url,c)===key);
      if(rows.length)refs.push({id:'analytics_'+hash(group.key),source:snapshot.analyticsProvider,kind:'observed',summary:'Provider-scoped page analytics; no query attribution or causal interpretation.',data:{period:snapshot.range.current,rows:rows.slice(0,10),metricLabels:snapshot.analytics.current.metricLabels,coverage:snapshot.analytics.current.coverage}});
      else missing.push('Useful page-level analytics/business evidence.');
    }
    const historical=selectedExternal.filter(x=>x.state==='historical');
    const dated=selectedExternal.filter(x=>x.state!=='historical'&&x.observedAt&&Date.parse(x.observedAt.slice(0,10))<=now.getTime()&&now.getTime()-Date.parse(x.observedAt.slice(0,10))<=thresholds.maxExternalAgeDays*86400000);
    const usableExternal=selectedExternal.filter(x=>x.state!=='historical'&&(!x.observedAt||dated.includes(x)));
    const demands=usableExternal.flatMap(x=>monthlyDemand(x)===null?[]:[monthlyDemand(x)!]);
    const demand=demands.length?Math.max(...demands):null;
    const matched=usableExternal.filter(x=>selectedQueries.some(q=>queryKey(q.query)===queryKey(x.query)&&q.impressions>=25));
    const independent=matched.some(x=>(monthlyDemand(x)??0)>=thresholds.minimumDemand);
    for(const row of selectedExternal){
      const evidence:SearchEvidence={id:row.id,source:external!.provider,kind:'observed',summary:row.state==='historical'?'Historical provider observation; missing current rank does not imply a missing page.':'External provider estimates; not measured traffic.',data:{query:row.query,state:row.state,rankingUrl:row.rankingUrl,country:row.country,languages:row.languages,observedAt:row.observedAt,position:row.position,searchDemand:row.searchDemand,competitiveness:row.competitiveness,estimatedTraffic:row.estimatedTraffic,intents:row.intents,sourceRef:row.sourceRef,providerContext:{positionKind:row.providerSpecific.positionKind,serpFeatures:row.providerSpecific.serpFeatures}}};
      (row.state==='historical'||!usableExternal.includes(row)?contradicting:refs).push(evidence);
    }
    if(group.external.length){missing.push('Market comparability: GSC is all-country evidence; external market estimates cannot be subtracted from impressions.');
      if(group.external.length>selectedExternal.length)missing.push('Only the selected ten external observations contribute to this candidate; additional local observations were omitted.');
      if(!dated.length)missing.push('Recent, dated external demand observations.');
      if(usableExternal.some(x=>x.intents.includes('navigational')))contradicting.push({id:'intent_'+id,source:'derived',kind:'derived',summary:'Navigational intent may have weak fit for a new informational page.',data:{rule:'navigational_intent_requires_review'},inputRefs:usableExternal.filter(x=>x.intents.includes('navigational')).slice(0,10).map(x=>x.id)});
    }else missing.push('External search-market corroboration.');
    if(page&&!context)missing.push('This page was not selected for bounded query/source enrichment.');
    if(context?.truncated||context?.error)missing.push('Complete query retrieval within the configured cap.');
    const prior=page?snapshot.previousGsc.find(x=>sitePageKey(x.url,c)===group.key):undefined;
    const readiness=context?.truncated||context?.error?{...snapshot.coverage.readiness,state:'incomplete_coverage' as const,reasons:[...snapshot.coverage.readiness.reasons,context.error??'Page query cap reached.']}:snapshot.coverage.readiness;
    const mature=Boolean(prior&&prior.impressions>=c.minimumBaselineImpressions);
    const traction=Boolean(page&&page.impressions>=thresholds.minimumImpressions);
    const upside=Boolean(page&&((page.position>=4&&page.position<=20)||(prior&&prior.clicks-page.clicks>=3)));
    const matchedKeys=new Set(matched.map(x=>queryKey(x.query)));
    const exactQueryImpressions=selectedQueries.filter(q=>matchedKeys.has(queryKey(q.query))).reduce((sum,q)=>sum+q.impressions,0);
    let action:SearchAction='IGNORE',reasonCode='insufficient_evidence',summary='Evidence does not justify adding this opportunity to the work backlog.';
    if(traction&&upside&&context&&readiness.state==='ready'){action='IMPROVE';reasonCode='first_party_traction_with_upside';summary='An existing page has measured traction and plausible ranking or recovery upside. Inspect intent and page content before editing.'}
    else if(page&&traction&&!upside){reasonCode='no_identified_upside';summary='The page has traction, but these signals do not identify a defensible improvement or expansion.'}
    else if(!page&&historical.length===selectedExternal.length&&historical.length){reasonCode='historical_only';summary='Previous rankings do not establish a present content gap.'}
    if(!page)missing.push('Suitable existing-page inventory search, site relevance and intent-fit assessment.');
    if(page&&!mature)missing.push('A mature first-party baseline; this page may still be maturing.');
    const assessment=assessments.find(x=>x.candidateId===id);
    if(assessment){
      const knownRefs=new Set([...refs,...contradicting].map(x=>x.id));
      // CREATE assessments may reference adjacent observed pages, but must cite
      // content from an inspected page as well as a measured first-party signal.
      if(!page)for(const ctx of contexts){const p=pageByKey.get(sitePageKey(ctx.url,c)!);if(!p)continue;const e=pageEvidence(p);if(assessment.evidenceRefs.includes(e.id))refs.push(e);
        const sourceId='page_evidence_'+hash(sitePageKey(ctx.url,c)!);if(ctx.sourceContext?.sources?.length&&assessment.evidenceRefs.includes(sourceId))refs.push({id:sourceId,source:'page_evidence',kind:'observed',summary:'Adjacent local page source supporting relevance review.',data:boundedSource(ctx.sourceContext)});
      }
      for(const e of refs)knownRefs.add(e.id);
      const selectedRefs=refs.filter(x=>assessment.evidenceRefs.includes(x.id));
      const refsValid=queryTextMode()!=='omit'&&assessment.evidenceRefs.every(x=>knownRefs.has(x));
      const valid=refsValid&&assessment.relevant&&assessment.intentFit;
      const citesSource=selectedRefs.some(x=>x.source==='page_evidence');
      const citesExternal=selectedRefs.some(x=>x.source===external?.provider);
      const citesGsc=selectedRefs.some(x=>x.source==='gsc'&&(x.data as Page).impressions>=thresholds.minimumImpressions);
      let accepted=false;
      if(valid&&readiness.state==='ready'&&citesSource){
        if(assessment.action==='EXPAND'&&page&&traction&&context&&!context.truncated&&!context.error&&assessment.coverageGap&&demand!==null&&demand>=thresholds.minimumDemand&&citesExternal&&citesGsc){action='EXPAND';accepted=true;reasonCode='reviewed_existing_page_gap';summary='Measured page traction and external demand support a reviewed coverage gap on this existing page.'}
        if(assessment.action==='CREATE'&&!page&&assessment.coverageGap&&assessment.inventoryReviewed&&citesExternal&&citesGsc&&demand!==null&&demand>=thresholds.minimumDemand&&dated.length&&!historical.length){action='CREATE';accepted=true;reasonCode='reviewed_inventory_gap';summary='External demand, adjacent first-party traction and an explicit inventory/intent review support investigating a new page.'}
        const selectedRelated=relatedPages.filter(p=>assessment.relatedUrls?.includes(p.url));
        const meaningfulOverlap=(p:Page)=>{const ctx=contextByKey.get(sitePageKey(p.url,c)!);return ctx&&!ctx.truncated&&!ctx.error&&ctx.current.some(q=>q.impressions>=25&&currentQueries.some(other=>other.impressions>=25&&queryKey(other.query)===queryKey(q.query)))};
        if(assessment.action==='CONSOLIDATE'&&page&&mature&&traction&&assessment.redundantIntent&&selectedRelated.length&&prior&&prior.clicks-page.clicks>=3&&assessment.evidenceRefs.includes(pageEvidence(page).id)&&selectedRelated.every(p=>meaningfulOverlap(p)&&selectedRefs.some(e=>e.id===pageEvidence(p).id)&&selectedRefs.some(e=>e.id==='page_evidence_'+hash(sitePageKey(p.url,c)!)))){action='CONSOLIDATE';accepted=true;relatedUrls=selectedRelated.map(p=>p.url);reasonCode='reviewed_redundancy_and_decline';summary='Exact-query overlap, measured decline and reviewed redundant intent justify a consolidation investigation; harmful cannibalization is not established.'}
      }
      if(accepted)refs.push({id:'assessment_'+id,source:assessment.source,kind:assessment.source==='model_inference'?'model_inference':'user_inference',summary:'Explicit client/reviewer interpretation; not an observed fact.',data:assessment,inputRefs:assessment.evidenceRefs});
      else{assessmentWarnings.push(`Assessment for ${id} did not pass evidence gates.`);missing.push('Assessment did not pass referenced-evidence, relevance, intent or action-specific gates.');
        contradicting.push({id:'assessment_rejected_'+id,source:assessment.source,kind:assessment.source==='model_inference'?'model_inference':'user_inference',summary:'The supplied interpretation did not pass the action-specific evidence gates.',data:assessment,inputRefs:assessment.evidenceRefs.filter(x=>knownRefs.has(x))});
        if(refsValid&&citesSource&&(!assessment.relevant||!assessment.intentFit)){action='IGNORE';reasonCode='reviewed_poor_fit';summary='A referenced relevance or intent review contradicts pursuing this candidate.'}
      }
    }
    const confidence:Level=action==='IGNORE'?'low':independent&&matched.some(x=>dated.includes(x)&&(monthlyDemand(x)??0)>=thresholds.minimumDemand)&&sourceContext?.sources?.length&&mature?'high':mature?'medium':'low';
    const potential:Level=action==='IGNORE'?'low':traction&&page!.impressions>=1000&&independent?'high':'medium';
    const recommendation:Record<SearchAction,string>={IMPROVE:'Inspect query intent and the existing page, then propose a focused improvement.',EXPAND:'Review the cited gap and expand the existing page before proposing another URL.',CREATE:'Review inventory and intent evidence, then decide whether a new page is justified.',CONSOLIDATE:'Review both pages, intent, links and historical movement before deciding on consolidation.',IGNORE:'Defer or reject this candidate until the missing evidence changes.'};
    const queryRows=[...group.queries.entries()].map(([key,query])=>({query,match:(currentQueries.some(x=>queryKey(x.query)===key)?group.external.some(x=>queryKey(x.query)===key)?'exact':'gsc_only':'external_only') as 'exact'|'gsc_only'|'external_only'})).slice(0,10);
    refs.push({id:'classification_'+id,source:'derived',kind:'derived',summary:summary,data:{rule:reasonCode,thresholds,traction,upside,mature,demandLowerBound:demand,independentSupport:independent},inputRefs:[...refs,...contradicting].map(x=>x.id)});
    opportunities.push({id,action,targetUrl:page?.url??null,relatedUrls,queries:queryRows,grouping:{kind:action==='CONSOLIDATE'?'exact_query_overlap':page?'verified_page':'unmatched_query',semanticCluster:false},potential,confidence,effort:null,reviewRequired:true,recommendedAction:recommendation[action],reasoningSummary:summary,reasonCode,
      decisionReadiness:!mature&&page&&readiness.state==='ready'?{...readiness,state:'maturing',reasons:[...readiness.reasons,'Prior page impressions are below the mature-baseline threshold.']}:readiness,
      supportingEvidence:refs,contradictingEvidence:contradicting,missingEvidence:missing,independentSupport:independent,
      prioritySignals:{firstPartyImpressions:page?.impressions??0,exactQueryImpressions,externalDemandLowerBound:demand},externalContribution:{matchedObservations:matched.length,independentDemandSupport:independent}});
  }
  for(const consolidation of opportunities.filter(x=>x.action==='CONSOLIDATE'))for(const candidate of opportunities){
    if(candidate.id!==consolidation.id&&candidate.action!=='CONSOLIDATE'&&candidate.targetUrl&&consolidation.relatedUrls.includes(candidate.targetUrl)){
      candidate.action='IGNORE';candidate.potential='low';candidate.confidence='low';candidate.reasonCode='covered_by_consolidation_review';candidate.reasoningSummary='Defer separate work on this page until its related consolidation investigation is reviewed.';candidate.recommendedAction='Review the related consolidation candidate first.';
      candidate.supportingEvidence=candidate.supportingEvidence.filter(x=>x.id!=='classification_'+candidate.id);
      candidate.supportingEvidence.push({id:'classification_'+candidate.id,source:'derived',kind:'derived',summary:candidate.reasoningSummary,data:{rule:candidate.reasonCode,relatedCandidateId:consolidation.id,relatedAction:consolidation.action,targetUrl:consolidation.targetUrl},inputRefs:['classification_'+consolidation.id]});
    }
  }
  const level={high:2,medium:1,low:0};
  opportunities.sort((a,b)=>Number(b.action!=='IGNORE')-Number(a.action!=='IGNORE')||Number(b.prioritySignals.firstPartyImpressions>=thresholds.minimumImpressions)-Number(a.prioritySignals.firstPartyImpressions>=thresholds.minimumImpressions)||level[b.confidence]-level[a.confidence]||level[b.potential]-level[a.potential]||b.prioritySignals.firstPartyImpressions-a.prioritySignals.firstPartyImpressions||a.id.localeCompare(b.id));
  for(const assessment of assessments)if(!opportunities.some(x=>x.id===assessment.candidateId))assessmentWarnings.push(`Assessment candidate ${assessment.candidateId} was not found in this bounded evidence run.`);
  const filtered=opportunities.filter(x=>(!options.action||x.action===options.action)&&(!options.requireIndependentSupport||x.independentSupport));
  return{profile:c.profile,analyticsProvider:snapshot.analyticsProvider,snapshotId:snapshot.id,periods:snapshot.range,createdAt:now.toISOString(),externalDatasetId:external?.id??null,thresholds,
    sorting:['actionable first','meaningful first-party traction','confidence','potential','page impressions','stable id'],
    opportunities:filtered.filter(x=>options.action==='IGNORE'||x.action!=='IGNORE').slice(0,limit),
    ignored:filtered.filter(x=>x.action==='IGNORE').slice(0,Math.min(limit,5)),
    counts:{considered:opportunities.length,byAction:Object.fromEntries(searchActions.map(action=>[action,opportunities.filter(x=>x.action===action).length]))},assessmentWarnings,
    coverage:{knownPages:pageByKey.size,pagesInspected:contexts.length,queryTextMode:queryTextMode(),externalObservations:external?.observations.length??0,queryLimitations:'Only selected pages have query/source context. Missing fetched queries or GSC page rows do not prove absence.'},
    limitation:'Action candidates are review aids, not automatic edits. Page grouping does not assert shared intent. Potential is a qualitative triage label, not predicted traffic. No analytics-to-query attribution, live SERP calls or model calls are made.'};
}

export function renderSearchOpportunities(result:ReturnType<typeof analyzeSearchOpportunities>){
  const lines=[`Page Evidence search opportunities — ${result.profile}`,`Snapshot: ${result.snapshotId}`,`Considered: ${result.counts.considered}; ignored: ${result.counts.byAction.IGNORE}`,`Inspected pages: ${result.coverage.pagesInspected}/${result.coverage.knownPages}`,''];
  for(const opportunity of result.opportunities){lines.push(`${opportunity.action} | ${opportunity.targetUrl??'new page under review'} | potential ${opportunity.potential} | confidence ${opportunity.confidence}`,`  Candidate: ${opportunity.id}`,`  ${opportunity.reasoningSummary}`,`  Next: ${opportunity.recommendedAction}`,`  Evidence: ${opportunity.supportingEvidence.map(x=>`${x.source}:${x.id}`).join(', ')}`,`  Contradictions: ${opportunity.contradictingEvidence.map(x=>x.summary).join(' ')||'None recorded.'}`,`  Missing: ${opportunity.missingEvidence.join(' ')||'None recorded.'}`,`  Readiness: ${opportunity.decisionReadiness.state}; review required`,'');}
  if(!result.opportunities.length)lines.push('No candidate passed the requested evidence gates.');
  for(const ignored of result.ignored)lines.push(`IGNORE | ${ignored.targetUrl??ignored.id} | ${ignored.reasonCode}: ${ignored.reasoningSummary}`);
  lines.push('',result.limitation);return lines.join('\n');
}
