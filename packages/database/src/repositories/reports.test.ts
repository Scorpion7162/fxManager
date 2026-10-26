import { beforeEach, afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import { runMigrations, migrations } from '../migrations';
import { createReportsRepository } from './reports';
let sqlite: Database;
let repo: ReturnType<typeof createReportsRepository>;
let alice: number; let bob: number;
beforeEach(() => {
 sqlite=new Database(':memory:'); sqlite.run('PRAGMA foreign_keys=ON'); runMigrations(sqlite,migrations);
 const db=drizzle(sqlite,{schema}); repo=createReportsRepository(db);
 alice=db.insert(schema.players).values({name:'Alice'}).returning().get().id;
 bob=db.insert(schema.players).values({name:'Bob'}).returning().get().id;
});
afterEach(()=>sqlite.close());
test('creates a durable thread with an initial message and owner-scoped lists',()=>{
 const id=repo.create(alice,'Need help','My car is stuck.'); repo.create(bob,'Other report','Please investigate.');
 expect(repo.list(alice).map(r=>r.id)).toEqual([id]); expect(repo.list().length).toBe(2);
 const thread=repo.find(id)!; expect(thread.reporterName).toBe('Alice'); expect(thread.status).toBe('open');
 expect(thread.messages[0]).toMatchObject({author:'Alice',message:'My car is stuck.',staff:false});
 expect(thread.openedAt).toBeGreaterThan(0);
});
test('resolved threads reject replies and can be reopened',()=>{
 const id=repo.create(alice,'Need help','Initial message.'); expect(repo.reply(id,bob,null,'Investigating.')).toBe(true);
 repo.setStatus(id,'resolved'); expect(repo.reply(id,alice,null,'Still stuck.')).toBe(false);
 expect(repo.find(id)!.messages.length).toBe(2);
 repo.setStatus(id,'open'); expect(repo.reply(id,alice,null,'Thanks.')).toBe(true);
 expect(repo.find(id)!.messages.map(m=>m.message)).toEqual(['Initial message.','Investigating.','Thanks.']);
});
test('failed initial message creation rolls back the report too',()=>{
 expect(()=>repo.create(999,'Unknown player','No valid reporter.')).toThrow(); expect(repo.list()).toEqual([]);
 expect(repo.find(999)).toBeNull(); expect(repo.setStatus(999,'resolved')).toBeUndefined();
});
