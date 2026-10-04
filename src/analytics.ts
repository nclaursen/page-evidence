import {google} from 'googleapis';
import {config,AnalyticsEvidence,AnalyticsMetricValue,AnalyticsProviderName,AnalyticsRow,Config,normalize,Period} from './core.js';
import {oauth} from './google.js';

export type ProviderHealthState='available'|'unavailable'|'authentication_failed'|'missing_permissions'|'incompatible';
export type ProviderHealth={state:ProviderHealthState;authenticated:boolean;version?:string;reason:string};
export interface AnalyticsProvider{name:AnalyticsProviderName;capabilities():string[];landingEvidence(period:Period):Promise<AnalyticsEvidence>;health?():Promise<ProviderHealth>}

const number=(value:unknown,metric?:string):AnalyticsMetricValue=>{
  if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return null;
  const invalid=()=>Error(metric?`Analytics response contained a non-numeric ${metric} metric value.`:'Analytics response contained a non-numeric metric value.');
  if(typeof value!=='number'&&typeof value!=='string')throw invalid();
  const parsed=typeof value==='number'?value:Number(value);
  if(!Number.isFinite(parsed))throw invalid();
  return parsed;
};
const percent=(value:unknown,metric:string):AnalyticsMetricValue=>{
  if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return null;
  if(typeof value==='string'&&value.trim().endsWith('%')){
    const raw=value.trim().slice(0,-1).trim();
    if(!raw)throw Error(`Analytics response contained a non-numeric ${metric} metric value.`);
    const parsed=number(raw,metric);
    return parsed===null?null:parsed/100;
  }
  return number(value,metric);
};
const available=(labels:Record<string,string>)=>Object.fromEntries(Object.keys(labels).map(metric=>[metric,{available:true}]));

const ga4Labels={sessions:'GA4 sessions',engagedSessions:'GA4 engaged sessions',engagementRate:'GA4 engagement rate'};
export class Ga4Provider implements AnalyticsProvider{
  name='ga4' as const;
  constructor(private c:Config){}
  capabilities(){return['landing-page acquisition by session source / medium','sessions','engaged sessions','engagement rate']}
  async landingEvidence(period:Period){
    const api=google.analyticsdata({version:'v1beta',auth:oauth(this.c).client});
    const r=await api.properties.runReport({property:`properties/${this.c.ga4PropertyId}`,requestBody:{dateRanges:[{startDate:period.start,endDate:period.end}],dimensions:[{name:'landingPagePlusQueryString'},{name:'sessionSourceMedium'}],metrics:[{name:'sessions'},{name:'engagedSessions'},{name:'engagementRate'}],limit:String(this.c.analyticsCap)}});
    const rows=(r.data.rows||[]).map(x=>({url:x.dimensionValues?.[0]?.value||'',acquisition:{type:'GA4 session source / medium',value:x.dimensionValues?.[1]?.value||'(not set)'},metrics:{sessions:number(x.metricValues?.[0]?.value),engagedSessions:number(x.metricValues?.[1]?.value),engagementRate:number(x.metricValues?.[2]?.value)}}));
    return{provider:this.name,metricLabels:ga4Labels,metricAvailability:available(ga4Labels),rows,sourceSummaries:[],fetchedAt:new Date().toISOString(),period,coverage:{complete:rows.length<this.c.analyticsCap,limitations:rows.length>=this.c.analyticsCap?[`GA4 response reached the configured ${this.c.analyticsCap}-row cap.`]:[],fetchedRows:rows.length}};
  }
}

const matomoLabels={visits:'Matomo visits',pageviews:'Matomo pageviews',uniquePageviews:'Matomo unique pageviews',entries:'Matomo entries',bounceRate:'Matomo bounce rate'};
function matomoEndpoint(raw:string){const base=new URL(raw);if(base.protocol!=='https:')throw Error('MATOMO_URL must use HTTPS.');if(!base.pathname.endsWith('/'))base.pathname+='/';return new URL('index.php',base).toString()}
async function matomoRequest(c:Config,method:string,period:Period,extra:Record<string,string>={}){const params=new URLSearchParams({module:'API',method,format:'JSON',format_metrics:'0',idSite:c.matomoSiteId,period:'range',date:`${period.start},${period.end}`,filter_limit:String(c.analyticsCap),token_auth:c.matomoTokenAuth,...extra});const response=await fetch(matomoEndpoint(c.matomoUrl),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params,signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Matomo Reporting API returned HTTP ${response.status}.`);const body=await response.json() as unknown;if(body&&typeof body==='object'&&'result'in body&&(body as {result?:unknown}).result==='error')throw Error(`Matomo Reporting API error: ${String((body as {message?:unknown}).message||'unknown error')}`);return body}
export class MatomoProvider implements AnalyticsProvider{
  name='matomo' as const;
  constructor(private c:Config){}
  capabilities(){return['page URL report','site-level referrer context','Matomo visits and pageviews']}
  async landingEvidence(period:Period){
    const [pageResponse,referrerResponse]=await Promise.all([matomoRequest(this.c,'Actions.getPageUrls',period,{flat:'1'}),matomoRequest(this.c,'Referrers.getReferrerType',period)]);
    const pageRows=Array.isArray(pageResponse)?pageResponse:[],referrerRows=Array.isArray(referrerResponse)?referrerResponse:[];
    const rows=pageRows.map(row=>{const r=row as Record<string,unknown>;return{url:String(r.label||''),acquisition:null,metrics:{visits:number(r.nb_visits),pageviews:number(r.nb_hits),uniquePageviews:number(r.nb_uniq_pageviews),entries:number(r.entry_nb_visits),bounceRate:percent(r.bounce_rate,'Matomo bounce_rate')}}}).filter(row=>row.url);
    const sourceSummaries=referrerRows.map(row=>{const r=row as Record<string,unknown>;return{type:'Matomo referrer type',value:String(r.label||'(not set)'),metrics:{visits:number(r.nb_visits),actions:number(r.nb_actions),conversions:number(r.nb_conversions)}}});
    const capped=pageRows.length>=this.c.analyticsCap;
    return{provider:this.name,metricLabels:matomoLabels,metricAvailability:available(matomoLabels),rows,sourceSummaries,fetchedAt:new Date().toISOString(),period,coverage:{complete:!capped,limitations:[...(capped?[`Matomo page URL response reached the configured ${this.c.analyticsCap}-row cap.`]:[]),'Matomo referrer context is site-level in this evidence; it is not attributed to individual page rows.'],fetchedRows:rows.length}};
  }
}

const ENGAGE_TOKEN_PATH='/umbraco/management/api/v1/security/back-office/token';
const ENGAGE_PACKAGE_PATH='/umbraco/engage/management/api/v1/package';
const ENGAGE_ANALYTICS_PATH='/umbraco/engage/management/api/v1/analytics/query';
const engageLabels={pageviews:'Engage pageviews',pageSessions:'Engage page sessions',pageVisitors:'Engage page visitors',bounceRate:'Engage bounce rate',avgTimeOnPage:'Engage average time on page',avgEngagedTimeOnPage:'Engage average engaged time on page',goalCompletionsAll:'Engage goal completions'};
const engageMetrics=Object.keys(engageLabels);
const engageAdditiveMetrics=new Set(['pageviews','goalCompletionsAll']);

export class EngageProviderError extends Error{
  constructor(public kind:Exclude<ProviderHealthState,'available'>,message:string){super(message);this.name='EngageProviderError'}
}
type EngageQueryPage={columns:string[];rows:unknown[][];currentPage:number;rowsPerPage:number;totalRows:number;totalPages:number;reportsExist:boolean};

function engageBaseUrl(raw:string){
  const url=new URL(raw);
  const local=['localhost','127.0.0.1','::1'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))throw new EngageProviderError('unavailable','UMBRACO_BASE_URL must use HTTPS except for a local development host.');
  if(url.username||url.password)throw new EngageProviderError('unavailable','UMBRACO_BASE_URL must not contain credentials.');
  return url.origin;
}
function engageHttpError(status:number,path:string){
  if(status===401)return new EngageProviderError('authentication_failed',`Umbraco authentication failed while calling ${path}.`);
  if(status===403)return new EngageProviderError('missing_permissions',`The Umbraco API user does not have permission to call ${path}.`);
  if(status===404)return new EngageProviderError('incompatible',`The connected Umbraco or Engage version does not expose ${path}.`);
  return new EngageProviderError('unavailable',`Umbraco Engage returned HTTP ${status} for ${path}.`);
}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new EngageProviderError('incompatible','Umbraco Engage returned a malformed JSON object.');return value as Record<string,unknown>}
function integer(value:unknown,name:string){if(!Number.isInteger(value)||Number(value)<0)throw new EngageProviderError('incompatible',`Umbraco Engage returned an invalid ${name}.`);return Number(value)}

export class EngageProvider implements AnalyticsProvider{
  name='engage' as const;
  private accessToken='';
  private tokenExpiresAt=0;
  private tokenRequest?:Promise<string>;
  private healthRequest?:Promise<ProviderHealth>;
  private version?:string;
  constructor(private c:Config){}
  capabilities(){return['aggregated page URL report','pageviews','page sessions','page visitors','bounce rate','average time on page','average engaged time on page','goal completions']}
  private async token(){
    if(this.accessToken&&Date.now()<this.tokenExpiresAt-30000)return this.accessToken;
    if(this.tokenRequest)return this.tokenRequest;
    this.tokenRequest=(async()=>{
      const body=new URLSearchParams({client_id:this.c.umbracoClientId,client_secret:this.c.umbracoClientSecret,grant_type:'client_credentials'});
      let response:Response;
      try{response=await fetch(`${engageBaseUrl(this.c.umbracoBaseUrl)}${ENGAGE_TOKEN_PATH}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)})}catch{throw new EngageProviderError('unavailable','Could not reach the configured Umbraco instance.')}
      if(!response.ok)throw engageHttpError(response.status,ENGAGE_TOKEN_PATH);
      const json=object(await response.json());
      if(typeof json.access_token!=='string'||!json.access_token)throw new EngageProviderError('incompatible','Umbraco returned a token response without an access token.');
      const expires=typeof json.expires_in==='number'&&json.expires_in>0?json.expires_in:300;
      this.accessToken=json.access_token;this.tokenExpiresAt=Date.now()+expires*1000;return this.accessToken;
    })();
    try{return await this.tokenRequest}finally{this.tokenRequest=undefined}
  }
  private async request(path:string,init:RequestInit={}){
    const token=await this.token();
    let response:Response;
    try{response=await fetch(`${engageBaseUrl(this.c.umbracoBaseUrl)}${path}`,{...init,headers:{accept:'application/json',authorization:`Bearer ${token}`,...init.headers},signal:init.signal||AbortSignal.timeout(20000)})}catch{throw new EngageProviderError('unavailable',`Could not reach the Umbraco Engage endpoint ${path}.`)}
    if(!response.ok)throw engageHttpError(response.status,path);
    return response.json() as Promise<unknown>;
  }
  async health(){
    if(this.healthRequest)return this.healthRequest;
    this.healthRequest=(async():Promise<ProviderHealth>=>{
      try{
        const body=object(await this.request(ENGAGE_PACKAGE_PATH));
        if(typeof body.isPackageEnabled!=='boolean'||typeof body.featureAnalyticsEnabled!=='boolean'||typeof body.version!=='string'||!body.version.trim())return{state:'incompatible',authenticated:true,reason:'Umbraco Engage returned package metadata without a usable version.'};
        this.version=body.version;
        const major=this.version?.match(/^(\d+)/)?.[1];
        if(major&&!['17','18'].includes(major))return{state:'incompatible',authenticated:true,version:this.version,reason:`Umbraco Engage ${this.version} is outside the supported 17–18 range.`};
        if(body.isPackageEnabled===false||body.featureAnalyticsEnabled===false)return{state:'unavailable',authenticated:true,version:this.version,reason:'Umbraco Engage analytics is not enabled on the connected installation.'};
        return{state:'available',authenticated:true,version:this.version,reason:`Umbraco Engage ${this.version} is authenticated and analytics is enabled.`};
      }catch(error){
        if(error instanceof EngageProviderError)return{state:error.kind,authenticated:!['authentication_failed','unavailable'].includes(error.kind),reason:error.message};
        return{state:'unavailable',authenticated:false,reason:'Umbraco Engage availability could not be checked.'};
      }
    })();
    return this.healthRequest;
  }
  private async query(period:Period,page:number,pageSize:number):Promise<EngageQueryPage>{
    const payload={startDate:`${period.start}T00:00:00Z`,endDate:`${period.end}T23:59:59Z`,metrics:engageMetrics,dimensions:['pageUrl'],realtime:false,sort:'pageUrl',ascending:true,page,pageSize,includeSubpages:false,filter:null};
    const body=object(await this.request(ENGAGE_ANALYTICS_PATH,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));
    if(!Array.isArray(body.columns)||!body.columns.every(x=>typeof x==='string')||!Array.isArray(body.rows)||!body.rows.every(Array.isArray)||typeof body.reportsExist!=='boolean')throw new EngageProviderError('incompatible','Umbraco Engage returned a malformed analytics response.');
    return{columns:body.columns as string[],rows:body.rows as unknown[][],currentPage:integer(body.currentPage,'currentPage'),rowsPerPage:integer(body.rowsPerPage,'rowsPerPage'),totalRows:integer(body.totalRows,'totalRows'),totalPages:integer(body.totalPages,'totalPages'),reportsExist:body.reportsExist};
  }
  private rows(columns:string[],sourceRows:unknown[][]){
    const urlIndex=columns.indexOf('pageUrl');
    if(urlIndex<0)throw new EngageProviderError('incompatible','Umbraco Engage did not return the requested pageUrl dimension.');
    const metricIndexes=Object.fromEntries(engageMetrics.map(metric=>[metric,columns.indexOf(metric)]));
    return sourceRows.map((source,index):AnalyticsRow=>{
      const rawUrl=source[urlIndex];
      if(typeof rawUrl!=='string'||!rawUrl)throw new EngageProviderError('incompatible',`Umbraco Engage analytics row ${index+1} has no page URL.`);
      const metrics=Object.fromEntries(engageMetrics.map(metric=>[metric,metricIndexes[metric]<0?null:number(source[metricIndexes[metric]])]));
      return{url:rawUrl,acquisition:null,metrics};
    });
  }
  private aggregate(rows:AnalyticsRow[]){
    const groups=new Map<string,AnalyticsRow[]>();
    for(const row of rows){const key=normalize(row.url,this.c),group=groups.get(key)||[];group.push(row);groups.set(key,group)}
    let duplicates=0;
    const result=[...groups.entries()].map(([url,group])=>{
      if(group.length===1)return group[0];
      duplicates+=group.length-1;
      const metrics=Object.fromEntries(engageMetrics.map(metric=>{
        const values=group.map(row=>row.metrics[metric]);
        if(values.some(value=>value===null))return[metric,null];
        if(!engageAdditiveMetrics.has(metric))return[metric,null];
        return[metric,(values as number[]).reduce((sum,value)=>sum+value,0)];
      }));
      return{url,acquisition:null,metrics};
    });
    return{rows:result,duplicates};
  }
  async landingEvidence(period:Period):Promise<AnalyticsEvidence>{
    const health=await this.health();
    if(health.state!=='available')throw new EngageProviderError(health.state,health.reason);
    const cap=Math.max(1,this.c.analyticsCap),sourceRows:unknown[][]=[];
    let page=1,totalRows=0,totalPages=0,reportsExist=true,pagesFetched=0,columns:string[]=[];
    const limitations:string[]=[];
    while(sourceRows.length<cap){
      const response=await this.query(period,page,Math.min(500,cap-sourceRows.length));pagesFetched++;
      if(!columns.length)columns=response.columns;else if(columns.join('\u0000')!==response.columns.join('\u0000'))throw new EngageProviderError('incompatible','Umbraco Engage changed analytics columns between pages.');
      totalRows=response.totalRows;totalPages=response.totalPages;reportsExist=response.reportsExist;
      if(!reportsExist){limitations.push('Umbraco Engage reporting tables do not exist or are not ready. Page Evidence did not trigger reporting generation.');break}
      sourceRows.push(...response.rows.slice(0,cap-sourceRows.length));
      if(response.currentPage>=response.totalPages||response.totalPages===0)break;
      if(response.rows.length===0){limitations.push('Umbraco Engage returned an empty page before pagination completed.');break}
      page++;
    }
    if(totalRows>sourceRows.length)limitations.push(`Umbraco Engage reported ${totalRows} rows; Page Evidence fetched ${sourceRows.length} within the configured ${cap}-row cap.`);
    const parsed=sourceRows.length?this.rows(columns,sourceRows):[],aggregated=this.aggregate(parsed);
    if(aggregated.duplicates)limitations.push(`${aggregated.duplicates} normalized duplicate URL row(s) were collapsed. Only additive pageviews and goal completions were summed; non-additive page sessions, visitors, rates, and averages are unavailable for those URLs.`);
    const metricAvailability=Object.fromEntries(engageMetrics.map(metric=>{const present=columns.includes(metric);return[metric,present?{available:true}:{available:false,reason:`Umbraco Engage did not return the requested ${metric} column.`}]}));
    return{provider:this.name,metricLabels:engageLabels,metricAvailability,rows:aggregated.rows,sourceSummaries:[],fetchedAt:new Date().toISOString(),period,source:{endpoint:ENGAGE_ANALYTICS_PATH,version:this.version},coverage:{complete:reportsExist&&totalRows<=sourceRows.length&&!limitations.some(x=>x.includes('empty page')),limitations,totalRows,fetchedRows:sourceRows.length,pagesFetched,reportsExist}};
  }
}

export class NoneProvider implements AnalyticsProvider{name='none' as const;capabilities(){return[]}async landingEvidence(period:Period){return{provider:this.name,metricLabels:{},metricAvailability:{},rows:[],sourceSummaries:[],fetchedAt:new Date().toISOString(),period,coverage:{complete:true,limitations:['No analytics provider is configured. GSC-only evidence is available.'],fetchedRows:0}}}}

export async function configuredOutcomeEvents(c:Config,period:Period){if(c.analyticsProvider!=='ga4')return{available:false,reason:'Configured outcome events are currently supported for GA4 only.',events:[]};if(!c.outcomeEvents.length)return{available:false,reason:'GA4_OUTCOME_EVENT_NAMES is not configured.',events:[]};const api=google.analyticsdata({version:'v1beta',auth:oauth(c).client}),r=await api.properties.runReport({property:`properties/${c.ga4PropertyId}`,requestBody:{dateRanges:[{startDate:period.start,endDate:period.end}],dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'}],dimensionFilter:{filter:{fieldName:'eventName',inListFilter:{values:c.outcomeEvents}}}}});return{available:true,events:(r.data.rows||[]).map(x=>({name:x.dimensionValues?.[0]?.value||'',count:Number(x.metricValues?.[0]?.value||0)})),limitation:'Event counts are property-level for the selected period; they are not attributed to GSC queries.'}}

export function analyticsProvider(c=config()):AnalyticsProvider{
  if(c.analyticsProvider==='ga4'){if(!c.ga4PropertyId)throw Error('GA4_PROPERTY_ID is required when ANALYTICS_PROVIDER=ga4.');return new Ga4Provider(c)}
  if(c.analyticsProvider==='matomo'){if(!c.matomoUrl||!c.matomoSiteId||!c.matomoTokenAuth)throw Error('MATOMO_URL, MATOMO_SITE_ID, and MATOMO_TOKEN_AUTH are required when ANALYTICS_PROVIDER=matomo.');return new MatomoProvider(c)}
  if(c.analyticsProvider==='engage'){if(!c.umbracoBaseUrl||!c.umbracoClientId||!c.umbracoClientSecret)throw Error('UMBRACO_BASE_URL, UMBRACO_CLIENT_ID, and UMBRACO_CLIENT_SECRET are required when ANALYTICS_PROVIDER=engage.');return new EngageProvider(c)}
  return new NoneProvider();
}
