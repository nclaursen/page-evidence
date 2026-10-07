import {createHash} from 'node:crypto';
import path from 'node:path';
import type {Config} from './core.js';
import {externalDatasetSchema,type ExternalMetric,type ExternalSearchDataset,type ExternalSearchObservation} from './external-search.js';

export const MAX_EXTERNAL_BYTES=20*1024*1024;
const MAX_ROWS=100000;
const aliases:Record<string,string[]>={
  query:['keyword'],rankingUrl:['current url','url'],previousUrl:['previous url'],
  position:['current position','position','pos.'],previousPosition:['previous position'],
  searchDemand:['volume','search volume'],competitiveness:['kd','difficulty','keyword difficulty'],
  estimatedTraffic:['current organic traffic','organic traffic','traffic'],previousTraffic:['previous organic traffic'],
  country:['country'],location:['location'],languages:['language'],observedAt:['current date','updated','last update'],
  previousDate:['previous date'],intents:['intent','intents'],serpFeatures:['serp features'],
  positionKind:['current position kind','position kind'],previousPositionKind:['previous position kind'],
  positionChange:['position change'],trafficChange:['organic traffic change'],entities:['entities'],
  branded:['branded'],local:['local'],navigational:['navigational'],informational:['informational'],
  commercial:['commercial'],transactional:['transactional'],cpc:['cpc'],paidTraffic:['current paid traffic']
};

// Record boundaries are recoverable for width errors, but not an unterminated
// quoted field. Never silently realign fields after broken quoting.
export function csvRecords(text:string,delimiter:string){
  const records:{fields:string[];malformed:boolean}[]=[];
  let fields:string[]=[],value='',quoted=false,closed=false,malformed=false;
  const field=()=>{fields.push(value);value='';closed=false};
  const record=()=>{field();if(fields.some(x=>x.trim()))records.push({fields,malformed});fields=[];malformed=false;if(records.length>MAX_ROWS+1)throw Error(`External export exceeds ${MAX_ROWS} rows.`)};
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){if(char==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=char;continue}
    if(char===delimiter){field();continue}
    if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;record();continue}
    if(char==='"'&&!value&&!closed){quoted=true;continue}
    if(char==='"'||closed)malformed=true;
    value+=char;
  }
  if(quoted)throw Error('External export has an unterminated quoted field; row boundaries are unreliable.');
  if(value||fields.length||closed)record();
  return records;
}

export function parseExternalNumber(raw:string,metric:string,unit:string):ExternalMetric|undefined{
  let text=raw.trim().replace(/^'/,'').replace(/[\u00a0\u202f]/g,' ');
  if(!text||/^(n\/a|null|-)$/i.test(text))return undefined;
  const range=/^(\d+)\s*[-–]\s*(\d+)$/.exec(text);
  if(range){const min=Number(range[1]),max=Number(range[2]);if(max<min)throw Error('Reversed numeric range');return{range:{min,max},raw,metric,unit}}
  if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text))text=text.replace(/,/g,'');
  else if(/^\d{1,3}( \d{3})+(\.\d+)?$/.test(text))text=text.replace(/ /g,'');
  const match=/^(\d+(?:\.\d+)?)\s*([kKmM])?$/.exec(text);
  if(!match)throw Error('Ambiguous or non-numeric value');
  const value=Number(match[1])*(match[2]?.toLowerCase()==='k'?1000:match[2]?.toLowerCase()==='m'?1000000:1);
  if(!Number.isFinite(value))throw Error('Non-finite value');
  return{value,raw,metric,unit};
}

export function parseAhrefsCsv(bytes:Buffer,filename:string,c:Pick<Config,'profile'|'domain'|'gscProperty'>):ExternalSearchDataset{
  if(!bytes.length||bytes.length>MAX_EXTERNAL_BYTES)throw Error('External export is empty or exceeds the 20 MiB limit.');
  let encoding='utf-8',text:string;
  if(bytes[0]===0xff&&bytes[1]===0xfe){encoding='utf-16le';text=new TextDecoder('utf-16le',{fatal:true}).decode(bytes)}
  else if(bytes[0]===0xfe&&bytes[1]===0xff){encoding='utf-16be';text=new TextDecoder('utf-16be',{fatal:true}).decode(bytes)}
  else{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
  text=text.replace(/^\uFEFF/,'');
  if(text.includes('\u0000'))throw Error('Unsupported export encoding. Export as UTF-8 or BOM-marked UTF-16.');
  const headerLine=text.split(/\r?\n/,1)[0];
  const possible=[',','\t',';'].filter(d=>{try{return csvRecords(headerLine,d)[0]?.fields.some(x=>x.trim().toLowerCase()==='keyword')}catch{return false}});
  const delimiter=possible.sort((a,b)=>csvRecords(headerLine,b)[0].fields.length-csvRecords(headerLine,a)[0].fields.length)[0];
  if(!delimiter)throw Error('Cannot recognize an Ahrefs Organic Keywords header.');
  const records=csvRecords(text,delimiter),headerRecord=records.shift();
  if(!headerRecord||headerRecord.malformed)throw Error('Malformed export header.');
  const headers=headerRecord.fields.map(x=>x.trim()),lower=headers.map(x=>x.toLowerCase());
  if(new Set(lower).size!==lower.length)throw Error('Duplicate export column names are ambiguous.');
  const indices:Record<string,number>={},fieldMap:Record<string,string>={};
  for(const [field,names]of Object.entries(aliases)){const name=names.find(x=>lower.includes(x));if(name){indices[field]=lower.indexOf(name);fieldMap[field]=headers[indices[field]]}}
  if(indices.query===undefined||(indices.rankingUrl===undefined&&indices.previousUrl===undefined)||(indices.position===undefined&&indices.searchDemand===undefined))throw Error('Not an interpretable Organic Keywords report: require Keyword, URL/Current URL/Previous URL, and a position or volume column.');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const id='external_'+createHash('sha256').update(JSON.stringify([c.profile,c.domain,c.gscProperty,sha256,'ahrefs-csv-1'])).digest('hex').slice(0,24);
  const diagnostics={detectedReport:'ahrefs_organic_keywords',encoding,delimiter,rowsProcessed:records.length,rowsAccepted:0,rowsSkipped:0,duplicatesSkipped:0,historicalRows:0,fieldMap,
    missingFields:['rankingUrl','position','searchDemand','competitiveness','estimatedTraffic','country','observedAt','intents'].filter(x=>indices[x]===undefined),
    unsupportedFields:headers.filter((_,i)=>!Object.values(indices).includes(i)),warningCount:0,warnings:[] as string[]};
  if(['navigational','informational','commercial','transactional'].some(x=>indices[x]!==undefined))diagnostics.missingFields=diagnostics.missingFields.filter(x=>x!=='intents');
  const warn=(message:string)=>{diagnostics.warningCount++;if(diagnostics.warnings.length<30)diagnostics.warnings.push(message)};
  const observations:ExternalSearchObservation[]=[],seen=new Map<string,ExternalSearchObservation>();
  for(const [index,record]of records.entries()){
    const row=index+2;
    if(record.malformed||record.fields.length!==headers.length){diagnostics.rowsSkipped++;warn(`Record ${row}: malformed record or unexpected field count.`);continue}
    const get=(field:string)=>indices[field]===undefined?'':record.fields[indices[field]].trim();
    const query=get('query');if(!query){diagnostics.rowsSkipped++;warn(`Record ${row}: empty keyword.`);continue}
    const historical=!get('rankingUrl')&&Boolean(get('previousUrl'));
    const url=get(historical?'previousUrl':'rankingUrl');
    if(url){try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw Error()}catch{diagnostics.rowsSkipped++;warn(`Record ${row}: invalid ranking URL.`);continue}}
    const numeric=(field:string,metric:string,unit:string,max?:number)=>{
      const raw=get(field);try{const metricValue=parseExternalNumber(raw,metric,unit);if(metricValue&&max!==undefined&&((metricValue.value??metricValue.range!.max)>max))throw Error('Out of range');if(metricValue&&field.toLowerCase().includes('position')&&(!Number.isInteger(metricValue.value)||metricValue.value===0||metricValue.range))throw Error('Invalid position');return metricValue}catch{warn(`Record ${row}: ${field} is unavailable because its number is ambiguous or invalid.`);return undefined}
    };
    const intents:string[]=get('intents').split(/[,;|]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
    for(const name of ['navigational','informational','commercial','transactional']){const value=get(name).toLowerCase();if(value==='true'||value==='1')intents.push(name);else if(value&&!['false','0'].includes(value))warn(`Record ${row}: invalid ${name} intent flag.`)}
    const observedAt=get(historical?'previousDate':'observedAt');
    const day=observedAt.slice(0,10),dateValue=Date.parse(`${day}T00:00:00Z`);
    const validDate=!observedAt||/^\d{4}-\d{2}-\d{2}(?:[ T](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z|[+-]\d{2}:\d{2})?)?$/.test(observedAt)&&Number.isFinite(dateValue)&&new Date(dateValue).toISOString().slice(0,10)===day;
    if(!validDate)warn(`Record ${row}: unsupported observation date; retained only as provider data.`);
    const providerSpecific:Record<string,unknown>={};
    for(const field of ['serpFeatures','positionKind','previousPositionKind','positionChange','trafficChange','entities','branded','local','cpc','paidTraffic','location'])if(get(field))providerSpecific[field]=get(field);
    if(observedAt)providerSpecific.rawObservationDate=observedAt;
    const unknown:Record<string,string>={};for(const header of diagnostics.unsupportedFields)unknown[header]=record.fields[headers.indexOf(header)];if(Object.keys(unknown).length)providerSpecific.unmapped=unknown;
    const observation:ExternalSearchObservation={id:`${id}_${row}`,query,state:historical?'historical':url?'current':'demand_only',rankingUrl:url||undefined,country:get('country')||undefined,
      languages:get('languages').split(',').map(x=>x.trim()).filter(Boolean),observedAt:validDate?observedAt||undefined:undefined,
      position:numeric(historical?'previousPosition':'position','ahrefs_position','rank'),
      searchDemand:numeric('searchDemand','ahrefs_volume','searches_per_month'),
      competitiveness:numeric('competitiveness','ahrefs_keyword_difficulty','provider_index',100),
      estimatedTraffic:numeric(historical?'previousTraffic':'estimatedTraffic','ahrefs_estimated_organic_traffic','estimated_clicks_per_month'),
      intents:[...new Set(intents)],sourceRef:{datasetId:id,rowNumbers:[row]},providerSpecific};
    if(observation.competitiveness)observation.competitiveness.scale='Ahrefs KD 0–100; not comparable across providers';
    const signature=JSON.stringify({...observation,id:undefined,sourceRef:undefined});
    const duplicate=seen.get(signature);if(duplicate){duplicate.sourceRef.rowNumbers.push(row);diagnostics.rowsSkipped++;diagnostics.duplicatesSkipped++;continue}
    seen.set(signature,observation);observations.push(observation);if(historical)diagnostics.historicalRows++;
  }
  diagnostics.rowsAccepted=observations.length;
  if(!observations.length||diagnostics.rowsSkipped-diagnostics.duplicatesSkipped>records.length/2)throw Error('External export cannot be interpreted reliably: no accepted rows or most records are malformed.');
  if(diagnostics.historicalRows)warn('Historical-only rows retain previous rankings; absence of a current ranking is not proof that a page is missing.');
  warn('Row dates without timezone are preserved as provider-local timestamps. Import time is not the observation time.');
  return externalDatasetSchema.parse({schemaVersion:1,id,profile:c.profile,siteScope:{domain:c.domain,gscProperty:c.gscProperty},provider:'ahrefs',reportType:'organic_keywords',importedAt:new Date().toISOString(),
    source:{filename:path.basename(filename),sha256,adapterVersion:'ahrefs-csv-1'},
    scope:{countries:[...new Set(observations.flatMap(x=>x.country?[x.country]:[]))],languages:[...new Set(observations.flatMap(x=>x.languages))],rankingHosts:[...new Set(observations.flatMap(x=>x.rankingUrl?[new URL(x.rankingUrl).hostname]:[]))]},observations,diagnostics});
}
