'use client';

import { useCallback } from 'react';
import { Container, Grid, Title, Paper, Text, Stack, Badge } from '@mantine/core';
import { FileUpload } from '@/components/FileUpload';
import { MermaidEditor } from '@/components/MermaidEditor';
import { ValidationDisplay } from '@/components/ValidationDisplay';
import { SyncControls } from '@/components/SyncControls';
import { DiagramRenderer } from '@/components/DiagramRenderer';
import { useAppStore } from '@/stores/useAppStore';

export default function Home() {
  // Subscribe to store state
  const database = useAppStore((state) => state.database);
  const mermaidText = useAppStore((state) => state.mermaidText);
  const dataSource = useAppStore((state) => state.dataSource);
  const parseAndSetDatabase = useAppStore((state) => state.parseAndSetDatabase);

  const handleFileLoad = useCallback(
    (content: string, filename: string) => {
      console.log(
        '[handleFileLoad] Called with filename:',
        filename,
        'content length:',
        content.length
      );
      parseAndSetDatabase(content);
    },
    [parseAndSetDatabase]
  );

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

            <MermaidEditor />

            <ValidationDisplay />

            {database && (
              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text size="sm" fw={500}>
                      Database Info
                    </Text>
                    {dataSource && (
                      <Badge
                        size="sm"
                        color={dataSource === 'supabase' ? 'green' : 'blue'}
                        variant="light"
                      >
                        {dataSource === 'supabase'
                          ? 'Pulled from Supabase'
                          : 'From Editor'}
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
            <SyncControls />

            <DiagramRenderer />
          </Stack>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
