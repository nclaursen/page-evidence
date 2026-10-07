#!/usr/bin/env node
import 'dotenv/config';
import {analyticsProvider,EngageProviderError} from './analytics.js';
import {auth,gsc} from './google.js';
import {config} from './core.js';
import {actionLog,actionReviewContext,findQuestionOpportunities,pageBrief,pageContext,pageHistory,pageInvestigationContext,pageSegmentContext,questionPageContext,recordAction,report,status,sync} from './service.js';
import {safeQueryOutput} from './query-safety.js';
import {cacheStatus,changeDigest,refreshEvidence} from './service.js';
import fs from 'node:fs';
import {findSearchOpportunities,importExternalSearchEvidence} from './service.js';
import {assessmentSchema,renderSearchOpportunities,type SearchAction} from './search-opportunities.js';

const wait=<T>(promise:Promise<T>)=>Promise.race([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(Error('Timed out after 15 seconds')),15000))]);
const windowDays=(args:string[])=>Number(args.find(arg=>arg.startsWith('--days='))?.slice(7)||(args.includes('--90')?90:args.includes('--60')?60:30));
const kv=(args:string[])=>Object.fromEntries(args.map(arg=>arg.split('=')));
const queryJson=(value:unknown,extraFields:string[]=[])=>JSON.stringify(safeQueryOutput(value,extraFields,true),null,2);
const [command,...args]=process.argv.slice(2);
const option=(name:string)=>args.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);

try{
  if(command==='external-import')console.log(queryJson(importExternalSearchEvidence(args[0])));
  else if(command==='opportunities'){
    const format=option('format')??'json';if(!['json','text'].includes(format))throw Error('--format must be json or text.');
    const assessmentsPath=option('assessments');let assessments;
    if(assessmentsPath){if(fs.statSync(assessmentsPath).size>100000)throw Error('Assessment file exceeds 100 KB.');const raw=JSON.parse(fs.readFileSync(assessmentsPath,'utf8'));if(!Array.isArray(raw)||raw.length>20)throw Error('Assessments must be an array of at most 20 objects.');assessments=raw.map(x=>assessmentSchema.parse(x))}
    const result=await findSearchOpportunities({externalPath:option('external'),externalDatasetId:option('external-id'),windowDays:windowDays(args),limit:Number(option('limit')??10),pageBudget:Number(option('page-budget')??10),refresh:args.includes('--refresh'),action:option('action') as SearchAction|undefined,requireIndependentSupport:args.includes('--independent-support'),assessments,
      ...(option('minimum-impressions')?{minimumImpressions:Number(option('minimum-impressions'))}:{}),...(option('minimum-demand')?{minimumDemand:Number(option('minimum-demand'))}:{}),...(option('max-external-age-days')?{maxExternalAgeDays:Number(option('max-external-age-days'))}:{})});
    console.log(format==='text'?renderSearchOpportunities(safeQueryOutput(result) as typeof result):queryJson(result));
  }
  else if(command==='auth')await auth(config());
  else if(command==='doctor'){
    const c=config(),period={start:'2025-01-01',end:'2025-01-02'},output:any={...(await status()),checks:{livePage:false,gsc:false,analytics:false},guidance:[]};
    try{output.checks.livePage=(await wait(fetch(`https://${c.domain}`))).ok}catch{output.guidance.push('Check SITE_DOMAIN and network access.')}
    try{await wait(gsc(c,period));output.checks.gsc=true}catch{output.guidance.push('Check GSC_PROPERTY, OAuth consent, and Search Console access.')}
    try{await wait(analyticsProvider(c).landingEvidence(period));output.checks.analytics=true}catch(error){output.guidance.push(error instanceof EngageProviderError?error.message:'Check the selected analytics provider configuration and read access.')}
    console.log(JSON.stringify(output,null,2));process.exit(output.configured&&output.checks.livePage&&output.checks.gsc&&output.checks.analytics?0:1);
  }else if(command==='sync')console.log(JSON.stringify(await sync(args.includes('--refresh'),windowDays(args)),null,2));
  else if(command==='digest')console.log(queryJson(await changeDigest(windowDays(args),Number(args.find(arg=>arg.startsWith('--limit='))?.slice(8)||5),args.includes('--refresh'),!args.includes('--preview'))));
  else if(command==='cache-status')console.log(queryJson(cacheStatus(windowDays(args))));
  else if(command==='refresh')console.log(queryJson(await refreshEvidence(windowDays(args))));
  else if(command==='report')console.log(await report(args.includes('--refresh'),windowDays(args)));
  else if(command==='page')console.log(queryJson(await pageContext(args[0],undefined,5,windowDays(args))));
  else if(command==='investigate')console.log(queryJson(await pageInvestigationContext(args[0],windowDays(args),args.find(arg=>arg.startsWith('--question='))?.slice(11)),['sourceContext.terms']));
  else if(command==='question-context')console.log(queryJson(await questionPageContext(args[0],args.find(arg=>arg.startsWith('--question='))?.slice(11)||'',windowDays(args)),['sourceContext.terms']));
  else if(command==='brief')console.log(queryJson(await pageBrief(args[0],windowDays(args))));
  else if(command==='history')console.log(JSON.stringify(pageHistory(args[0],windowDays(args),Number(args.find(arg=>arg.startsWith('--limit='))?.slice(8)||6)),null,2));
  else if(command==='segments')console.log(queryJson(await pageSegmentContext(args[0],args[1] as any,10,windowDays(args))));
  else if(command==='questions')console.log(queryJson(await findQuestionOpportunities(windowDays(args),Number(args.find(arg=>arg.startsWith('--limit='))?.slice(8)||30))));
  else if(command==='actions'){const operation=args.shift();if(operation==='list')console.log(actionLog());else if(operation==='review')console.log(actionReviewContext(args[0],args.some(arg=>arg.startsWith('--days='))?windowDays(args):undefined));else{const values:any=kv(args);console.log(recordAction({...values,action_type:values.actionType||values.action_type||'other'}))}}
  else if(command==='demo')console.log(JSON.stringify({message:'Page Evidence is local-first.'},null,2));
  else if(command==='mcp')await import('./mcp.js');
  else throw Error('Use: external-import PATH | opportunities [--external=PATH|--external-id=ID] [--format=json|text] [--days=7|30|60|90] [--limit=10] [--page-budget=10] [--action=IMPROVE|EXPAND|CREATE|CONSOLIDATE|IGNORE] [--independent-support] [--assessments=PATH] [--refresh] | digest [--days=7|30|60|90] [--limit=5] [--refresh] [--preview] | cache-status [--days=7|30|60|90] | refresh [--days=7|30|60|90] | doctor | auth | sync [--days=7|30|60|90] | report [--days=7|30|60|90] | page URL [--days=7|30|60|90] | investigate URL [--days=7|30|60|90] [--question=text] | question-context URL --question=text [--days=7|30|60|90] | brief URL [--days=7|30|60|90] | history URL [--days=7|30|60|90] [--limit=6] | segments URL country|device|searchAppearance [--days=7|30|60|90] | questions [--days=7|30|60|90] [--limit=30] | actions list|review ACTION_ID|create');
}catch(error){console.error(error instanceof Error?error.message:error);process.exit(1)}
