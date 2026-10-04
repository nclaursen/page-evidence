import {afterEach, describe, expect, it, vi} from 'vitest';
import {config, Store} from '../src/core.js';
import {queryTextMode, safeQueryText} from '../src/query-safety.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

afterEach(() => vi.unstubAllEnvs());

describe('Page Evidence rename compatibility', () => {
  it('accepts the new configuration names and prefers them over legacy settings', () => {
    for (const [key, value] of Object.entries({PAGE_EVIDENCE_PROFILE:'new', SITE_SIGNAL_PROFILE:'old', PAGE_EVIDENCE_DATA_DIR:'/tmp/new-data', SITE_SIGNAL_DATA_DIR:'/tmp/old-data', PAGE_EVIDENCE_REPOSITORY_PATH:'/tmp/new-source', SITE_SIGNAL_REPOSITORY_PATH:'/tmp/old-source', PAGE_EVIDENCE_SITEMAP_URL:'https://new.example/sitemap.xml', SITE_SIGNAL_SITEMAP_URL:'https://old.example/sitemap.xml'})) vi.stubEnv(key, value);
    expect(config()).toMatchObject({profile:'new', dataDir:'/tmp/new-data', repositoryPath:'/tmp/new-source', sitemapUrl:'https://new.example/sitemap.xml'});
  });
  it('reopens existing local snapshots and actions using the unchanged database filename', () => {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'page-evidence-compat-'));
    try {
      const before=new Store(dir); before.save('existing',{profile:'legacy'}); const id=before.action({description:'Keep this action'}); before.db.close();
      const after=new Store(dir); expect(after.get('existing')).toEqual({profile:'legacy'}); expect(after.actionById(id).description).toBe('Keep this action'); after.db.close();
      expect(fs.existsSync(path.join(dir,'site-signal.sqlite'))).toBe(true);
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  });
  it('retains strict query filtering and stable IDs under the new names', () => {
    vi.stubEnv('PAGE_EVIDENCE_QUERY_TEXT_MODE','omit'); vi.stubEnv('PAGE_EVIDENCE_QUERY_ID_KEY','synthetic-key'); vi.stubEnv('PAGE_EVIDENCE_INCLUDE_RAW_QUERY_TEXT','0'); vi.stubEnv('SITE_SIGNAL_INCLUDE_RAW_QUERY_TEXT','1');
    expect(queryTextMode()).toBe('omit'); const first=safeQueryText('ordinary query'); expect(first.queryHidden).toBe(true); expect(safeQueryText('ordinary query').queryId).toBe(first.queryId);
  });
});
