'use client';

import { useCallback } from 'react';
import {
  AppShell,
  Burger,
  Group,
  Title,
  Paper,
  Text,
  Stack,
  Badge,
} from '@mantine/core';
import { IOControls } from '@/components/IOControls';
import { MermaidEditor } from '@/components/MermaidEditor';
import { ValidationDisplay } from '@/components/ValidationDisplay';
import { DiagramRenderer } from '@/components/DiagramRenderer';
import { useAppStore } from '@/stores/useAppStore';

export default function Home() {
  // Subscribe to store state
  const database = useAppStore((state) => state.database);
  const mermaidText = useAppStore((state) => state.mermaidText);
  const dataSource = useAppStore((state) => state.dataSource);
  const parseAndSetDatabase = useAppStore((state) => state.parseAndSetDatabase);

  // UI state for sidebar
  const sidebarCollapsed = useAppStore((state) => state.uiState.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

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
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 400,
        breakpoint: 'sm',
        collapsed: { mobile: sidebarCollapsed, desktop: sidebarCollapsed },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={!sidebarCollapsed}
              onClick={toggleSidebar}
              size="sm"
            />
            <Title order={2}>m2SQL Project Tracker</Title>
          </Group>
          {dataSource && (
            <Badge
              size="lg"
              color={dataSource === 'supabase' ? 'green' : 'blue'}
              variant="light"
            >
              {dataSource === 'supabase' ? 'Supabase' : 'Editor'}
            </Badge>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="lg" style={{ height: '100%', overflow: 'auto' }}>
          <IOControls onFileLoad={handleFileLoad} />

          <MermaidEditor />

          <ValidationDisplay />

          {database && (
            <Paper p="md" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
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
              </Stack>
            </Paper>
          )}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <DiagramRenderer />
      </AppShell.Main>
    </AppShell>
  );
}
