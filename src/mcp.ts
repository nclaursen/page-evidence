import {McpServer} from '@modelcontextprotocol/server';
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import {candidates,config} from './core.js';
import {actionLog,actionReviewContext,findQuestionOpportunities,measurementReadiness,pageContext,pageHistory,pageInternalLinkContext,pageInvestigationContext,pageLifecycle,pageRepositoryContext,pageSegmentContext,questionPageContext,queryEntryExit,recordAction,status,sync} from './service.js';

const out=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value,null,2)}]});

serveStdio(()=>{
  const server=new McpServer({name:'site-signal',version:'0.8.0'});
  const windowDays=z.union([z.literal(30),z.literal(60),z.literal(90)]).optional();
  const action={actionId:z.string().optional(),url:z.string().url(),description:z.string(),hypothesis:z.string(),actionType:z.enum(['content_update','technical_change','campaign','tracking_change','external_event','other']).optional(),status:z.enum(['Proposed','Accepted','Dismissed','Implemented','Reviewed']),implementationDate:z.string().optional(),baselineSnapshot:z.string().optional(),reviewDate:z.string().optional(),outcomeNotes:z.string().optional()};

  server.registerTool('get_site_status',{description:'Read setup checks.',inputSchema:{}},async()=>out(await status()));
  server.registerTool('find_content_opportunities',{description:'Return evidence-backed page candidates.',inputSchema:{refresh:z.boolean().optional(),limit:z.number().int().min(1).max(20).optional(),windowDays}},async input=>{const result=await sync(input.refresh,input.windowDays??30);return out({...result,candidates:candidates(result.gsc,result.previousGsc,result.coverage.readiness,config()).slice(0,input.limit??10)})});
  server.registerTool('find_question_opportunities',{description:'Return bounded, sparse, question-like GSC query-and-page evidence. This does not identify LLM queries or recommend content.',inputSchema:{limit:z.number().int().min(1).max(100).optional(),windowDays}},async input=>out(await findQuestionOpportunities(input.windowDays??90,input.limit??30)));
  server.registerTool('get_page_context',{description:'Return raw bounded page, analytics, and query evidence.',inputSchema:{url:z.string().url(),queryLimit:z.number().int().min(1).max(20).optional(),windowDays}},async input=>out(await pageContext(input.url,undefined,input.queryLimit??5,input.windowDays??30)));
  server.registerTool('get_page_investigation_context',{description:'Return GSC, selected-provider analytics, bounded query evidence, and optional local source context for one URL. A chat client interprets the evidence and proposes any change.',inputSchema:{url:z.string().url(),windowDays,question:z.string().min(1).optional()}},async input=>out(await pageInvestigationContext(input.url,input.windowDays??30,input.question)));
  server.registerTool('get_question_page_context',{description:'Return GSC, selected-provider analytics, and optional local source context for a selected question and landing page. This does not assess answer quality or write content.',inputSchema:{url:z.string().url(),question:z.string().min(1),windowDays}},async input=>out(await questionPageContext(input.url,input.question,input.windowDays??90)));
  server.registerTool('get_page_segments',{description:'Return bounded country, device, or search appearance evidence.',inputSchema:{url:z.string().url(),dimension:z.enum(['country','device','searchAppearance']),windowDays}},async input=>out(await pageSegmentContext(input.url,input.dimension,10,input.windowDays??30)));
  server.registerTool('get_page_lifecycle',{description:'Return deterministic multi-window evidence.',inputSchema:{url:z.string().url()}},async input=>out(await pageLifecycle(input.url)));
  server.registerTool('get_page_history',{description:'Return bounded observations from comparable locally stored snapshots.',inputSchema:{url:z.string().url(),windowDays,limit:z.number().int().min(1).max(12).optional()}},async input=>out(pageHistory(input.url,input.windowDays??30,input.limit??6)));
  server.registerTool('get_query_entry_exit',{description:'Return bounded entered, exited, and retained GSC query rows.',inputSchema:{url:z.string().url(),windowDays}},async input=>out(await queryEntryExit(input.url,input.windowDays??30)));
  server.registerTool('get_measurement_readiness',{description:'Show measurable acquisition and configured outcomes.',inputSchema:{}},async()=>out(await measurementReadiness()));
  server.registerTool('get_repository_context',{description:'Map only against an explicitly configured repository.',inputSchema:{url:z.string().url()}},async input=>out(await pageRepositoryContext(input.url)));
  server.registerTool('get_internal_link_context',{description:'Return verified repository-backed link candidates.',inputSchema:{url:z.string().url()}},async input=>out(await pageInternalLinkContext(input.url)));
  server.registerTool('review_local_actions',{description:'Read actions and reviews due.',inputSchema:{url:z.string().url().optional()}},async input=>out(actionLog(input.url)));
  server.registerTool('get_action_review_context',{description:'Return comparable stored before/after evidence for one recorded action without claiming causality.',inputSchema:{actionId:z.string().min(1)}},async input=>out(actionReviewContext(input.actionId)));
  server.registerTool('record_local_action',{description:'Create or update a typed local annotation.',inputSchema:action},async input=>out(recordAction({id:input.actionId,url:input.url,description:input.description,hypothesis:input.hypothesis,action_type:input.actionType||'other',status:input.status,implementation_date:input.implementationDate,baseline_snapshot:input.baselineSnapshot,review_date:input.reviewDate,outcome_notes:input.outcomeNotes})));
  return server;
});
