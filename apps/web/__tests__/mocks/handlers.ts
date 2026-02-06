import { http, HttpResponse } from 'msw';
import type { Database } from '@m2sql/model';

// Mock Supabase push endpoint
export const pushHandler = http.post('/api/supabase/push', async ({ request }) => {
  const body = await request.json();
  const database = (body as { database: Database }).database;

  // Simulate successful push
  return HttpResponse.json({
    success: true,
    message: `Pushed ${database.tables.length} tables to Supabase`,
  });
});

// Mock Supabase pull endpoint
export const pullHandler = http.post('/api/supabase/pull', async () => {
  // Return mock database structure
  const mockDatabase: Database = {
    tables: [
      {
        name: 'tasks',
        schema: {
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'name', type: 'TEXT', nullable: false },
            { name: 'anchor', type: 'TEXT', nullable: false },
            { name: 'status', type: 'TEXT', nullable: true },
          ],
        },
        rows: [
          {
            pk: 1,
            name: 'Test Task',
            anchor: 'test-task',
            columns: { status: 'open' },
          },
        ],
      },
    ],
  };

  return HttpResponse.json({
    success: true,
    database: mockDatabase,
    mermaid: 'erDiagram\n  tasks {\n    TEXT status\n  }\n  tasks { test-task : "Test Task" }',
  });
});

// Error handler for testing error states
export const pushErrorHandler = http.post('/api/supabase/push', () => {
  return HttpResponse.json(
    { success: false, error: 'Database connection failed' },
    { status: 500 }
  );
});

export const pullErrorHandler = http.post('/api/supabase/pull', () => {
  return HttpResponse.json(
    { success: false, error: 'Failed to fetch data' },
    { status: 500 }
  );
});

// Default handlers
export const handlers = [pushHandler, pullHandler];
