import * as z from 'zod/v4';
import type {Query} from './core.js';

export const BRAND_RULE_VERSION='token-phrase-v1';
export const brandTermsSchema=z.array(z.string().trim().min(1).max(100)).max(50);
export const brandGroups=['branded','nonBranded','unclassified'] as const;
export type BrandGroup=typeof brandGroups[number];
const normalise=(value:string)=>{const text=value.normalize('NFKC').toLowerCase();return /[\p{L}\p{N}]/u.test(text)?text.match(/[\p{L}\p{M}\p{N}]+/gu)?.join(' ')??'':''};
export function brandTerms(input:unknown):string[]{
  const parsed=brandTermsSchema.parse(input),terms=[...new Set(parsed.map(normalise))];
  if(terms.some(term=>!term))throw Error('Brand phrases must contain letters or numbers.');
  return terms;
}
export function configuredBrandTerms(override?:string[]){
  if(override!==undefined)return{source:'request',terms:brandTerms(override)};
  const raw=process.env.PAGE_EVIDENCE_BRAND_TERMS;
  if(!raw?.trim())return{source:'unconfigured',terms:[]};
  let parsed:unknown;try{parsed=JSON.parse(raw)}catch{throw Error('PAGE_EVIDENCE_BRAND_TERMS must be a JSON array of phrases.')}
  return{source:'configuration',terms:brandTerms(parsed)};
}
export function classifyBrandQuery(query:string,terms:string[]){
  const text=normalise(query),matchedPhrases=text?terms.filter(term=>` ${text} `.includes(` ${term} `)):[];
  const group:BrandGroup=!text||!terms.length?'unclassified':matchedPhrases.length?'branded':'nonBranded';
  return{group,matchedPhrases};
}
export function summarizeBrandQueries(rows:Query[],terms:string[],limit=5){
  if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('limit must be a whole number from 1 to 5.');
  const classified=rows.map(row=>({...row,...classifyBrandQuery(row.query,terms)}));
  const aggregate=(values:Query[])=>{
    const clicks=values.reduce((sum,row)=>sum+row.clicks,0),impressions=values.reduce((sum,row)=>sum+row.impressions,0);
    return{state:values.length?'observed' as const:'unavailable' as const,rows:values.length,clicks:values.length?clicks:null,impressions:values.length?impressions:null,ctr:impressions>0?clicks/impressions:null,position:impressions>0?values.reduce((sum,row)=>sum+row.position*row.impressions,0)/impressions:null};
  };
  const groups=Object.fromEntries(brandGroups.map(group=>{
    const values=classified.filter(row=>row.group===group);
    const examples=[...values].sort((a,b)=>b.impressions-a.impressions||b.clicks-a.clicks||a.query.localeCompare(b.query)).slice(0,limit);
    return[group,{...aggregate(values),examples,examplesTruncated:values.length>limit}];
  })) as Record<BrandGroup,ReturnType<typeof aggregate>&{examples:typeof classified;examplesTruncated:boolean}>;
  return{fetchedTotals:aggregate(rows),groups};
}
export function brandComparison(current:ReturnType<typeof summarizeBrandQueries>|null,previous:ReturnType<typeof summarizeBrandQueries>|null){
  return Object.fromEntries(brandGroups.map(group=>{
    const a=current?.groups[group],b=previous?.groups[group];
    const observed=a?.state==='observed'&&b?.state==='observed';
    return[group,{state:observed?'observed':'unavailable',clickChange:observed?a.clicks!-b.clicks!:null,impressionChange:observed?a.impressions!-b.impressions!:null,ctrChange:observed&&a.ctr!==null&&b.ctr!==null?a.ctr-b.ctr:null,positionChange:observed&&a.position!==null&&b.position!==null?a.position-b.position:null}];
  }));
}
