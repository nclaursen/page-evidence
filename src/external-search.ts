import * as z from 'zod/v4';

// Metrics retain provider definitions. Different providers' difficulty scales are
// deliberately not interchangeable, and missing metrics need not be supplied.
export const externalMetricSchema=z.object({
  value:z.number().finite().nonnegative().optional(),
  range:z.object({min:z.number().nonnegative(),max:z.number().nonnegative()}).optional(),
  raw:z.string(),metric:z.string(),unit:z.string(),scale:z.string().optional()
}).refine(x=>x.value!==undefined||Boolean(x.range),'A value or reported range is required');
export type ExternalMetric=z.infer<typeof externalMetricSchema>;
const observationSchema=z.object({
  id:z.string(),query:z.string().min(1),state:z.enum(['current','historical','demand_only']),
  rankingUrl:z.string().url().optional(),country:z.string().optional(),languages:z.array(z.string()),
  observedAt:z.string().optional(),position:externalMetricSchema.optional(),
  searchDemand:externalMetricSchema.optional(),competitiveness:externalMetricSchema.optional(),
  estimatedTraffic:externalMetricSchema.optional(),intents:z.array(z.string()),
  sourceRef:z.object({datasetId:z.string(),rowNumbers:z.array(z.number().int().positive())}),
  providerSpecific:z.record(z.string(),z.unknown())
});
export const externalDatasetSchema=z.object({
  schemaVersion:z.literal(1),id:z.string(),profile:z.string(),
  siteScope:z.object({domain:z.string(),gscProperty:z.string()}),provider:z.string(),reportType:z.string(),
  importedAt:z.string(),source:z.object({filename:z.string(),sha256:z.string(),adapterVersion:z.string()}),
  scope:z.object({countries:z.array(z.string()),languages:z.array(z.string()),rankingHosts:z.array(z.string())}),
  observations:z.array(observationSchema),
  diagnostics:z.object({detectedReport:z.string(),encoding:z.string(),delimiter:z.string(),
    rowsProcessed:z.number(),rowsAccepted:z.number(),rowsSkipped:z.number(),duplicatesSkipped:z.number(),
    historicalRows:z.number(),fieldMap:z.record(z.string(),z.string()),missingFields:z.array(z.string()),
    unsupportedFields:z.array(z.string()),warningCount:z.number(),warnings:z.array(z.string())})
});
export type ExternalSearchDataset=z.infer<typeof externalDatasetSchema>;
export type ExternalSearchObservation=z.infer<typeof observationSchema>;
export function externalDatasetSummary(dataset:ExternalSearchDataset){
  const {observations,...summary}=dataset;
  return{...summary,observationCount:observations.length,
    limitation:'Provider estimates and row observation dates are distinct from measured traffic and import time. Export filters and omitted rankings are unknown.'};
}
