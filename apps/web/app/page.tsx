'use client';

import { useState, useCallback } from 'react';
import { Container, Grid, Title, Paper, Text, Stack, Badge } from '@mantine/core';
import { parseMermaid } from '@m2sql/parser';
import type { Database } from '@m2sql/model';
import { FileUpload } from '@/components/FileUpload';
import { MermaidEditor } from '@/components/MermaidEditor';
import { ValidationDisplay } from '@/components/ValidationDisplay';
import { SyncControls } from '@/components/SyncControls';
import { DiagramRenderer } from '@/components/DiagramRenderer';

export default function Home() {
  const [mermaidText, setMermaidText] = useState('');
  const [database, setDatabase] = useState<Database | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<'editor' | 'supabase' | null>(null);

  const handleParse = useCallback((text: string) => {
    console.log('[handleParse] Called with text length:', text.length);
    setMermaidText(text);

    if (!text.trim()) {
      setDatabase(null);
      setErrors([]);
      setDataSource(null);
      return;
    }

    try {
      const result = parseMermaid(text);
      console.log('[handleParse] Parse result:', {
        databases: result.databases?.length,
        errors: result.errors?.length,
      });

      if (result.errors && result.errors.length > 0) {
        console.log('[handleParse] Parse errors:', result.errors);
        setErrors(result.errors.map(e => e.message));
        setDatabase(null);
        setDataSource(null);
      } else {
        setErrors([]);
        if (result.databases && result.databases.length > 0) {
          const db = result.databases[0]!;
          console.log('[handleParse] Setting database:', {
            name: db.name,
            tables: db.tables.length,
            arrowMappings: db.arrowMappings?.length,
          });
          setDatabase(db);
          setDataSource('editor');
        } else {
          console.log('[handleParse] No databases found in result');
          setDatabase(null);
          setDataSource(null);
        }
      }
    } catch (err) {
      console.error('[handleParse] Parse exception:', err);
      setErrors([err instanceof Error ? err.message : 'Unknown parse error']);
      setDatabase(null);
      setDataSource(null);
    }
  }, []);

  const handleFileLoad = useCallback((content: string, filename: string) => {
    console.log('[handleFileLoad] Called with filename:', filename, 'content length:', content.length);
    handleParse(content);
  }, [handleParse]);

  const handlePullSuccess = useCallback((result: any) => {
    if (result.database) {
      // Update the in-memory database model
      setDatabase(result.database);
      setErrors([]);
      setDataSource('supabase');

      // Clear the editor to show we're viewing Supabase data
      // In the future, we could render the database back to Mermaid text
      setMermaidText('');
    }
  }, []);

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="xl">
        m2sql Project Tracker
      </Title>

      <Grid gutter="lg">
        {/* Left column: Editor and file upload */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <FileUpload onFileLoad={handleFileLoad} />

            <MermaidEditor value={mermaidText} onChange={handleParse} />

            <ValidationDisplay errors={errors} />

            {database && (
              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text size="sm" fw={500}>
                      Database Info
                    </Text>
                    {dataSource && (
                      <Badge
                        size="sm"
                        color={dataSource === 'supabase' ? 'green' : 'blue'}
                        variant="light"
                      >
                        {dataSource === 'supabase' ? 'Pulled from Supabase' : 'From Editor'}
                      </Badge>
                    )}
                  </div>
                  <Text size="sm" c="dimmed">
                    Name: {database.name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Tables: {database.tables.length}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Arrow Mappings: {database.arrowMappings?.length || 0}
                  </Text>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Grid.Col>

        {/* Right column: Visualization and sync controls */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <SyncControls
              database={database}
              onPullSuccess={handlePullSuccess}
            />

            <DiagramRenderer database={database} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
