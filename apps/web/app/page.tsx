'use client';

import { useState } from 'react';
import { Container, Grid, Title, Paper, Text, Stack } from '@mantine/core';
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

  const handleParse = (text: string) => {
    setMermaidText(text);

    if (!text.trim()) {
      setDatabase(null);
      setErrors([]);
      return;
    }

    try {
      const result = parseMermaid(text);

      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors.map(e => e.message));
        setDatabase(null);
      } else {
        setErrors([]);
        if (result.databases && result.databases.length > 0) {
          setDatabase(result.databases[0]!);
        } else {
          setDatabase(null);
        }
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Unknown parse error']);
      setDatabase(null);
    }
  };

  const handleFileLoad = (content: string, filename: string) => {
    handleParse(content);
  };

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
                <Text size="sm" fw={500} mb="xs">
                  Database Info
                </Text>
                <Text size="sm" c="dimmed">
                  Name: {database.name}
                </Text>
                <Text size="sm" c="dimmed">
                  Tables: {database.tables.length}
                </Text>
                <Text size="sm" c="dimmed">
                  Arrow Mappings: {database.arrowMappings?.length || 0}
                </Text>
              </Paper>
            )}
          </Stack>
        </Grid.Col>

        {/* Right column: Visualization and sync controls */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <SyncControls database={database} />

            <DiagramRenderer database={database} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
