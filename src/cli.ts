#!/usr/bin/env node
import 'dotenv/config';
import {analyticsProvider} from './analytics.js';
import {auth,gsc} from './google.js';
import {config} from './core.js';
import {actionLog,actionReviewContext,findQuestionOpportunities,pageBrief,pageContext,pageHistory,pageInvestigationContext,pageSegmentContext,questionPageContext,recordAction,report,status,sync} from './service.js';

const wait=<T>(promise:Promise<T>)=>Promise.race([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(Error('Timed out after 15 seconds')),15000))]);
const windowDays=(args:string[])=>Number(args.find(arg=>arg.startsWith('--days='))?.slice(7)||(args.includes('--90')?90:args.includes('--60')?60:30));
const kv=(args:string[])=>Object.fromEntries(args.map(arg=>arg.split('=')));
const [command,...args]=process.argv.slice(2);

try{
  if(command==='auth')await auth(config());
  else if(command==='doctor'){
    const c=config(),period={start:'2025-01-01',end:'2025-01-02'},output:any={...(await status()),checks:{livePage:false,gsc:false,analytics:false},guidance:[]};
    try{output.checks.livePage=(await wait(fetch(`https://${c.domain}`))).ok}catch{output.guidance.push('Check SITE_DOMAIN and network access.')}
    try{await wait(gsc(c,period));output.checks.gsc=true}catch{output.guidance.push('Check GSC_PROPERTY, OAuth consent, and Search Console access.')}
    try{await wait(analyticsProvider(c).landingEvidence(period));output.checks.analytics=true}catch{output.guidance.push('Check the selected analytics provider configuration and read access.')}
    console.log(JSON.stringify(output,null,2));process.exit(output.configured&&output.checks.livePage&&output.checks.gsc&&output.checks.analytics?0:1);
  }else if(command==='sync')console.log(JSON.stringify(await sync(args.includes('--refresh'),windowDays(args)),null,2));
  else if(command==='report')console.log(await report(args.includes('--refresh'),windowDays(args)));
  else if(command==='page')console.log(JSON.stringify(await pageContext(args[0],undefined,5,windowDays(args)),null,2));
  else if(command==='investigate')console.log(JSON.stringify(await pageInvestigationContext(args[0],windowDays(args),args.find(arg=>arg.startsWith('--question='))?.slice(11)),null,2));
  else if(command==='question-context')console.log(JSON.stringify(await questionPageContext(args[0],args.find(arg=>arg.startsWith('--question='))?.slice(11)||'',windowDays(args)),null,2));
  else if(command==='brief')console.log(JSON.stringify(await pageBrief(args[0],windowDays(args)),null,2));
  else if(command==='history')console.log(JSON.stringify(pageHistory(args[0],windowDays(args),Number(args.find(arg=>arg.startsWith('--limit='))?.slice(8)||6)),null,2));
  else if(command==='segments')console.log(JSON.stringify(await pageSegmentContext(args[0],args[1] as any,10,windowDays(args)),null,2));
  else if(command==='questions')console.log(JSON.stringify(await findQuestionOpportunities(windowDays(args),Number(args.find(arg=>arg.startsWith('--limit='))?.slice(8)||30)),null,2));
  else if(command==='actions'){const operation=args.shift();if(operation==='list')console.log(actionLog());else if(operation==='review')console.log(actionReviewContext(args[0]));else{const values:any=kv(args);console.log(recordAction({...values,action_type:values.actionType||values.action_type||'other'}))}}
  else if(command==='demo')console.log(JSON.stringify({message:'Site Signal is local-first.'},null,2));
  else if(command==='mcp')await import('./mcp.js');
  else throw Error('Use: doctor | auth | sync [--days=30|60|90] | report [--days=30|60|90] | page URL [--days=30|60|90] | investigate URL [--days=30|60|90] [--question=text] | question-context URL --question=text [--days=30|60|90] | brief URL [--days=30|60|90] | history URL [--days=30|60|90] [--limit=6] | segments URL country|device|searchAppearance [--days=30|60|90] | questions [--days=30|60|90] [--limit=30] | actions list|review ACTION_ID|create');
}catch(error){console.error(error instanceof Error?error.message:error);process.exit(1)}
