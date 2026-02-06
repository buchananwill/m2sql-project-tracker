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
  Box,
} from '@mantine/core';
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  usePanelRef,
} from 'react-resizable-panels';
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
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);

  // Panel ref for imperative control
  const leftPanelRef = usePanelRef();

  const handleToggleSidebar = useCallback(() => {
    if (leftPanelRef.current) {
      if (sidebarCollapsed) {
        leftPanelRef.current.expand();
        setSidebarCollapsed(false);
      } else {
        leftPanelRef.current.collapse();
        setSidebarCollapsed(true);
      }
    }
  }, [sidebarCollapsed, setSidebarCollapsed, leftPanelRef.current]);

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
    <AppShell header={{ height: 60 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={!sidebarCollapsed}
              onClick={handleToggleSidebar}
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

      <AppShell.Main style={{ height: 'calc(100vh - 60px)', padding: 0 }}>
        <PanelGroup
          orientation="horizontal"
          style={{ width: '100%', height: '100%', display: 'flex' }}
        >
          <Panel
            id="left-panel"
            panelRef={leftPanelRef}
            defaultSize={'30%'}
            minSize={'15%'}
            maxSize={'70%'}
            collapsible
            collapsedSize={0}
            style={{ overflow: 'hidden' }}
            onResize={(size) => {
              // Update store when panel size changes
              const isCollapsed = size.inPixels === 0;
              if (isCollapsed !== sidebarCollapsed) {
                setSidebarCollapsed(isCollapsed);
              }
            }}
          >
            <Box p="md" style={{ width: '100%', height: '100%', overflow: 'auto' }}>
              <Stack gap="lg">
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
            </Box>
          </Panel>

          <PanelResizeHandle
            style={{
              width: '4px',
              backgroundColor: 'var(--mantine-color-gray-4)',
              cursor: 'col-resize',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-4)';
            }}
          />

          <Panel id="right-panel" defaultSize={'70%'} minSize={'20%'}>
            <Box style={{ width: '100%', height: '100%', padding: '1rem' }}>
              <DiagramRenderer />
            </Box>
          </Panel>
        </PanelGroup>
      </AppShell.Main>
    </AppShell>
  );
}
